import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Business } from './entities/business.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    try {
      const existingBusiness = await this.businessRepository.findOne({
        where: { email: createBusinessDto.email },
      });

      if (existingBusiness) {
        throw new ConflictException(
          'A business with this email already exists.',
        );
      }

      const business = this.businessRepository.create(createBusinessDto);
      business.password = await bcrypt.hash(business.password, 10);

      return await this.businessRepository.save(business);
    } catch (error) {
      throw new InternalServerErrorException(
        'An error occurred while creating the business.',
      );
    }
  }

  async findById(id: string): Promise<Business> {
    // Check if the ID is valid UUID format
    if (!this.isUUID(id)) {
      throw new NotFoundException(`Invalid ID format`);
    }
    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  async findByEmail(email: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { email },
    });
    if (!business) {
      throw new NotFoundException(`Business with email ${email} not found`);
    }
    return business;
  }

  async login(email: string, password: string): Promise<Business> {
    const business = await this.findByEmail(email);
    const isPasswordMatching = await bcrypt.compare(
      password,
      business.password,
    );

    if (!isPasswordMatching) {
      throw new NotFoundException('Invalid credentials');
    }

    return business;
  }

  private isUUID(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
