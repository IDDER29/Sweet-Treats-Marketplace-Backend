import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { ShopFollow } from './entities/shop-follow.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoriteRepo: any;
  let followRepo: any;
  let productRepo: any;
  let businessRepo: any;
  let bumpExec: jest.Mock;

  beforeEach(async () => {
    bumpExec = jest.fn().mockResolvedValue({});
    favoriteRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'f1', ...x })),
      remove: jest.fn(),
    };
    followRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 's1', ...x })),
      remove: jest.fn(),
    };
    productRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        update: () => ({
          set: () => ({ where: () => ({ execute: bumpExec }) }),
        }),
      })),
    };
    businessRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favoriteRepo },
        { provide: getRepositoryToken(ShopFollow), useValue: followRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  it('adds a favorite and bumps the count (only when new)', async () => {
    productRepo.findOne.mockResolvedValue({ id: 'p1' });
    favoriteRepo.findOne.mockResolvedValue(null);
    const res = await service.addProduct('u1', 'p1');
    expect(res).toEqual({ favorited: true });
    expect(favoriteRepo.save).toHaveBeenCalled();
    expect(bumpExec).toHaveBeenCalledTimes(1);
  });

  it('add is idempotent (no double count) when already favorited', async () => {
    productRepo.findOne.mockResolvedValue({ id: 'p1' });
    favoriteRepo.findOne.mockResolvedValue({ id: 'f1' });
    const res = await service.addProduct('u1', 'p1');
    expect(res).toEqual({ favorited: true });
    expect(favoriteRepo.save).not.toHaveBeenCalled();
    expect(bumpExec).not.toHaveBeenCalled();
  });

  it('404s favoriting an unknown product', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(service.addProduct('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes a favorite and decrements only when it existed', async () => {
    favoriteRepo.findOne.mockResolvedValue({ id: 'f1' });
    const res = await service.removeProduct('u1', 'p1');
    expect(res).toEqual({ favorited: false });
    expect(favoriteRepo.remove).toHaveBeenCalled();
    expect(bumpExec).toHaveBeenCalledTimes(1);
  });

  it('remove is a no-op when not favorited', async () => {
    favoriteRepo.findOne.mockResolvedValue(null);
    await service.removeProduct('u1', 'p1');
    expect(favoriteRepo.remove).not.toHaveBeenCalled();
    expect(bumpExec).not.toHaveBeenCalled();
  });

  it('follows a shop (idempotent) and 404s unknown shops', async () => {
    businessRepo.findOne.mockResolvedValue({ id: 'b1' });
    followRepo.findOne.mockResolvedValue(null);
    expect(await service.followShop('u1', 'b1')).toEqual({ following: true });
    expect(followRepo.save).toHaveBeenCalled();

    businessRepo.findOne.mockResolvedValue(null);
    await expect(service.followShop('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists favorites + follows', async () => {
    favoriteRepo.find.mockResolvedValue([
      {
        product: {
          id: 'p1',
          name: 'Cake',
          price: '10',
          rating: '5',
          images: [],
        },
      },
    ]);
    followRepo.find.mockResolvedValue([
      { business: { id: 'b1', slug: 's', businessName: 'Shop', rating: '4' } },
    ]);
    const res = await service.list('u1');
    expect(res.products[0]).toMatchObject({ id: 'p1', price: 10 });
    expect(res.shops[0]).toMatchObject({ id: 'b1', rating: 4 });
  });
});
