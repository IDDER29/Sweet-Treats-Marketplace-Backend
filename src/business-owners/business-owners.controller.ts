import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BusinessOwnersService } from './business-owners.service';
import { CreateBusinessOwnerDto } from './dto/create-business-owner.dto';
import { AuthGuard } from '@nestjs/passport'; // JWT Auth Guard
import { Logger } from '@nestjs/common';
import { isUUID } from 'class-validator'; // Import isUUID function
@Controller('business-owners')
export class BusinessOwnersController {
  private readonly logger = new Logger(BusinessOwnersController.name);
  constructor(private readonly businessOwnersService: BusinessOwnersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt')) // Only authenticated users can create a business owner
  async create(@Body() createBusinessOwnerDto: CreateBusinessOwnerDto) {
    return this.businessOwnersService.create(createBusinessOwnerDto);
  }

  @Get()
  async findAll() {
    return this.businessOwnersService.findAll();
  }
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Validate UUID format before passing it to the service
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid UUID format');
    }

    try {
      const owner = await this.businessOwnersService.findOne(id);
      if (!owner) {
        throw new NotFoundException(`Business owner with id ${id} not found`);
      }
      return owner;
    } catch (error) {
      this.logger.error(`Error fetching business owner with id ${id}`, error);
      // Handle known error types
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new InternalServerErrorException(
        'Failed to retrieve business owner',
      );
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt')) // Only authenticated users can update permissions
  async updatePermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string,
  ) {
    // Validate permissions input
    if (!permissions || typeof permissions !== 'string') {
      throw new BadRequestException(
        'Permissions must be a valid non-empty string',
      );
    }

    // Validate UUID format before calling the service
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid UUID format');
    }

    try {
      return await this.businessOwnersService.updatePermissions(
        id,
        permissions,
      );
    } catch (error) {
      this.logger.error(
        `Error updating permissions for business owner with id ${id}`,
        error,
      );

      // Handle known error types
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Business owner not found');
      }

      // Catch any unexpected errors and throw a generic error
      throw new InternalServerErrorException('Failed to update permissions');
    }
  }
}
