import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Business } from './entities/business.entity';
import { RefreshTokenService } from '../auth/refresh-token.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BusinessService {
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenService,
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

    delete business.password;
    return business;
  }

  async findByEmail(email: string): Promise<Partial<Business>> {
    const business = await this.businessRepository.findOne({
      where: { email },
    });
    if (!business) {
      throw new NotFoundException(`Business with email ${email} not found`);
    }

    delete business.password;
    return business;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    message: string;
    token: string;
    refreshToken?: string;
    business: Partial<Business>;
  }> {
    const business = await this.businessRepository.findOne({
      where: { email },
    });

    // Guard against null business before accessing properties
    if (!business) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signAccessToken(business.id);
    // Same model as user auth: short-lived access token + rotating refresh token.
    const refreshToken = await this.refreshTokens.issue(
      business.id,
      'business',
    );

    const {
      id,
      firstName,
      lastName,
      businessName,
      email: businessEmail,
    } = business;

    return {
      message: 'Login successful',
      token,
      refreshToken: refreshToken ?? undefined,
      business: { id, firstName, lastName, businessName, email: businessEmail },
    };
  }

  // Exchange a valid business refresh token for a new access + refresh pair.
  // The refresh token is single-use and kind-checked so a user token can't be
  // redeemed here.
  async refreshSession(refreshToken: string) {
    const rotated = await this.refreshTokens.rotate(refreshToken, 'business');
    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const business = await this.businessRepository.findOne({
      where: { id: rotated.userId },
    });
    if (!business) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return {
      token: this.signAccessToken(business.id),
      refreshToken: rotated.token,
    };
  }

  async logout(refreshToken: string) {
    await this.refreshTokens.revoke(refreshToken);
    return { message: 'Logged out' };
  }

  private signAccessToken(businessId: string): string {
    return this.jwtService.sign({ businessId, role: 'BUSINESS' });
  }

  private isUUID(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
