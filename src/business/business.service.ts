import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
  ) {}

  async registerBusiness(
    createBusinessDto: CreateBusinessDto,
  ): Promise<Business> {
    const business = this.businessRepository.create(createBusinessDto);
    return this.businessRepository.save(business);
  }
}
