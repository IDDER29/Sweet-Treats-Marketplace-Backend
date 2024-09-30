// src/business/business.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Businesses as Business } from '../entities/businesses.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessOwners } from '../entities/businessOwners.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(BusinessOwners)
    private ownersRepository: Repository<BusinessOwners>,
  ) {}

  async createBusiness(
    createBusinessDto: CreateBusinessDto,
    ownerId: string,
  ): Promise<Business> {
    const owner = await this.ownersRepository.findOne({
      where: { owner_id: ownerId },
    });
    if (!owner) {
      throw new NotFoundException('Business owner not found');
    }

    const business = this.businessRepository.create({
      ...createBusinessDto,
      owner,
    });
    return this.businessRepository.save(business);
  }

  async getAllBusinesses(): Promise<Business[]> {
    return this.businessRepository.find({ relations: ['owner'] });
  }

  async getBusinessById(businessId: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { business_id: businessId },
      relations: ['owner'],
    });
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }
    return business;
  }

  async updateBusiness(
    businessId: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    const business = await this.getBusinessById(businessId);
    Object.assign(business, updateBusinessDto);
    return this.businessRepository.save(business);
  }

  async deleteBusiness(businessId: string): Promise<void> {
    const business = await this.getBusinessById(businessId);
    await this.businessRepository.remove(business);
  }
}
