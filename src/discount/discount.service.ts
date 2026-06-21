import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountCode, DiscountType } from './entities/discount-code.entity';
import { DiscountCodeUsage } from './entities/discount-code-usage.entity';
import { Business } from '../business/entities/business.entity';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';
import { ValidateDiscountDto } from './dto/validate-discount.dto';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(DiscountCode)
    private readonly discountRepository: Repository<DiscountCode>,
    @InjectRepository(DiscountCodeUsage)
    private readonly usageRepository: Repository<DiscountCodeUsage>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(
    businessId: string,
    dto: CreateDiscountCodeDto,
  ): Promise<DiscountCode> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const code = dto.code.toUpperCase().trim();
    const existing = await this.discountRepository.findOne({ where: { code } });
    if (existing) throw new BadRequestException('Discount code already exists');

    const discount = this.discountRepository.create({
      ...dto,
      code,
      business,
      validFrom: new Date(dto.validFrom),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });
    return this.discountRepository.save(discount);
  }

  async findForBusiness(businessId: string) {
    return this.discountRepository.find({
      where: { business: { id: businessId } },
      order: { createdAt: 'DESC' },
    });
  }

  async validate(dto: ValidateDiscountDto, userId?: string) {
    const code = dto.code.toUpperCase().trim();
    const discount = await this.discountRepository.findOne({
      where: { code, business: { id: dto.businessId } },
      relations: ['business'],
    });

    if (!discount) throw new NotFoundException('Discount code not found');
    if (!discount.isActive)
      throw new BadRequestException('Discount code is not active');

    const now = new Date();
    if (now < new Date(discount.validFrom))
      throw new BadRequestException('Discount code is not yet valid');
    if (discount.validUntil && now > new Date(discount.validUntil))
      throw new BadRequestException('Discount code has expired');
    if (discount.maxUses && discount.usedCount >= discount.maxUses)
      throw new BadRequestException(
        'Discount code has reached its usage limit',
      );

    if (
      discount.minimumOrderAmount &&
      dto.orderAmount < Number(discount.minimumOrderAmount)
    ) {
      throw new BadRequestException(
        `Minimum order amount is £${discount.minimumOrderAmount}`,
      );
    }

    // Per-customer limit check
    if (userId && discount.maxUsesPerCustomer) {
      const userUsages = await this.usageRepository.count({
        where: {
          discountCode: { id: discount.id },
          user: { user_id: userId },
        },
      });
      if (userUsages >= discount.maxUsesPerCustomer) {
        throw new BadRequestException(
          'You have already used this discount code the maximum number of times',
        );
      }
    }

    const discountAmount = this.calculateDiscount(discount, dto.orderAmount);

    return {
      valid: true,
      discountId: discount.id,
      code: discount.code,
      type: discount.type,
      value: Number(discount.value),
      discountAmount,
      finalAmount: Number((dto.orderAmount - discountAmount).toFixed(2)),
    };
  }

  calculateDiscount(discount: DiscountCode, orderAmount: number): number {
    if (discount.type === DiscountType.PERCENTAGE) {
      return Number(
        ((orderAmount * Number(discount.value)) / 100).toFixed(2),
      );
    }
    return Math.min(Number(discount.value), orderAmount);
  }

  async applyDiscount(
    discountCodeId: string,
    userId: string,
    orderId: string,
    queryRunner: any,
  ): Promise<{ discountAmount: number }> {
    const discount = await queryRunner.manager
      .getRepository(DiscountCode)
      .createQueryBuilder('dc')
      .setLock('pessimistic_write')
      .where('dc.id = :id', { id: discountCodeId })
      .getOne();

    if (!discount) throw new NotFoundException('Discount code not found');
    if (!discount.isActive)
      throw new BadRequestException('Discount code is no longer active');
    if (discount.maxUses && discount.usedCount >= discount.maxUses)
      throw new BadRequestException('Discount code limit reached');

    discount.usedCount += 1;
    await queryRunner.manager.save(DiscountCode, discount);

    // Record usage
    const usage = queryRunner.manager.create(DiscountCodeUsage, {
      discountCode: discount,
      user: { user_id: userId },
      order: { id: orderId },
    });
    await queryRunner.manager.save(DiscountCodeUsage, usage);

    return { discountAmount: this.calculateDiscount(discount, 0) }; // amount computed outside
  }
}
