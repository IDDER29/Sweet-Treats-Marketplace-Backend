import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderService } from './order.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { DeliverySlot } from '../delivery/entities/delivery-slot.entity';
import { DiscountCode } from '../discount/entities/discount-code.entity';
import { Address } from '../address/entities/address.entity';
import { MailQueueService } from '../mail/mail-queue.service';
import { MetricsService } from '../observability/metrics.service';
import { NotificationService } from '../notification/notification.service';

describe('OrderService.updateStatus (lifecycle)', () => {
  let service: OrderService;
  let orderRepo: any;
  let notifications: { record: jest.Mock };

  const repoMock = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (x: any) => x),
    update: jest.fn(),
    create: jest.fn((x: any) => x),
  });

  beforeEach(async () => {
    orderRepo = repoMock();
    notifications = { record: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: repoMock() },
        { provide: getRepositoryToken(Users), useValue: repoMock() },
        { provide: getRepositoryToken(Product), useValue: repoMock() },
        { provide: getRepositoryToken(DeliverySlot), useValue: repoMock() },
        { provide: getRepositoryToken(DiscountCode), useValue: repoMock() },
        { provide: getRepositoryToken(Address), useValue: repoMock() },
        { provide: DataSource, useValue: {} },
        { provide: MailQueueService, useValue: { statusUpdate: jest.fn() } },
        {
          provide: MetricsService,
          useValue: { recordOrderCreated: jest.fn() },
        },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    service = module.get(OrderService);
  });

  const orderWith = (status: OrderStatus) => ({
    id: 'o1',
    status,
    business: { id: 'b1' },
    customer: { user_id: 'u1', email: 'c@test.com', first_name: 'C' },
  });

  it.each([
    [OrderStatus.PENDING, OrderStatus.CANCELLED],
    [OrderStatus.PAID, OrderStatus.PREPARING],
    [OrderStatus.PREPARING, OrderStatus.READY],
    [OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY],
    [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
    [OrderStatus.READY, OrderStatus.DELIVERED], // pickup path
  ])('allows %s -> %s', async (from, to) => {
    orderRepo.findOne.mockResolvedValue(orderWith(from));
    const res = await service.updateStatus('o1', to, 'b1');
    expect(res.status).toBe(to);
    expect(notifications.record).toHaveBeenCalled();
  });

  it.each([
    [OrderStatus.PENDING, OrderStatus.DELIVERED],
    [OrderStatus.PAID, OrderStatus.DELIVERED],
    [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PREPARING],
    [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  ])('rejects %s -> %s', async (from, to) => {
    orderRepo.findOne.mockResolvedValue(orderWith(from));
    await expect(service.updateStatus('o1', to, 'b1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a seller acting on another business order (ownership)', async () => {
    orderRepo.findOne.mockResolvedValue(orderWith(OrderStatus.PAID));
    await expect(
      service.updateStatus('o1', OrderStatus.PREPARING, 'someone-else'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
