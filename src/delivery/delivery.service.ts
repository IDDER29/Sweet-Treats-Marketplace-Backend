import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DeliverySlot } from './entities/delivery-slot.entity';
import { Business } from '../business/entities/business.entity';
import { CreateDeliverySlotDto } from './dto/create-delivery-slot.dto';
import { UpdateDeliverySlotDto } from './dto/update-delivery-slot.dto';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliverySlot)
    private readonly slotRepository: Repository<DeliverySlot>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly dataSource: DataSource,
  ) {}

  async createSlot(
    businessId: string,
    dto: CreateDeliverySlotDto,
  ): Promise<DeliverySlot> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const slot = this.slotRepository.create({ ...dto, business });
    return this.slotRepository.save(slot);
  }

  async getSlotsForBusiness(
    businessId: string,
    date?: string,
  ): Promise<DeliverySlot[]> {
    const qb = this.slotRepository
      .createQueryBuilder('slot')
      .where('slot.business_id = :businessId', { businessId })
      .andWhere('slot.isActive = true');
    if (date) qb.andWhere('slot.date = :date', { date });
    qb.orderBy('slot.date', 'ASC').addOrderBy('slot.slotStart', 'ASC');
    return qb.getMany();
  }

  async updateSlot(
    businessId: string,
    slotId: string,
    dto: UpdateDeliverySlotDto,
  ): Promise<DeliverySlot> {
    const slot = await this.slotRepository.findOne({
      where: { id: slotId },
      relations: ['business'],
    });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.business.id !== businessId)
      throw new ForbiddenException('Not your slot');
    Object.assign(slot, dto);
    return this.slotRepository.save(slot);
  }

  // Called from OrderService checkout — atomic slot booking inside existing transaction
  async bookSlot(slotId: string, queryRunner: any): Promise<void> {
    const slot = await queryRunner.manager
      .getRepository(DeliverySlot)
      .createQueryBuilder('slot')
      .setLock('pessimistic_write')
      .where('slot.id = :id', { id: slotId })
      .getOne();

    if (!slot) throw new NotFoundException('Delivery slot not found');
    if (!slot.isActive)
      throw new BadRequestException('Delivery slot is not available');
    if (slot.bookedCount >= slot.capacity)
      throw new BadRequestException('Delivery slot is fully booked');

    slot.bookedCount += 1;
    await queryRunner.manager.save(DeliverySlot, slot);
  }

  // Called on order cancel to free the slot
  async releaseSlot(slotId: string): Promise<void> {
    await this.slotRepository
      .createQueryBuilder()
      .update(DeliverySlot)
      .set({ bookedCount: () => 'GREATEST(booked_count - 1, 0)' })
      .where('id = :id', { id: slotId })
      .execute();
  }
}
