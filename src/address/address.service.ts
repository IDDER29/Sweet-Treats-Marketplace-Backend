import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addressRepo.count({
      where: { user: { user_id: userId } },
    });
    // The first address, or an explicit isDefault, becomes the default.
    const makeDefault = dto.isDefault === true || count === 0;
    if (makeDefault) await this.unsetDefaults(userId);

    const address = this.addressRepo.create({
      ...dto,
      country: dto.country ?? 'GB',
      isDefault: makeDefault,
      user: { user_id: userId } as any,
    });
    return this.addressRepo.save(address);
  }

  findForUser(userId: string): Promise<Address[]> {
    return this.addressRepo.find({
      where: { user: { user_id: userId } },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOneOwned(userId: string, id: string): Promise<Address> {
    const address = await this.addressRepo.findOne({
      where: { id, user: { user_id: userId } },
    });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findOneOwned(userId, id);
    if (dto.isDefault === true) await this.unsetDefaults(userId);
    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    await this.findOneOwned(userId, id);
    await this.unsetDefaults(userId);
    await this.addressRepo.update(id, { isDefault: true });
    return this.findOneOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const address = await this.findOneOwned(userId, id);
    await this.addressRepo.remove(address);
    return { deleted: true };
  }

  private async unsetDefaults(userId: string): Promise<void> {
    await this.addressRepo
      .createQueryBuilder()
      .update(Address)
      .set({ isDefault: false })
      .where('user_id = :userId', { userId })
      .execute();
  }
}
