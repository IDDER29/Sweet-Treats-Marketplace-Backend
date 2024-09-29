// src/business-owners/business-owners.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BusinessOwnersService } from './business-owners.service';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { AuthGuard } from '@nestjs/passport'; // JWT Auth Guard

@Controller('business-owners')
export class BusinessOwnersController {
  constructor(private readonly businessOwnersService: BusinessOwnersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt')) // Only authenticated users can create a business owner
  async create(@Body() createBusinessOwnerDto: CreateBusinessOwnerDto) {
    return this.businessOwnersService.create(createBusinessOwnerDto);
  }

  @Get()
  async findAll() {
    return this.businessOwnersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.businessOwnersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updatePermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string,
  ) {
    return this.businessOwnersService.updatePermissions(id, permissions);
  }
}
