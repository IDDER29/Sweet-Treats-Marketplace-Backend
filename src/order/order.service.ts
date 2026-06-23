import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Order, OrderStatus, FulfillmentType } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { Driver } from '../driver/entities/driver.entity';
import { DeliverySlot } from '../delivery/entities/delivery-slot.entity';
import {
  DiscountCode,
  DiscountType,
} from '../discount/entities/discount-code.entity';
import { DiscountCodeUsage } from '../discount/entities/discount-code-usage.entity';
import { Address } from '../address/entities/address.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MailQueueService } from '../mail/mail-queue.service';
import { assertOwnership } from '../common/authorization/ownership.util';
import { MetricsService } from '../observability/metrics.service';
import { NotificationService } from '../notification/notification.service';

const ORDER_RELATIONS = [
  'items',
  'items.product',
  'business',
  'customer',
  'driver',
];

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(DeliverySlot)
    private readonly deliverySlotRepository: Repository<DeliverySlot>,
    @InjectRepository(DiscountCode)
    private readonly discountCodeRepository: Repository<DiscountCode>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly dataSource: DataSource,
    private readonly mailQueue: MailQueueService,
    private readonly metrics: MetricsService,
    private readonly notifications: NotificationService,
  ) {}

  // Resolve a saved address id into a snapshot string + phone, fail-closed if it
  // isn't owned by this customer.
  private async resolveAddress(
    customerId: string,
    addressId: string,
  ): Promise<{ snapshot: string; phone: string | null }> {
    const a = await this.addressRepository.findOne({
      where: { id: addressId, user: { user_id: customerId } },
    });
    if (!a) throw new NotFoundException('Address not found');
    const snapshot = [
      a.recipientName,
      a.line1,
      a.line2,
      `${a.city} ${a.postcode}`.trim(),
      a.country,
    ]
      .filter(Boolean)
      .join(', ');
    return { snapshot, phone: a.phone ?? null };
  }

  // Create an order ("checkout") from a cart payload. Prices are always read
  // from the database, never trusted from the client.
  // Uses a queryRunner transaction with pessimistic row locks to prevent overselling.
  async checkout(customerId: string, dto: CreateOrderDto) {
    const customer = await this.usersRepository.findOne({
      where: { user_id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const productIds = [...new Set(dto.items.map((i) => i.productId))];

      // Lock rows for update to prevent race conditions on stock
      const products = await queryRunner.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        // Lock only the product rows (FOR UPDATE OF product). Postgres forbids
        // FOR UPDATE on the nullable side of the LEFT JOIN to business.
        .setLock('pessimistic_write', undefined, ['product'])
        .leftJoinAndSelect('product.business', 'business')
        .where('product.id IN (:...ids)', { ids: productIds })
        .getMany();

      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products could not be found');
      }

      // Validate all same business
      const businessIds = [
        ...new Set(products.map((p) => p.business?.id).filter(Boolean)),
      ];
      if (businessIds.length > 1) {
        throw new BadRequestException(
          'All items must belong to the same business.',
        );
      }

      const business = products[0].business;
      if (!business) {
        throw new BadRequestException('Products are not linked to a business');
      }
      if (business.isSuspended) {
        throw new BadRequestException('This business is currently suspended');
      }
      if (!business.isAcceptingOrders) {
        throw new BadRequestException(
          'This business is not currently accepting orders',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Validate stock and max order quantity, build items
      const items: OrderItem[] = [];
      for (const input of dto.items) {
        const product = productMap.get(input.productId);
        if (!product.isActive) {
          throw new BadRequestException(
            `Product "${product.name}" is not available`,
          );
        }
        if (
          product.maxOrderQuantity &&
          input.quantity > product.maxOrderQuantity
        ) {
          throw new BadRequestException(
            `Max order quantity for "${product.name}" is ${product.maxOrderQuantity}`,
          );
        }
        if (product.trackStock) {
          if (product.stockQuantity < input.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`,
            );
          }
          // Decrement stock atomically within the transaction
          product.stockQuantity -= input.quantity;
          await queryRunner.manager.save(Product, product);
        }

        const unitPrice = Number(product.price);
        const lineTotal = Number((unitPrice * input.quantity).toFixed(2));
        const item = new OrderItem();
        item.product = product;
        item.quantity = input.quantity;
        item.unitPrice = unitPrice;
        item.lineTotal = lineTotal;
        items.push(item);
      }

      // Lead time validation
      if (dto.requestedDeliveryDate) {
        const maxLeadDays = Math.max(
          ...products.map((p) => p.leadTimeDays ?? 0),
        );
        const earliest = new Date();
        earliest.setDate(earliest.getDate() + maxLeadDays);
        earliest.setHours(0, 0, 0, 0);
        const requested = new Date(dto.requestedDeliveryDate);
        if (requested < earliest) {
          throw new BadRequestException(
            `Earliest delivery date for this order is ${earliest.toISOString().split('T')[0]} (${maxLeadDays} day lead time required)`,
          );
        }
      }

      // Slot booking (inside transaction, pessimistic lock)
      if (dto.deliverySlotId) {
        const slot = await queryRunner.manager
          .getRepository(DeliverySlot)
          .createQueryBuilder('slot')
          .setLock('pessimistic_write')
          .where('slot.id = :id', { id: dto.deliverySlotId })
          .getOne();

        if (!slot) throw new NotFoundException('Delivery slot not found');
        if (!slot.isActive)
          throw new BadRequestException('Delivery slot is not available');
        if (slot.bookedCount >= slot.capacity)
          throw new BadRequestException('Delivery slot is fully booked');
        slot.bookedCount += 1;
        await queryRunner.manager.save(DeliverySlot, slot);
      }

      const itemsTotal = Number(
        items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2),
      );

      // Apply discount code if provided
      let discountAmount = 0;
      let appliedDiscountCodeId: string | null = null;

      if (dto.discountCode) {
        const code = dto.discountCode.toUpperCase().trim();
        const discount = await queryRunner.manager
          .getRepository(DiscountCode)
          .createQueryBuilder('dc')
          // Lock only the discount-code row (FOR UPDATE OF dc); business is the
          // nullable side of the LEFT JOIN and cannot take FOR UPDATE.
          .setLock('pessimistic_write', undefined, ['dc'])
          .leftJoinAndSelect('dc.business', 'business')
          .where('dc.code = :code AND business.id = :businessId', {
            code,
            businessId: business.id,
          })
          .getOne();

        if (!discount) throw new BadRequestException('Invalid discount code');
        if (!discount.isActive)
          throw new BadRequestException('Discount code is not active');
        const now = new Date();
        if (now < new Date(discount.validFrom))
          throw new BadRequestException('Discount code not yet valid');
        if (discount.validUntil && now > new Date(discount.validUntil))
          throw new BadRequestException('Discount code expired');
        if (discount.maxUses && discount.usedCount >= discount.maxUses)
          throw new BadRequestException('Discount code usage limit reached');
        if (discount.maxUsesPerCustomer) {
          const userUsages = await queryRunner.manager.count(
            DiscountCodeUsage,
            {
              where: {
                discountCode: { id: discount.id },
                user: { user_id: customerId },
              },
            },
          );
          if (userUsages >= discount.maxUsesPerCustomer) {
            throw new BadRequestException(
              'You have already used this discount code the maximum number of times',
            );
          }
        }
        if (
          discount.minimumOrderAmount &&
          itemsTotal < Number(discount.minimumOrderAmount)
        ) {
          throw new BadRequestException(
            `Minimum order amount is £${discount.minimumOrderAmount}`,
          );
        }

        if (discount.type === DiscountType.PERCENTAGE) {
          // Clamp to the subtotal so a misconfigured >100% code can never
          // produce a discount larger than the order (negative total).
          discountAmount = Number(
            Math.min(
              (itemsTotal * Number(discount.value)) / 100,
              itemsTotal,
            ).toFixed(2),
          );
        } else {
          discountAmount = Math.min(Number(discount.value), itemsTotal);
        }

        discount.usedCount += 1;
        await queryRunner.manager.save(DiscountCode, discount);
        appliedDiscountCodeId = discount.id;
      }

      // Pickup waives the delivery fee. Tip is added on top, never discounted.
      const fulfillmentType = dto.fulfillmentType ?? FulfillmentType.DELIVERY;
      const deliveryFee =
        fulfillmentType === FulfillmentType.PICKUP ? 0 : (dto.deliveryFee ?? 0);
      const tipAmount = Math.max(0, Number(dto.tipAmount ?? 0));
      const totalAmount = Number(
        (itemsTotal - discountAmount + deliveryFee + tipAmount).toFixed(2),
      );

      // Resolve a saved address (if supplied) into a snapshot + phone.
      let deliveryAddress = dto.deliveryAddress ?? customer.address;
      let contactPhone = dto.contactPhone ?? null;
      if (dto.addressId) {
        const resolved = await this.resolveAddress(customerId, dto.addressId);
        deliveryAddress = resolved.snapshot;
        contactPhone = contactPhone ?? resolved.phone;
      }

      const order = queryRunner.manager.create(Order, {
        customer,
        business,
        items,
        totalAmount,
        status: OrderStatus.PENDING,
        fulfillmentType,
        tipAmount,
        deliveryAddress,
        deliveryAddressId: dto.addressId ?? null,
        contactPhone,
        giftMessage: dto.giftMessage ?? null,
        notes: dto.notes,
        requestedDeliveryDate: dto.requestedDeliveryDate,
        deliverySlotId: dto.deliverySlotId,
        deliveryFee,
        discountCodeId: appliedDiscountCodeId,
        discountAmount,
      });

      const saved = await queryRunner.manager.save(Order, order);

      // Record per-customer discount usage so maxUsesPerCustomer is enforceable.
      if (appliedDiscountCodeId) {
        const usage = queryRunner.manager.create(DiscountCodeUsage, {
          discountCode: { id: appliedDiscountCodeId },
          user: { user_id: customerId },
          order: { id: saved.id },
        });
        await queryRunner.manager.save(DiscountCodeUsage, usage);
      }

      await queryRunner.commitTransaction();

      // Reload with full relations for response
      const full = await this.orderRepository.findOne({
        where: { id: saved.id },
        relations: ORDER_RELATIONS,
      });

      // Send email notifications (non-blocking — failures are swallowed)
      const customerName = customer.first_name || customer.email;
      // Durable email via the queue (retries + DLQ). Fire-and-forget so
      // checkout never blocks on mail.
      void this.mailQueue.orderConfirmation(full, customer.email, customerName);
      void this.mailQueue.orderAlert(full, business.email);

      // Business KPI: orders + GMV (Prometheus).
      this.metrics.recordOrderCreated(Number(full.totalAmount));

      // In-app notification (best-effort).
      void this.notifications.record(customerId, {
        type: 'ORDER_PLACED',
        title: 'Order placed',
        body: `Your order with ${business.businessName} is confirmed.`,
        data: { orderId: full.id, status: full.status },
      });

      return this.toResponse(full);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findForCustomer(customerId: string) {
    const orders = await this.orderRepository.find({
      where: { customer: { user_id: customerId } },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toResponse(order));
  }

  async findOneForCustomer(customerId: string, id: string) {
    const order = await this.getOrderOrFail(id);
    assertOwnership(order, 'customer.user_id', customerId, 'order');
    return this.toResponse(order);
  }

  async cancelOwnOrder(customerId: string, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        relations: ORDER_RELATIONS,
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      assertOwnership(order, 'customer.user_id', customerId, 'order');
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException('Only pending orders can be cancelled');
      }
      order.status = OrderStatus.CANCELLED;
      await this.releaseOrderResources(manager, order);
      const saved = await manager.save(Order, order);
      return this.toResponse(saved);
    });
  }

  // Cancel a (paid) order on behalf of a refund and release its held resources.
  // Idempotent: a no-op if the order is already cancelled, so a retried refund
  // never double-restores stock or discount usage. Called by PaymentService.
  async cancelForRefund(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ORDER_RELATIONS,
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === OrderStatus.CANCELLED) {
        return;
      }
      order.status = OrderStatus.CANCELLED;
      await this.releaseOrderResources(manager, order);
      await manager.save(Order, order);
    });
  }

  // Restore the resources an order was holding: product stock, the booked
  // delivery slot, and discount-code usage. Runs inside the caller's
  // transaction. Callers must guard against being invoked twice for the same
  // order (e.g. via a status check) to avoid double restoration.
  private async releaseOrderResources(
    manager: EntityManager,
    order: Order,
  ): Promise<void> {
    for (const item of order.items || []) {
      if (item.product && item.product.trackStock) {
        await manager.increment(
          Product,
          { id: item.product.id },
          'stockQuantity',
          item.quantity,
        );
      }
    }

    // Use decrement() (entity property path -> correct column) rather than raw
    // SQL: the columns are camelCase ("bookedCount"/"usedCount") and would need
    // exact quoting. The caller's idempotency guard ensures this runs at most
    // once per order, so the counters cannot go below their checkout value.
    if (order.deliverySlotId) {
      await manager.decrement(
        DeliverySlot,
        { id: order.deliverySlotId },
        'bookedCount',
        1,
      );
    }

    if (order.discountCodeId) {
      await manager.decrement(
        DiscountCode,
        { id: order.discountCodeId },
        'usedCount',
        1,
      );
      // Remove the per-customer usage record so the customer's count is freed.
      await manager.delete(DiscountCodeUsage, { order: { id: order.id } });
    }
  }

  async findForBusiness(businessId: string, requestingBusinessId: string) {
    if (businessId !== requestingBusinessId) {
      throw new ForbiddenException(
        'You do not have access to this business orders',
      );
    }
    const orders = await this.orderRepository.find({
      where: { business: { id: businessId } },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toResponse(order));
  }

  async updateStatus(id: string, status: OrderStatus, businessId: string) {
    const order = await this.getOrderOrFail(id);
    assertOwnership(order, 'business.id', businessId, 'order');

    // Enforce valid status transitions. Payment to PAID is handled by the
    // webhook in PaymentService, so sellers only drive post-payment flow.
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [
        OrderStatus.PREPARING,
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      // READY can go out for delivery, or be marked delivered directly (pickup).
      [OrderStatus.READY]: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      // Terminal states — no further transitions.
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };
    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${status}`,
      );
    }

    order.status = status;
    const saved = await this.orderRepository.save(order);

    // Status-update email via the queue (non-blocking).
    if (order.customer?.email) {
      const customerName = order.customer.first_name || order.customer.email;
      void this.mailQueue.statusUpdate(
        saved,
        order.customer.email,
        customerName,
      );
    }

    // In-app notification for the customer (best-effort).
    if (order.customer?.user_id) {
      void this.notifications.record(order.customer.user_id, {
        type: 'ORDER_STATUS',
        title: `Order ${status.toLowerCase().replace(/_/g, ' ')}`,
        body: `Your order is now ${status.replace(/_/g, ' ').toLowerCase()}.`,
        data: { orderId: order.id, status },
      });
    }

    return this.toResponse(saved);
  }

  // --- Delivery partner ------------------------------------------------------
  // Seller assigns an active driver to one of their orders that's being prepared
  // or ready for hand-off.
  async assignDriver(orderId: string, driverId: string, businessId: string) {
    const order = await this.getOrderOrFail(orderId);
    assertOwnership(order, 'business.id', businessId, 'order');
    if (![OrderStatus.PREPARING, OrderStatus.READY].includes(order.status)) {
      throw new BadRequestException(
        `A driver can only be assigned while the order is PREPARING or READY (currently ${order.status}).`,
      );
    }
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });
    if (!driver || !driver.isActive) {
      throw new NotFoundException('Active driver not found');
    }
    order.driver = driver;
    const saved = await this.orderRepository.save(order);
    if (order.customer?.user_id) {
      void this.notifications.record(order.customer.user_id, {
        type: 'ORDER_DRIVER',
        title: 'Driver assigned',
        body: `${driver.name} will deliver your order.`,
        data: { orderId: order.id, driverId },
      });
    }
    return this.toResponse(saved);
  }

  findForDriver(driverId: string) {
    return this.orderRepository
      .find({
        where: { driver: { id: driverId } },
        relations: ORDER_RELATIONS,
        order: { createdAt: 'DESC' },
      })
      .then((orders) => orders.map((o) => this.toResponse(o)));
  }

  // The driver advances only their own assigned orders, and only along the
  // delivery leg (READY -> OUT_FOR_DELIVERY -> DELIVERED).
  async driverUpdateStatus(
    orderId: string,
    status: OrderStatus,
    driverId: string,
  ) {
    const order = await this.getOrderOrFail(orderId);
    if (order.driver?.id !== driverId) {
      throw new ForbiddenException('This order is not assigned to you');
    }
    const allowed: Record<string, OrderStatus[]> = {
      [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    };
    if (!(allowed[order.status] ?? []).includes(status)) {
      throw new BadRequestException(
        `Driver cannot move order from ${order.status} to ${status}`,
      );
    }
    order.status = status;
    const saved = await this.orderRepository.save(order);
    if (order.customer?.user_id) {
      void this.notifications.record(order.customer.user_id, {
        type: 'ORDER_STATUS',
        title: `Order ${status.replace(/_/g, ' ').toLowerCase()}`,
        body: `Your order is now ${status.replace(/_/g, ' ').toLowerCase()}.`,
        data: { orderId: order.id, status },
      });
    }
    return this.toResponse(saved);
  }

  private async getOrderOrFail(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // Shapes the response and, importantly, strips password hashes off the
  // related customer/business records.
  private toResponse(order: Order) {
    return {
      id: order.id,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      totalAmount: Number(order.totalAmount),
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      requestedDeliveryDate: order.requestedDeliveryDate,
      deliverySlotId: order.deliverySlotId,
      deliveryFee: Number(order.deliveryFee),
      tipAmount: Number(order.tipAmount ?? 0),
      discountAmount: Number(order.discountAmount ?? 0),
      discountCodeId: order.discountCodeId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: order.customer
        ? {
            userId: order.customer.user_id,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
            email: order.customer.email,
          }
        : undefined,
      business: order.business
        ? {
            id: order.business.id,
            businessName: order.business.businessName,
            email: order.business.email,
          }
        : undefined,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              price: Number(item.product.price),
              images: item.product.images,
            }
          : undefined,
      })),
    };
  }
}
