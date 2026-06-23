import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../product/entities/product.entity';
import { OrderService } from '../order/order.service';

describe('CartService', () => {
  let service: CartService;
  let cartRepo: any;
  let itemRepo: any;
  let productRepo: any;
  let orderService: { checkout: jest.Mock };

  const prod = (id: string, businessId: string, price = 10) => ({
    id,
    name: `P-${id}`,
    price,
    business: { id: businessId },
  });

  beforeEach(async () => {
    const cart: any = { id: 'cart1', items: [] };
    cartRepo = {
      findOne: jest.fn().mockImplementation(async () => cart),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'cart1', items: [], ...x })),
    };
    itemRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => {
        // simulate persistence into the in-memory cart
        if (!x.id) {
          x.id = `item-${cart.items.length + 1}`;
          cart.items.push({
            id: x.id,
            quantity: x.quantity,
            product: productRepo._byId[x.product.id],
          });
        }
        return x;
      }),
      remove: jest.fn(async (items) => {
        const arr = Array.isArray(items) ? items : [items];
        cart.items = cart.items.filter(
          (i: any) => !arr.find((r: any) => r.id === i.id),
        );
      }),
    };
    productRepo = {
      _byId: {} as Record<string, any>,
      findOne: jest.fn(async ({ where: { id } }: any) => productRepo._byId[id]),
    };
    orderService = { checkout: jest.fn().mockResolvedValue({ id: 'order1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: cartRepo },
        { provide: getRepositoryToken(CartItem), useValue: itemRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: OrderService, useValue: orderService },
      ],
    }).compile();
    service = module.get(CartService);
  });

  it('adds an item and computes totals from the live price', async () => {
    productRepo._byId['p1'] = prod('p1', 'b1', 12.5);
    const res = await service.addItem('u1', { productId: 'p1', quantity: 2 });
    expect(res.itemCount).toBe(2);
    expect(res.subtotal).toBe(25);
    expect(res.businessId).toBe('b1');
    expect(res.items[0]).toMatchObject({ productId: 'p1', lineTotal: 25 });
  });

  it('increments quantity when the same product is added again', async () => {
    productRepo._byId['p1'] = prod('p1', 'b1', 10);
    await service.addItem('u1', { productId: 'p1', quantity: 1 });
    const res = await service.addItem('u1', { productId: 'p1', quantity: 2 });
    expect(res.items).toHaveLength(1);
    expect(res.itemCount).toBe(3);
  });

  it('rejects mixing items from a second business', async () => {
    productRepo._byId['p1'] = prod('p1', 'b1');
    productRepo._byId['p2'] = prod('p2', 'b2');
    await service.addItem('u1', { productId: 'p1', quantity: 1 });
    await expect(
      service.addItem('u1', { productId: 'p2', quantity: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects adding an unknown product', async () => {
    await expect(
      service.addItem('u1', { productId: 'missing', quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks out the cart via OrderService then empties it', async () => {
    productRepo._byId['p1'] = prod('p1', 'b1', 10);
    await service.addItem('u1', { productId: 'p1', quantity: 2 });
    const order = await service.checkout('u1', { deliveryAddress: '1 St' });
    expect(orderService.checkout).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        items: [{ productId: 'p1', quantity: 2 }],
        deliveryAddress: '1 St',
      }),
    );
    expect(order).toEqual({ id: 'order1' });
    const after = await service.getCart('u1');
    expect(after.itemCount).toBe(0);
  });

  it('rejects checkout of an empty cart', async () => {
    await expect(service.checkout('u1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
