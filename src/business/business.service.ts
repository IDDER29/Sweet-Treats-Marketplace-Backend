import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Business } from './entities/business.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BusinessService {
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(
    createBusinessDto: CreateBusinessDto,
  ): Promise<{ message: string; business: Partial<Business> }> {
    try {
      const { email, password, agreeToTerms } = createBusinessDto;

      // Check for existing business by email
      const existingBusiness = await this.businessRepository.findOne({
        where: { email },
      });
      if (existingBusiness) {
        throw new ConflictException(
          'A business with this email already exists.',
        );
      }

      // Ensure the terms are agreed upon
      if (!agreeToTerms) {
        throw new BadRequestException(
          'You must agree to the terms to register.',
        );
      }

      // Hash the password securely
      const hashedPassword = await bcrypt.hash(password, this.saltRounds);

      // Prepare business entity with hashed password
      const business = this.businessRepository.create({
        ...createBusinessDto,
        password: hashedPassword,
      });

      // Save the business entity
      const savedBusiness = await this.businessRepository.save(business);

      // Return only safe data (excluding password) along with a success message
      const {
        id,
        firstName,
        lastName,
        businessName,
        email: savedEmail,
      } = savedBusiness;
      return {
        message: 'Business registration successful',
        business: { id, firstName, lastName, businessName, email: savedEmail },
      };
    } catch (error) {
      // Handle specific exceptions explicitly
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      // Propagate unknown errors as internal server errors
      throw new InternalServerErrorException(
        'An error occurred while creating the business.',
      );
    }
  }

  async findById(id: string): Promise<Partial<Business>> {
    if (!this.isUUID(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const business = await this.businessRepository.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // Return safe data excluding sensitive fields

    return business;
  }

  async findByEmail(email: string): Promise<Partial<Business>> {
    const business = await this.businessRepository.findOne({
      where: { email },
    });
    if (!business) {
      throw new NotFoundException(`Business with email ${email} not found`);
    }

    // Return safe data excluding sensitive fields

    return business;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ message: string; business: Partial<Business> }> {
    const business = await this.businessRepository.findOne({
      where: { email },
    });

    // Check if the password is provided and if the business entity contains a hashed password
    if (!password || !business.password) {
      throw new BadRequestException('Invalid login credentials');
    }

    // Compare the provided password with the stored hashed password
    const isPasswordMatching = await bcrypt.compare(
      password,
      business.password,
    );

    if (!isPasswordMatching) {
      throw new NotFoundException('Invalid credentials');
    }

    // Return safe data excluding sensitive fields along with a success message
    return {
      message: 'Login successful asds',
      business: business,
    };
  }

  private isUUID(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
