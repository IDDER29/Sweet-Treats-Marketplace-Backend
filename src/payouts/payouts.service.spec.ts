import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import { Business } from '../business/entities/business.entity';

describe('PayoutsService (fee split)', () => {
  let service: PayoutsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: getRepositoryToken(Business), useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(PayoutsService);
  });

  describe('computeApplicationFee (default 10%)', () => {
    it('takes 10% of gross, rounded to minor units', () => {
      expect(service.computeApplicationFee(10000)).toBe(1000); // £100 -> £10
      expect(service.computeApplicationFee(2999)).toBe(300); // 299.9 -> 300
    });
    it('returns 0 for a non-positive gross', () => {
      expect(service.computeApplicationFee(0)).toBe(0);
      expect(service.computeApplicationFee(-50)).toBe(0);
    });
  });

  describe('computeSellerNet', () => {
    it('is gross minus the platform fee', () => {
      expect(service.computeSellerNet(10000)).toBe(9000);
      // fee + net always reconstitutes gross
      expect(
        service.computeApplicationFee(7777) + service.computeSellerNet(7777),
      ).toBe(7777);
    });
  });

  describe('destinationChargeParams', () => {
    it('returns null when the seller cannot receive payouts yet', () => {
      expect(
        service.destinationChargeParams(10000, {
          stripeAccountId: null,
          payoutsEnabled: false,
        }),
      ).toBeNull();
      expect(
        service.destinationChargeParams(10000, {
          stripeAccountId: 'acct_1',
          payoutsEnabled: false,
        }),
      ).toBeNull();
    });

    it('routes the charge to the connected account with the platform fee', () => {
      const p = service.destinationChargeParams(10000, {
        stripeAccountId: 'acct_1',
        payoutsEnabled: true,
      });
      expect(p).toEqual({
        application_fee_amount: 1000,
        transfer_data: { destination: 'acct_1' },
      });
    });
  });
});
