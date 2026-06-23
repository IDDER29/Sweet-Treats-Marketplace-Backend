import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartCheckoutDto } from './dto/cart-checkout.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Request() req) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('items')
  addItem(@Request() req, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(req.user.userId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.userId, id, dto);
  }

  @Delete('items/:id')
  removeItem(@Request() req, @Param('id') id: string) {
    return this.cartService.removeItem(req.user.userId, id);
  }

  @Delete()
  clear(@Request() req) {
    return this.cartService.clear(req.user.userId);
  }

  @Post('checkout')
  checkout(@Request() req, @Body() dto: CartCheckoutDto) {
    return this.cartService.checkout(req.user.userId, dto);
  }
}
