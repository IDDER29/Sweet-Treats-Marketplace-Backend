import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Users } from '../entities/users.entity';
import { Order } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { VerifyHygieneDto } from './dto/verify-hygiene.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getDashboard() {
    const [totalUsers, totalBusinesses, totalOrders, activeBusinesses, suspendedBusinesses] =
      await Promise.all([
        this.usersRepository.count(),
        this.businessRepository.count(),
        this.orderRepository.count(),
        this.businessRepository.count({ where: { isSuspended: false } }),
        this.businessRepository.count({ where: { isSuspended: true } }),
      ]);

    return {
      totalUsers,
      totalBusinesses,
      totalOrders,
      activeBusinesses,
      suspendedBusinesses,
    };
  }

  async getAllBusinesses(page = 1, limit = 20) {
    const [businesses, total] = await this.businessRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = businesses.map((b) => {
      const { password, ...rest } = b as any;
      return rest;
    });

    return { data, total, page, limit };
  }

  async getBusinessById(id: string) {
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    const { password, ...rest } = business as any;
    return rest;
  }

  async suspendBusiness(id: string, reason: string) {
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    business.isSuspended = true;
    business.suspensionReason = reason;
    return this.businessRepository.save(business);
  }

  async unsuspendBusiness(id: string) {
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    business.isSuspended = false;
    business.suspensionReason = null;
    return this.businessRepository.save(business);
  }

  async verifyHygieneCert(id: string, dto: VerifyHygieneDto) {
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    if (dto.hygieneCertificateNumber !== undefined) {
      business.hygieneCertificateNumber = dto.hygieneCertificateNumber;
    }
    if (dto.hygieneCertificateExpiry !== undefined) {
      business.hygieneCertificateExpiry = dto.hygieneCertificateExpiry;
    }
    business.hygieneCertificateVerified = dto.verified;
    return this.businessRepository.save(business);
  }

  async getAllUsers(page = 1, limit = 20) {
    const [users, total] = await this.usersRepository.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = users.map((u) => {
      const { password, ...rest } = u as any;
      return rest;
    });

    return { data, total, page, limit };
  }

  async getAllOrders(page = 1, limit = 20) {
    const [orders, total] = await this.orderRepository.findAndCount({
      relations: ['customer', 'business'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: orders, total, page, limit };
  }
}
