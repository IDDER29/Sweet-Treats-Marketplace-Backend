// src/business/business.controller.ts

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  /**
   * Create a new business for the authenticated owner
   * @param createBusinessDto Business creation payload
   * @param req HTTP request object containing the authenticated user
   * @returns Created Business object
   */
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBusiness(
    @Body() createBusinessDto: CreateBusinessDto,
    @Request() req,
  ) {
    const ownerId = req.user.userId; // Extract owner ID from the authenticated user
    return this.businessService.createBusiness(createBusinessDto, ownerId);
  }

  /**
   * Retrieve all businesses
   * @returns List of all businesses
   */
  @UseGuards(AuthGuard('jwt'))
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllBusinesses() {
    return this.businessService.getAllBusinesses();
  }

  /**
   * Retrieve a specific business by ID
   * @param businessId Business UUID
   * @returns Business object if found
   */
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getBusinessById(@Param('id') businessId: string) {
    return this.businessService.getBusinessById(businessId);
  }

  /**
   * Update a specific business by ID
   * @param businessId Business UUID
   * @param updateBusinessDto Update payload
   * @returns Updated Business object
   */
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateBusiness(
    @Param('id') businessId: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ) {
    return this.businessService.updateBusiness(businessId, updateBusinessDto);
  }

  /**
   * Delete a business by ID
   * @param businessId Business UUID
   * @returns Void if deletion was successful
   */
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBusiness(@Param('id') businessId: string) {
    await this.businessService.deleteBusiness(businessId);
  }
}
