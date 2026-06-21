import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { DeliverySlot } from '../delivery/entities/delivery-slot.entity';
import { DiscountCode, DiscountType } from '../discount/entities/discount-code.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MailService } from '../mail/mail.service';

const ORDER_RELATIONS = ['items', 'items.product', 'business', 'customer'];

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
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

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
        .setLock('pessimistic_write')
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
        throw new BadRequestException('All items must belong to the same business.');
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
          .setLock('pessimistic_write')
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
        if (
          discount.minimumOrderAmount &&
          itemsTotal < Number(discount.minimumOrderAmount)
        ) {
          throw new BadRequestException(
            `Minimum order amount is £${discount.minimumOrderAmount}`,
          );
        }

        if (discount.type === DiscountType.PERCENTAGE) {
          discountAmount = Number(
            ((itemsTotal * Number(discount.value)) / 100).toFixed(2),
          );
        } else {
          discountAmount = Math.min(Number(discount.value), itemsTotal);
        }

        discount.usedCount += 1;
        await queryRunner.manager.save(DiscountCode, discount);
        appliedDiscountCodeId = discount.id;
      }

      const totalAmount = Number(
        (itemsTotal - discountAmount + (dto.deliveryFee ?? 0)).toFixed(2),
      );

      const order = queryRunner.manager.create(Order, {
        customer,
        business,
        items,
        totalAmount,
        status: OrderStatus.PENDING,
        deliveryAddress: dto.deliveryAddress ?? customer.address,
        notes: dto.notes,
        requestedDeliveryDate: dto.requestedDeliveryDate,
        deliverySlotId: dto.deliverySlotId,
        deliveryFee: dto.deliveryFee ?? 0,
        discountCodeId: appliedDiscountCodeId,
        discountAmount,
      });

      const saved = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      // Reload with full relations for response
      const full = await this.orderRepository.findOne({
        where: { id: saved.id },
        relations: ORDER_RELATIONS,
      });

      // Send email notifications (non-blocking — failures are swallowed)
      const customerName = customer.first_name || customer.email;
      this.mailService.sendOrderConfirmation(full, customer.email, customerName);
      this.mailService.sendOrderAlert(full, business.email);

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
    if (order.customer?.user_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return this.toResponse(order);
  }

  async cancelOwnOrder(customerId: string, id: string) {
    const order = await this.getOrderOrFail(id);
    if (order.customer?.user_id !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }
    order.status = OrderStatus.CANCELLED;

    // Restore stock for each tracked product
    for (const item of order.items) {
      if (item.product && item.product.trackStock) {
        await this.productRepository.increment(
          { id: item.product.id },
          'stockQuantity',
          item.quantity,
        );
      }
    }

    // Release the delivery slot if one was booked
    if (order.deliverySlotId) {
      await this.deliverySlotRepository
        .createQueryBuilder()
        .update(DeliverySlot)
        .set({ bookedCount: () => 'GREATEST(booked_count - 1, 0)' })
        .where('id = :id', { id: order.deliverySlotId })
        .execute();
    }

    const saved = await this.orderRepository.save(order);
    return this.toResponse(saved);
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
    if (order.business?.id !== businessId) {
      throw new ForbiddenException(
        'You do not have access to update this order',
      );
    }

    // Enforce valid status transitions. Payment to PAID is handled by the
    // webhook in PaymentService, so sellers only drive post-payment flow.
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    };
    const allowed = validTransitions[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${status}`,
      );
    }

    order.status = status;
    const saved = await this.orderRepository.save(order);

    // Send status update email to customer (non-blocking — failures are swallowed)
    if (order.customer?.email) {
      const customerName = order.customer.first_name || order.customer.email;
      this.mailService.sendStatusUpdate(saved, order.customer.email, customerName);
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
      totalAmount: Number(order.totalAmount),
      deliveryAddress: order.deliveryAddress,
      notes: order.notes,
      requestedDeliveryDate: order.requestedDeliveryDate,
      deliverySlotId: order.deliverySlotId,
      deliveryFee: Number(order.deliveryFee),
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
