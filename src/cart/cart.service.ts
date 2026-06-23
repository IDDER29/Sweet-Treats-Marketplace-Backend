import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../product/entities/product.entity';
import { OrderService } from '../order/order.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartCheckoutDto } from './dto/cart-checkout.dto';

const CART_RELATIONS = ['items', 'items.product', 'items.product.business'];

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly itemRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly orderService: OrderService,
  ) {}

  private async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { user: { user_id: userId } },
      relations: CART_RELATIONS,
    });
    if (!cart) {
      cart = await this.cartRepo.save(
        this.cartRepo.create({ user: { user_id: userId } as any }),
      );
      cart.items = [];
    }
    return cart;
  }

  async getCart(userId: string) {
    return this.serialize(await this.getOrCreateCart(userId));
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
      relations: ['business'],
    });
    if (!product) throw new NotFoundException('Product not found');

    const cart = await this.getOrCreateCart(userId);

    // One order maps to exactly one business, so a checkoutable cart must too.
    const cartBusinessId = cart.items?.[0]?.product?.business?.id;
    if (
      cartBusinessId &&
      product.business?.id &&
      cartBusinessId !== product.business.id
    ) {
      throw new BadRequestException(
        'Your cart already contains items from another shop. Clear it first.',
      );
    }

    const existing = cart.items?.find((i) => i.product.id === product.id);
    if (existing) {
      existing.quantity += dto.quantity;
      await this.itemRepo.save(existing);
    } else {
      await this.itemRepo.save(
        this.itemRepo.create({
          cart: { id: cart.id } as any,
          product: { id: product.id } as any,
          quantity: dto.quantity,
        }),
      );
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.findOwnedItem(userId, itemId);
    item.quantity = dto.quantity;
    await this.itemRepo.save(item);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.findOwnedItem(userId, itemId);
    await this.itemRepo.remove(item);
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    if (cart.items?.length) await this.itemRepo.remove(cart.items);
    return this.getCart(userId);
  }

  // Checkout the cart through the normal order path (server-recomputed totals,
  // stock locks, etc.), then empty it.
  async checkout(userId: string, dto: CartCheckoutDto) {
    const cart = await this.getOrCreateCart(userId);
    if (!cart.items?.length) throw new BadRequestException('Cart is empty');

    const order = await this.orderService.checkout(userId, {
      items: cart.items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
      ...dto,
    } as any);

    await this.itemRepo.remove(cart.items);
    return order;
  }

  private async findOwnedItem(
    userId: string,
    itemId: string,
  ): Promise<CartItem> {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items?.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }

  private serialize(cart: Cart) {
    const items = (cart.items ?? []).map((i) => {
      const unitPrice = Number(i.product.price);
      return {
        id: i.id,
        productId: i.product.id,
        name: i.product.name,
        unitPrice,
        quantity: i.quantity,
        lineTotal: Number((unitPrice * i.quantity).toFixed(2)),
        businessId: i.product.business?.id ?? null,
      };
    });
    const subtotal = Number(
      items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2),
    );
    return {
      id: cart.id,
      businessId: items[0]?.businessId ?? null,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      subtotal,
      items,
    };
  }
}
