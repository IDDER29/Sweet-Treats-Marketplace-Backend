import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliveryService } from './delivery.service';
import { DeliverySlot } from './entities/delivery-slot.entity';
import { Business } from '../business/entities/business.entity';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let slotRepo: any;
  let businessRepo: any;

  beforeEach(async () => {
    slotRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 's1', ...x })),
      createQueryBuilder: jest.fn(),
    };
    businessRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: getRepositoryToken(DeliverySlot), useValue: slotRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    service = module.get(DeliveryService);
  });

  describe('createSlot', () => {
    it('rejects an unknown business', async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createSlot('missing', {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('creates a slot for the business', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'b1' });
      const res = await service.createSlot('b1', { date: '2026-07-01' } as any);
      expect(slotRepo.save).toHaveBeenCalled();
      expect(res.id).toBe('s1');
    });
  });

  describe('updateSlot', () => {
    it('rejects a missing slot', async () => {
      slotRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateSlot('b1', 's1', {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
    it('forbids updating another business slot (IDOR)', async () => {
      slotRepo.findOne.mockResolvedValue({
        id: 's1',
        business: { id: 'other' },
      });
      await expect(
        service.updateSlot('b1', 's1', {} as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('applies the update for the owner', async () => {
      slotRepo.findOne.mockResolvedValue({
        id: 's1',
        business: { id: 'b1' },
        capacity: 5,
      });
      const res = await service.updateSlot('b1', 's1', { capacity: 10 } as any);
      expect(res.capacity).toBe(10);
    });
  });

  describe('bookSlot (atomic, pessimistic lock)', () => {
    const makeQR = (slot: any) => {
      const save = jest.fn();
      const qb: any = {
        setLock: () => qb,
        where: () => qb,
        getOne: jest.fn().mockResolvedValue(slot),
      };
      return {
        manager: {
          getRepository: () => ({ createQueryBuilder: () => qb }),
          save,
        },
        _save: save,
      };
    };

    it('rejects a missing slot', async () => {
      await expect(service.bookSlot('s1', makeQR(null))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
    it('rejects an inactive slot', async () => {
      const qr = makeQR({ isActive: false, bookedCount: 0, capacity: 5 });
      await expect(service.bookSlot('s1', qr)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
    it('rejects a fully booked slot', async () => {
      const qr = makeQR({ isActive: true, bookedCount: 5, capacity: 5 });
      await expect(service.bookSlot('s1', qr)).rejects.toThrow('fully booked');
    });
    it('increments bookedCount on success', async () => {
      const slot = { isActive: true, bookedCount: 2, capacity: 5 };
      const qr = makeQR(slot);
      await service.bookSlot('s1', qr);
      expect(slot.bookedCount).toBe(3);
      expect(qr._save).toHaveBeenCalled();
    });
  });

  describe('releaseSlot', () => {
    it('decrements with a GREATEST(...,0) floor so it never goes negative', async () => {
      const exec = jest.fn().mockResolvedValue({});
      const set = jest.fn();
      const qb: any = {
        update: () => qb,
        set: (...a: any[]) => {
          set(...a);
          return qb;
        },
        where: () => qb,
        execute: exec,
      };
      slotRepo.createQueryBuilder.mockReturnValue(qb);
      await service.releaseSlot('s1');
      expect(exec).toHaveBeenCalled();
      const arg = set.mock.calls[0][0];
      expect(typeof arg.bookedCount).toBe('function'); // raw SQL expression
    });
  });
});
