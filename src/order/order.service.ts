import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';

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
  ) {}

  // Create an order ("checkout") from a cart payload. Prices are always read
  // from the database, never trusted from the client.
  async checkout(customerId: string, dto: CreateOrderDto) {
    const customer = await this.usersRepository.findOne({
      where: { user_id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.productRepository.find({
      where: { id: In(productIds) },
      relations: ['business'],
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products could not be found');
    }

    const businessIds = [...new Set(products.map((p) => p.business?.id))];
    if (businessIds.length > 1) {
      throw new BadRequestException(
        'All items in an order must belong to the same business. Place a separate order per business.',
      );
    }

    const business = products[0].business;
    if (!business) {
      throw new BadRequestException('Products are not linked to a business');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = dto.items.map((input) => {
      const product = productMap.get(input.productId);
      const unitPrice = Number(product.price);
      const lineTotal = Number((unitPrice * input.quantity).toFixed(2));

      const item = new OrderItem();
      item.product = product;
      item.quantity = input.quantity;
      item.unitPrice = unitPrice;
      item.lineTotal = lineTotal;
      return item;
    });

    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
    );

    const order = this.orderRepository.create({
      customer,
      business,
      items,
      totalAmount,
      status: OrderStatus.PENDING,
      deliveryAddress: dto.deliveryAddress ?? customer.address,
      notes: dto.notes,
    });

    const saved = await this.orderRepository.save(order);
    return this.toResponse(saved);
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
    const saved = await this.orderRepository.save(order);
    return this.toResponse(saved);
  }

  async findForBusiness(businessId: string) {
    const orders = await this.orderRepository.find({
      where: { business: { id: businessId } },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => this.toResponse(order));
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.getOrderOrFail(id);
    order.status = status;
    const saved = await this.orderRepository.save(order);
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
