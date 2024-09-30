import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessOwners } from '../entities/businessOwners.entity';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { Users } from '../entities/users.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class BusinessOwnersService {
  private readonly logger = new Logger(BusinessOwnersService.name);

  constructor(
    @InjectRepository(BusinessOwners)
    private readonly businessOwnersRepository: Repository<BusinessOwners>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}

  async create(
    createBusinessOwnerDto: CreateBusinessOwnerDto,
  ): Promise<BusinessOwners> {
    const { userId, permissions } = createBusinessOwnerDto;

    try {
      // Input validation for permissions
      if (!permissions || typeof permissions !== 'string') {
        throw new BadRequestException('Permissions must be a valid string');
      }

      // Find the existing user and associate with business owner
      const user = await this.usersRepository.findOne({
        where: { user_id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Ensure the user is not already a business owner
      const existingOwner = await this.businessOwnersRepository.findOne({
        where: { user },
      });
      if (existingOwner) {
        throw new ConflictException('User is already a business owner');
      }

      const newOwner = this.businessOwnersRepository.create({
        user,
        permissions,
      });
      return await this.businessOwnersRepository.save(newOwner);
    } catch (error) {
      this.logger.error('Failed to create business owner', error);
      throw new InternalServerErrorException('Failed to create business owner');
    }
  }

  async findAll(): Promise<BusinessOwners[]> {
    try {
      return await this.businessOwnersRepository.find({
        relations: ['user', 'businesses'],
      });
    } catch (error) {
      this.logger.error('Failed to retrieve business owners', error);
      throw new InternalServerErrorException(
        'Failed to retrieve business owners',
      );
    }
  }
  async findOne(id: string): Promise<BusinessOwners | null> {
    try {
      const owner = await this.businessOwnersRepository.findOne({
        where: { owner_id: id },
        relations: ['user', 'businesses'],
      });

      return owner || null; // Return null if owner is not found
    } catch (error) {
      this.logger.error(
        `Failed to retrieve business owner with id ${id}`,
        error,
      );
      // This may occur if a UUID is malformed in a way that doesn't throw a validation error.
      throw new InternalServerErrorException(
        'Failed to retrieve business owner',
      );
    }
  }

  async updatePermissions(
    ownerId: string,
    permissions: string,
  ): Promise<BusinessOwners> {
    // Validate the permissions against predefined values
    const validPermissions = ['read', 'edit', 'delete']; // Example of valid permissions
    if (!validPermissions.includes(permissions)) {
      throw new BadRequestException(
        `Permissions must be one of the following: ${validPermissions.join(', ')}`,
      );
    }

    try {
      const owner = await this.findOne(ownerId);

      // If the owner does not exist, return null (handled in controller)
      if (!owner) {
        throw new NotFoundException(
          `Business owner with id ${ownerId} not found`,
        );
      }

      owner.permissions = permissions;
      return await this.businessOwnersRepository.save(owner);
    } catch (error) {
      this.logger.error(
        `Failed to update permissions for business owner with id ${ownerId}`,
        error,
      );

      // Re-throw the error if it's a known type
      if (error instanceof NotFoundException) {
        throw error; // Propagate the NotFoundException
      }

      // Handle any unexpected errors
      throw new InternalServerErrorException('Failed to update permissions');
    }
  }
}
