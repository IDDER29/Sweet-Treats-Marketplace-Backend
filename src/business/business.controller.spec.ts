import { Test, TestingModule } from '@nestjs/testing';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('BusinessController', () => {
  let controller: BusinessController;
  let mockBusinessService: Partial<BusinessService>;

  beforeEach(async () => {
    mockBusinessService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      login: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [{ provide: BusinessService, useValue: mockBusinessService }],
    }).compile();

    controller = module.get<BusinessController>(BusinessController);
  });

  describe('register', () => {
    it('should throw an error if registration fails', async () => {
      const createBusinessDto: CreateBusinessDto = {
        email: 'test@example.com',
        password: 'password123',
        address: '123 Main St',
        businessName: 'Test Business',
      };

      (mockBusinessService.create as jest.Mock).mockRejectedValue(
        new Error('Email already exists'),
      );

      await expect(controller.register(createBusinessDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if business by ID is not found', async () => {
      (mockBusinessService.findById as jest.Mock).mockResolvedValue(undefined);

      await expect(controller.findById('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should throw NotFoundException if business by email is not found', async () => {
      mockBusinessService.findByEmail.mockResolvedValue(undefined);

      await expect(
        controller.findByEmail('non-existent-email@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if login credentials are incorrect', async () => {
      mockBusinessService.login.mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(
        controller.login('john.doe@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
