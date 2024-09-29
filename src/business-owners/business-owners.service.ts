// src/business-owners/business-owners.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessOwners } from '../entities/businessOwners.entity';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { Users } from '../entities/users.entity';

@Injectable()
export class BusinessOwnersService {
  constructor(
    @InjectRepository(BusinessOwners)
    private readonly businessOwnersRepository: Repository<BusinessOwners>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  // Create a new business owner from a user
  async create(
    createBusinessOwnerDto: CreateBusinessOwnerDto,
  ): Promise<BusinessOwners> {
    const { userId, permissions } = createBusinessOwnerDto;

    // Find the existing user and associate with business owner
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const newOwner = this.businessOwnersRepository.create({
      user,
      permissions,
    });
    return this.businessOwnersRepository.save(newOwner);
  }

  async findAll(): Promise<BusinessOwners[]> {
    return this.businessOwnersRepository.find({
      relations: ['user', 'businesses'],
    });
  }

  async findOne(id: string): Promise<BusinessOwners> {
    return this.businessOwnersRepository.findOne({
      where: { owner_id: id },
      relations: ['user', 'businesses'],
    });
  }

  async updatePermissions(
    ownerId: string,
    permissions: string,
  ): Promise<BusinessOwners> {
    const owner = await this.findOne(ownerId);
    owner.permissions = permissions;
    return this.businessOwnersRepository.save(owner);
  }
}
