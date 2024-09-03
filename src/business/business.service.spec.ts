import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { BusinessService } from './business.service';
import { Business } from './entities/business.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import * as bcrypt from 'bcrypt';

describe('BusinessService', () => {
  let service: BusinessService;
  let repository: Repository<Business>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: getRepositoryToken(Business),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    repository = module.get<Repository<Business>>(getRepositoryToken(Business));
  });

  it('should create a new business', async () => {
    const createBusinessDto: CreateBusinessDto = {
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: 'securepassword123',
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: true,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
    jest.spyOn(repository, 'save').mockResolvedValue({
      ...createBusinessDto,
      id: 'some-uuid',
      password: 'hashedPassword',
    });

    const result = await service.create(createBusinessDto);

    expect(result).toEqual({
      statusCode: 201,
      message: 'Business registration successful',
      data: {
        message: 'Business registration successful',
        business: {
          id: 'some-uuid',
          firstName: 'John',
          lastName: 'Doe',
          businessName: 'Doe Enterprises',
          email: 'john.doe@example.com',
        },
      },
    });
  });

  it('should throw ConflictException if business already exists', async () => {
    const createBusinessDto: CreateBusinessDto = {
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: 'securepassword123',
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: true,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue({
      ...createBusinessDto,
      id: 'some-uuid',
      password: 'hashedPassword',
    });

    await expect(service.create(createBusinessDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw BadRequestException if terms are not agreed', async () => {
    const createBusinessDto: CreateBusinessDto = {
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: 'securepassword123',
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: false, // Terms not agreed
    };

    await expect(service.create(createBusinessDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should find a business by ID', async () => {
    const business: Business = {
      id: 'some-uuid',
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: 'hashedPassword',
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: true,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue(business);

    const result = await service.findById('some-uuid');

    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
    });
  });

  it('should throw NotFoundException if business by ID is not found', async () => {
    jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);

    await expect(service.findById('non-existent-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should login business with correct credentials', async () => {
    const business: Business = {
      id: 'some-uuid',
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: 'hashedPassword',
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: true,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue(business);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await service.login(
      'john.doe@example.com',
      'securepassword123',
    );

    expect(result).toEqual({
      message: 'Login successful',
      business: {
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Doe Enterprises',
        email: 'john.doe@example.com',
      },
    });
  });

  it('should throw NotFoundException if login credentials are incorrect', async () => {
    jest.spyOn(repository, 'findOne').mockResolvedValue(null);

    await expect(
      service.login('john.doe@example.com', 'wrongpassword'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if password is missing during login', async () => {
    const business: Business = {
      id: 'some-uuid',
      firstName: 'John',
      lastName: 'Doe',
      businessName: 'Doe Enterprises',
      email: 'john.doe@example.com',
      password: null, // Password is missing
      businessType: 'Retail',
      address: '123 Main St',
      phoneNumber: '123-456-7890',
      agreeToTerms: true,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue(business);

    await expect(
      service.login('john.doe@example.com', 'securepassword123'),
    ).rejects.toThrow(BadRequestException);
  });
});
