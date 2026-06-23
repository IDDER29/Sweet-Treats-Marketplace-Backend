import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShopService } from './shop.service';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';

describe('ShopService', () => {
  let service: ShopService;
  let businessRepo: any;
  let productRepo: any;

  const biz = (over: any = {}) => ({
    id: 'b1',
    slug: 'janes-cakes',
    businessName: 'Janes Cakes',
    businessType: 'bakery',
    rating: '4.50',
    reviewCount: 8,
    isSuspended: false,
    isAcceptingOrders: true,
    hygieneCertificateVerified: true,
    password: 'secret-hash',
    ...over,
  });

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    productRepo = { find: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
      ],
    }).compile();
    service = module.get(ShopService);
  });

  describe('getBySlug', () => {
    it('404s for an unknown or suspended shop', async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      businessRepo.findOne.mockResolvedValue(biz({ isSuspended: true }));
      await expect(service.getBySlug('janes-cakes')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a public profile + active catalog, never the password', async () => {
      businessRepo.findOne.mockResolvedValue(biz());
      productRepo.find.mockResolvedValue([
        {
          id: 'p1',
          name: 'Cake',
          price: '25.00',
          rating: '5.00',
          reviewCount: 3,
          images: [],
          isActive: true,
        },
      ]);
      const res: any = await service.getBySlug('janes-cakes');
      expect(res.slug).toBe('janes-cakes');
      expect(res.rating).toBe(4.5);
      expect((res as any).password).toBeUndefined();
      expect(res.products).toHaveLength(1);
      expect(res.products[0].price).toBe(25);
    });
  });

  describe('browse', () => {
    it('returns a paginated list of public profiles', async () => {
      const qb: any = {
        where: () => qb,
        andWhere: () => qb,
        orderBy: () => qb,
        addOrderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getManyAndCount: jest.fn().mockResolvedValue([[biz()], 1]),
      };
      businessRepo.createQueryBuilder.mockReturnValue(qb);
      const res = await service.browse({ page: 1, limit: 20 });
      expect(res.total).toBe(1);
      expect(res.data[0]).toMatchObject({ slug: 'janes-cakes', rating: 4.5 });
      expect((res.data[0] as any).password).toBeUndefined();
    });
  });
});
