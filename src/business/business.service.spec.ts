import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { Repository } from 'typeorm';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateBusinessDto } from './dto/create-business.dto';

describe('BusinessService', () => {
  let service: BusinessService;
  let repository: Repository<Business>;

  const mockBusiness: Business = {
    id: 'some-uuid',
    firstName: 'John',
    lastName: 'Doe',
    businessName: "John's Shop",
    email: 'john@example.com',
    password: 'hashedPassword',
    businessType: 'Retail',
    address: '123 Main St',
    phoneNumber: '1234567890',
    agreeToTerms: true,
  };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    repository = module.get<Repository<Business>>(getRepositoryToken(Business));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a new business', async () => {
      const dto: CreateBusinessDto = {
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Shop",
        email: 'john@example.com',
        password: 'password123',
        businessType: 'Retail',
        address: '123 Main St',
        phoneNumber: '1234567890',
        agreeToTerms: true,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(repository, 'save').mockResolvedValueOnce(mockBusiness);
      jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashedPassword');

      const result = await service.create(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(repository.save).toHaveBeenCalledWith({
        ...dto,
        password: 'hashedPassword',
      });
      expect(result).toEqual({
        id: mockBusiness.id,
        firstName: mockBusiness.firstName,
        lastName: mockBusiness.lastName,
        businessName: mockBusiness.businessName,
        email: mockBusiness.email,
      });
    });

    it('should throw a ConflictException if business already exists', async () => {
      const dto: CreateBusinessDto = {
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Shop",
        email: 'john@example.com',
        password: 'password123',
        businessType: 'Retail',
        address: '123 Main St',
        phoneNumber: '1234567890',
        agreeToTerms: true,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockBusiness);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
    });

    it('should throw a BadRequestException if terms are not agreed to', async () => {
      const dto: CreateBusinessDto = {
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Shop",
        email: 'john@example.com',
        password: 'password123',
        businessType: 'Retail',
        address: '123 Main St',
        phoneNumber: '1234567890',
        agreeToTerms: false,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should successfully login a business', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockBusiness);
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const result = await service.login(mockBusiness.email, 'password123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: mockBusiness.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        mockBusiness.password,
      );
      expect(result).toEqual({
        message: 'Login successful',
        firstName: mockBusiness.firstName,
        lastName: mockBusiness.lastName,
        businessName: mockBusiness.businessName,
        email: mockBusiness.email,
      });
    });

    it('should throw a NotFoundException for invalid credentials', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockBusiness);
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);

      await expect(
        service.login(mockBusiness.email, 'wrongpassword'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw a BadRequestException if password is missing', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockBusiness);

      await expect(service.login(mockBusiness.email, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
