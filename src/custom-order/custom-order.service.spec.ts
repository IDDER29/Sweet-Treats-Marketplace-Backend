import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomOrderService } from './custom-order.service';
import {
  CustomOrderRequest,
  CustomOrderStatus,
} from './entities/custom-order-request.entity';
import { Users } from '../entities/users.entity';
import { Business } from '../business/entities/business.entity';

describe('CustomOrderService.createDepositIntent', () => {
  let service: CustomOrderService;
  let repo: any;
  let stripeCreate: jest.Mock;

  beforeEach(async () => {
    repo = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomOrderService,
        { provide: getRepositoryToken(CustomOrderRequest), useValue: repo },
        { provide: getRepositoryToken(Users), useValue: {} },
        { provide: getRepositoryToken(Business), useValue: {} },
      ],
    }).compile();
    service = module.get(CustomOrderService);

    // Stub the Stripe client so no network call is made.
    stripeCreate = jest
      .fn()
      .mockResolvedValue({ id: 'pi_1', client_secret: 'cs_1' });
    (service as any).stripe = { paymentIntents: { create: stripeCreate } };
  });

  const request = (over: any = {}) => ({
    id: 'r1',
    status: CustomOrderStatus.ACCEPTED,
    depositAmount: 30,
    currency: 'gbp',
    customer: { user_id: 'u1' },
    business: { id: 'b1' },
    ...over,
  });

  it('creates a deposit intent for the deposit amount (minor units)', async () => {
    repo.findOne.mockResolvedValue(request());
    const res = await service.createDepositIntent('u1', 'r1');
    expect(stripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, currency: 'gbp' }),
    );
    expect(res.clientSecret).toBe('cs_1');
    expect(res.amount).toBe(3000);
  });

  it('rejects a deposit before the quote is ACCEPTED', async () => {
    repo.findOne.mockResolvedValue(
      request({ status: CustomOrderStatus.QUOTED }),
    );
    await expect(
      service.createDepositIntent('u1', 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when no deposit is due', async () => {
    repo.findOne.mockResolvedValue(request({ depositAmount: 0 }));
    await expect(
      service.createDepositIntent('u1', 'r1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids paying a deposit on someone else’s request', async () => {
    repo.findOne.mockResolvedValue(request());
    await expect(
      service.createDepositIntent('intruder', 'r1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s an unknown request', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.createDepositIntent('u1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
