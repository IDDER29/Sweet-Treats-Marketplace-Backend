import { Test, TestingModule } from '@nestjs/testing';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Business } from './entities/business.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BusinessController', () => {
  let controller: BusinessController;
  let service: BusinessService;

  const mockBusinessService = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        {
          provide: BusinessService,
          useValue: mockBusinessService,
        },
      ],
    }).compile();

    controller = module.get<BusinessController>(BusinessController);
    service = module.get<BusinessService>(BusinessService);
  });

  describe('register', () => {
    it('should successfully register a business', async () => {
      const createBusinessDto: CreateBusinessDto = {
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Bakery",
        email: 'john@example.com',
        password: 'password123',
        businessType: 'bakery',
        address: '123 Baker St, City, State, ZIP',
        phoneNumber: '+1234567890',
        agreeToTerms: true,
      };
      const { firstName, lastName, businessName, email } = createBusinessDto;

      const result: {
        message: string;
        business: { id; firstName; lastName; businessName; email };
      } = {
        message: 'Business registration successful',
        business: {
          id: 'uuid',
          firstName,
          lastName,
          businessName,
          email,
        },
      };

      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.register(createBusinessDto)).toBe(result);
    });

    it('should throw a ConflictException if a business with the email already exists', async () => {
      const createBusinessDto: CreateBusinessDto = {
        firstName: 'Jane',
        lastName: 'Doe',
        businessName: "Jane's Bakery",
        email: 'jane@example.com',
        password: 'password123',
        businessType: 'bakery',
        address: '123 Baker St, City, State, ZIP',
        phoneNumber: '+1234567890',
        agreeToTerms: true,
      };

      jest
        .spyOn(service, 'create')
        .mockRejectedValue(
          new ConflictException('A business with this email already exists.'),
        );

      await expect(controller.register(createBusinessDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findById', () => {
    it('should return a business by ID', async () => {
      const id = 'uuid';
      const result: Business = {
        id,
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Bakery",
        email: 'john@example.com',
        password: 'hashedpassword',
        businessType: 'bakery',
        address: '123 Baker St, City, State, ZIP',
        phoneNumber: '+1234567890',
        agreeToTerms: true,
      };

      jest.spyOn(service, 'findById').mockResolvedValue(result);

      expect(await controller.findById(id)).toBe(result);
    });

    it('should throw a NotFoundException if the business is not found', async () => {
      const id = 'uuid';

      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(
          new NotFoundException(`Business with ID ${id} not found`),
        );

      await expect(controller.findById(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a business by email', async () => {
      const email = 'john@example.com';
      const result: Business = {
        id: 'uuid',
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Bakery",
        email,
        password: 'hashedpassword',
        businessType: 'bakery',
        address: '123 Baker St, City, State, ZIP',
        phoneNumber: '+1234567890',
        agreeToTerms: true,
      };

      jest.spyOn(service, 'findByEmail').mockResolvedValue(result);

      expect(await controller.findByEmail(email)).toBe(result);
    });

    it('should throw a NotFoundException if the business is not found', async () => {
      const email = 'nonexistent@example.com';

      jest
        .spyOn(service, 'findByEmail')
        .mockRejectedValue(
          new NotFoundException(`Business with email ${email} not found`),
        );

      await expect(controller.findByEmail(email)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('login', () => {
    it('should return a business when login is successful', async () => {
      const email = 'john@example.com';
      const password = 'password123';
      const result: Business = {
        id: 'uuid',
        firstName: 'John',
        lastName: 'Doe',
        businessName: "John's Bakery",
        email,
        password: 'hashedpassword',
        businessType: 'bakery',
        address: '123 Baker St, City, State, ZIP',
        phoneNumber: '+1234567890',
        agreeToTerms: true,
      };

      jest.spyOn(service, 'login').mockResolvedValue(result);

      expect(await controller.login(email, password)).toBe(result);
    });

    it('should throw a NotFoundException if login fails', async () => {
      const email = 'john@example.com';
      const password = 'wrongpassword';

      jest
        .spyOn(service, 'login')
        .mockRejectedValue(new NotFoundException('Invalid credentials'));

      await expect(controller.login(email, password)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
