import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity.ts';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() user: Partial<User>): Promise<User> {
    return this.usersService.register(user);
  }
}
