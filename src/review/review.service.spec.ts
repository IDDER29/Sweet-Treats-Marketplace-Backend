import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { Order } from '../order/entities/order.entity';

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepo: any;
  let usersRepo: any;
  let productRepo: any;
  let businessRepo: any;
  let orderRepo: any;

  beforeEach(async () => {
    reviewRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([{ rating: 4 }, { rating: 5 }]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'rev1', createdAt: new Date(), ...x })),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: () => reviewRepo.createQueryBuilder(),
        select: () => reviewRepo.createQueryBuilder(),
        addSelect: () => reviewRepo.createQueryBuilder(),
        where: () => reviewRepo.createQueryBuilder(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '2' }),
      })),
    };
    usersRepo = { findOne: jest.fn().mockResolvedValue({ user_id: 'u1' }) };
    productRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'p1', business: { id: 'b1' } }),
      update: jest.fn(),
    };
    businessRepo = { update: jest.fn() };
    orderRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Users), useValue: usersRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
      ],
    }).compile();
    service = module.get(ReviewService);
  });

  it('creates a verified review and recomputes product + business rating', async () => {
    orderRepo.findOne.mockResolvedValue({ id: 'o1' }); // verified purchase
    reviewRepo.findOne.mockResolvedValue(null); // no prior review

    const res = await service.create('u1', 'p1', { rating: 5, comment: 'Yum' });
    expect(res.id).toBe('rev1');
    expect(productRepo.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ reviewCount: 2 }),
    );
    expect(businessRepo.update).toHaveBeenCalledWith('b1', {
      rating: 4.5,
      reviewCount: 2,
    });
  });

  it('forbids reviewing an unpurchased product', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create('u1', 'p1', { rating: 5 } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a duplicate review', async () => {
    orderRepo.findOne.mockResolvedValue({ id: 'o1' });
    reviewRepo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create('u1', 'p1', { rating: 5 } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s for an unknown product', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create('u1', 'missing', { rating: 5 } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores images and flags the review as a verified purchase', async () => {
    orderRepo.findOne.mockResolvedValue({ id: 'o1' });
    reviewRepo.findOne.mockResolvedValue(null);
    const images = [{ url: 'http://cdn/x.jpg' }];
    const res = await service.create('u1', 'p1', { rating: 5, images } as any);
    expect(reviewRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ images, verifiedPurchase: true }),
    );
    expect(res.verifiedPurchase).toBe(true);
  });

  describe('addSellerReply', () => {
    const reviewOwnedBy = (bizId: string) => ({
      id: 'rev1',
      rating: 5,
      product: { id: 'p1', business: { id: bizId } },
    });

    it('lets the product owner reply', async () => {
      reviewRepo.findOne.mockResolvedValue(reviewOwnedBy('b1'));
      const res = await service.addSellerReply('b1', 'p1', 'rev1', 'Thanks!');
      expect(res.sellerReply).toBe('Thanks!');
      expect(res.sellerRepliedAt).toBeInstanceOf(Date);
      expect(reviewRepo.save).toHaveBeenCalled();
    });

    it('forbids a different business from replying (IDOR)', async () => {
      reviewRepo.findOne.mockResolvedValue(reviewOwnedBy('b1'));
      await expect(
        service.addSellerReply('b2', 'p1', 'rev1', 'Mine'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s an unknown review', async () => {
      reviewRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addSellerReply('b1', 'p1', 'nope', 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
