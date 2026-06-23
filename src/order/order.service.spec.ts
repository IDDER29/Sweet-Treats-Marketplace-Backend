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
import { Driver } from '../driver/entities/driver.entity';
import { MailQueueService } from '../mail/mail-queue.service';
import { MetricsService } from '../observability/metrics.service';
import { NotificationService } from '../notification/notification.service';

describe('OrderService.updateStatus (lifecycle)', () => {
  let service: OrderService;
  let orderRepo: any;
  let driverRepo: any;
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
    driverRepo = repoMock();
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
        { provide: getRepositoryToken(Driver), useValue: driverRepo },
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

  describe('driver assignment + delivery', () => {
    it('assigns an active driver to a READY order (owner only)', async () => {
      orderRepo.findOne.mockResolvedValue(orderWith(OrderStatus.READY));
      driverRepo.findOne.mockResolvedValue({
        id: 'd1',
        name: 'Dan',
        isActive: true,
      });
      const res = await service.assignDriver('o1', 'd1', 'b1');
      expect(orderRepo.save).toHaveBeenCalled();
      expect(res.status).toBe(OrderStatus.READY);
      expect(notifications.record).toHaveBeenCalled();
    });

    it('rejects assigning before PREPARING/READY', async () => {
      orderRepo.findOne.mockResolvedValue(orderWith(OrderStatus.PAID));
      driverRepo.findOne.mockResolvedValue({ id: 'd1', isActive: true });
      await expect(
        service.assignDriver('o1', 'd1', 'b1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects assigning a non-owner business', async () => {
      orderRepo.findOne.mockResolvedValue(orderWith(OrderStatus.READY));
      await expect(
        service.assignDriver('o1', 'd1', 'other'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the assigned driver advance OUT_FOR_DELIVERY -> DELIVERED', async () => {
      orderRepo.findOne.mockResolvedValue({
        ...orderWith(OrderStatus.OUT_FOR_DELIVERY),
        driver: { id: 'd1' },
      });
      const res = await service.driverUpdateStatus(
        'o1',
        OrderStatus.DELIVERED,
        'd1',
      );
      expect(res.status).toBe(OrderStatus.DELIVERED);
    });

    it('forbids a driver acting on an order not assigned to them', async () => {
      orderRepo.findOne.mockResolvedValue({
        ...orderWith(OrderStatus.OUT_FOR_DELIVERY),
        driver: { id: 'other-driver' },
      });
      await expect(
        service.driverUpdateStatus('o1', OrderStatus.DELIVERED, 'd1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an illegal driver transition', async () => {
      orderRepo.findOne.mockResolvedValue({
        ...orderWith(OrderStatus.PREPARING),
        driver: { id: 'd1' },
      });
      await expect(
        service.driverUpdateStatus('o1', OrderStatus.DELIVERED, 'd1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
