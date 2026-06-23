import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateAddressDto) {
    return this.addressService.create(req.user.userId, dto);
  }

  @Get()
  list(@Request() req) {
    return this.addressService.findForUser(req.user.userId);
  }

  @Get(':id')
  get(@Request() req, @Param('id') id: string) {
    return this.addressService.findOneOwned(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.update(req.user.userId, id, dto);
  }

  @Post(':id/default')
  setDefault(@Request() req, @Param('id') id: string) {
    return this.addressService.setDefault(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.addressService.remove(req.user.userId, id);
  }
}
