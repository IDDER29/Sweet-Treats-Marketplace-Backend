import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DiscountService } from './discount.service';
import { DiscountCode, DiscountType } from './entities/discount-code.entity';
import { DiscountCodeUsage } from './entities/discount-code-usage.entity';
import { Business } from '../business/entities/business.entity';

describe('DiscountService', () => {
  let service: DiscountService;
  let discountRepo: any;
  let usageRepo: any;
  let businessRepo: any;

  beforeEach(async () => {
    discountRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'd1', ...x })),
      find: jest.fn(),
    };
    usageRepo = { count: jest.fn() };
    businessRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountService,
        { provide: getRepositoryToken(DiscountCode), useValue: discountRepo },
        { provide: getRepositoryToken(DiscountCodeUsage), useValue: usageRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();
    service = module.get(DiscountService);
  });

  describe('calculateDiscount', () => {
    it('computes a percentage discount rounded to 2dp', () => {
      const d = { type: DiscountType.PERCENTAGE, value: 15 } as DiscountCode;
      expect(service.calculateDiscount(d, 100)).toBe(15);
      expect(service.calculateDiscount(d, 33.33)).toBe(5); // 4.9995 -> 5.00
    });
    it('clamps a fixed discount to the order amount', () => {
      const d = { type: DiscountType.FIXED_AMOUNT, value: 50 } as DiscountCode;
      expect(service.calculateDiscount(d, 100)).toBe(50);
      expect(service.calculateDiscount(d, 30)).toBe(30); // never more than the order
    });
  });

  describe('create', () => {
    const dto = (over: any = {}) => ({
      code: 'save10',
      type: DiscountType.PERCENTAGE,
      value: 10,
      validFrom: '2026-01-01',
      ...over,
    });

    it('rejects an unknown business', async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('missing', dto() as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('rejects a percentage over 100', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'b1' });
      await expect(
        service.create('b1', dto({ value: 150 }) as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it('rejects a duplicate code', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'b1' });
      discountRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.create('b1', dto() as any)).rejects.toThrow(
        'already exists',
      );
    });
    it('uppercases the code and saves', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'b1' });
      discountRepo.findOne.mockResolvedValue(null);
      const res = await service.create('b1', dto() as any);
      expect(discountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SAVE10' }),
      );
      expect(res.id).toBe('d1');
    });
  });

  describe('validate', () => {
    const base = () => ({
      id: 'd1',
      code: 'SAVE10',
      type: DiscountType.PERCENTAGE,
      value: 10,
      isActive: true,
      validFrom: new Date(Date.now() - 1000),
      validUntil: null,
      maxUses: null,
      usedCount: 0,
      minimumOrderAmount: null,
      maxUsesPerCustomer: null,
    });
    const req = (over: any = {}) => ({
      code: 'save10',
      businessId: 'b1',
      orderAmount: 100,
      ...over,
    });

    it('rejects an unknown code', async () => {
      discountRepo.findOne.mockResolvedValue(null);
      await expect(service.validate(req() as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('rejects an inactive code', async () => {
      discountRepo.findOne.mockResolvedValue({ ...base(), isActive: false });
      await expect(service.validate(req() as any)).rejects.toThrow(
        'not active',
      );
    });
    it('rejects a not-yet-valid code', async () => {
      discountRepo.findOne.mockResolvedValue({
        ...base(),
        validFrom: new Date(Date.now() + 100000),
      });
      await expect(service.validate(req() as any)).rejects.toThrow(
        'not yet valid',
      );
    });
    it('rejects an expired code', async () => {
      discountRepo.findOne.mockResolvedValue({
        ...base(),
        validUntil: new Date(Date.now() - 100000),
      });
      await expect(service.validate(req() as any)).rejects.toThrow('expired');
    });
    it('rejects when the global usage limit is reached', async () => {
      discountRepo.findOne.mockResolvedValue({
        ...base(),
        maxUses: 5,
        usedCount: 5,
      });
      await expect(service.validate(req() as any)).rejects.toThrow(
        'usage limit',
      );
    });
    it('rejects below the minimum order amount', async () => {
      discountRepo.findOne.mockResolvedValue({
        ...base(),
        minimumOrderAmount: 50,
      });
      await expect(
        service.validate(req({ orderAmount: 20 }) as any),
      ).rejects.toThrow('Minimum order amount');
    });
    it('rejects when the per-customer limit is reached', async () => {
      discountRepo.findOne.mockResolvedValue({
        ...base(),
        maxUsesPerCustomer: 1,
      });
      usageRepo.count.mockResolvedValue(1);
      await expect(service.validate(req() as any, 'u1')).rejects.toThrow(
        'maximum number of times',
      );
    });
    it('returns the computed discount + final amount on success', async () => {
      discountRepo.findOne.mockResolvedValue(base());
      const res = await service.validate(req() as any);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(10);
      expect(res.finalAmount).toBe(90);
    });
  });
});
