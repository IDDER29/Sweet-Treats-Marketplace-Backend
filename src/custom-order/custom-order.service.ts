import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomOrderRequest,
  CustomOrderStatus,
} from './entities/custom-order-request.entity';
import { Users } from '../entities/users.entity';
import { Business } from '../business/entities/business.entity';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { RespondToQuoteDto } from './dto/respond-to-quote.dto';
import { UpdateCustomOrderStatusDto } from './dto/update-custom-order-status.dto';

@Injectable()
export class CustomOrderService {
  constructor(
    @InjectRepository(CustomOrderRequest)
    private readonly customOrderRepository: Repository<CustomOrderRequest>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  async create(
    customerId: string,
    businessId: string,
    dto: CreateCustomOrderDto,
  ): Promise<CustomOrderRequest> {
    const customer = await this.usersRepository.findOne({
      where: { user_id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const request = this.customOrderRepository.create({
      customer,
      business,
      description: dto.description,
      itemType: dto.itemType,
      requestedDate: dto.requestedDate,
      servings: dto.servings,
      dietaryRequirements: dto.dietaryRequirements,
      referenceImages: dto.referenceImages,
      deliveryAddress: dto.deliveryAddress,
      status: CustomOrderStatus.PENDING,
    });

    return this.customOrderRepository.save(request);
  }

  async findForCustomer(customerId: string): Promise<CustomOrderRequest[]> {
    const orders = await this.customOrderRepository.find({
      where: { customer: { user_id: customerId } },
      relations: ['business'],
      order: { createdAt: 'DESC' },
    });

    // Strip password from business
    return orders.map((order) => {
      if (order.business) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...businessWithoutPassword } = order.business as any;
        order.business = businessWithoutPassword as Business;
      }
      return order;
    });
  }

  async findForBusiness(
    businessId: string,
    authenticatedBusinessId: string,
  ): Promise<CustomOrderRequest[]> {
    if (businessId !== authenticatedBusinessId) {
      throw new ForbiddenException(
        'You do not have access to this business custom orders',
      );
    }

    return this.customOrderRepository.find({
      where: { business: { id: businessId } },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForCustomer(
    customerId: string,
    id: string,
  ): Promise<CustomOrderRequest> {
    const request = await this.customOrderRepository.findOne({
      where: { id },
      relations: ['business', 'customer'],
    });

    if (!request) {
      throw new NotFoundException('Custom order request not found');
    }

    if (request.customer?.user_id !== customerId) {
      throw new ForbiddenException(
        'You do not have access to this custom order request',
      );
    }

    return request;
  }

  async submitQuote(
    id: string,
    businessId: string,
    dto: SubmitQuoteDto,
  ): Promise<CustomOrderRequest> {
    const request = await this.customOrderRepository.findOne({
      where: { id },
      relations: ['business', 'customer'],
    });

    if (!request) {
      throw new NotFoundException('Custom order request not found');
    }

    if (request.business?.id !== businessId) {
      throw new ForbiddenException(
        'You do not have access to this custom order request',
      );
    }

    if (request.status !== CustomOrderStatus.PENDING) {
      throw new BadRequestException(
        'Can only submit a quote for pending requests',
      );
    }

    request.quotedPrice = dto.quotedPrice;

    // Default deposit to 30% of quote if not provided
    request.depositAmount =
      dto.depositAmount !== undefined
        ? dto.depositAmount
        : Number((dto.quotedPrice * 0.3).toFixed(2));

    request.businessNotes = dto.businessNotes;

    // Default quote expiry to 72 hours from now if not provided
    request.quoteExpiresAt =
      dto.quoteExpiresAt !== undefined
        ? dto.quoteExpiresAt
        : new Date(Date.now() + 72 * 60 * 60 * 1000);

    request.status = CustomOrderStatus.QUOTED;

    return this.customOrderRepository.save(request);
  }

  async respondToQuote(
    id: string,
    customerId: string,
    dto: RespondToQuoteDto,
  ): Promise<CustomOrderRequest> {
    const request = await this.customOrderRepository.findOne({
      where: { id },
      relations: ['business', 'customer'],
    });

    if (!request) {
      throw new NotFoundException('Custom order request not found');
    }

    if (request.customer?.user_id !== customerId) {
      throw new ForbiddenException(
        'You do not have access to this custom order request',
      );
    }

    if (request.status !== CustomOrderStatus.QUOTED) {
      throw new BadRequestException(
        'Can only respond to requests that have been quoted',
      );
    }

    if (request.quoteExpiresAt && new Date() > new Date(request.quoteExpiresAt)) {
      throw new BadRequestException('Quote has expired');
    }

    request.status = dto.decision;

    return this.customOrderRepository.save(request);
  }

  async updateStatus(
    id: string,
    businessId: string,
    dto: UpdateCustomOrderStatusDto,
  ): Promise<CustomOrderRequest> {
    const request = await this.customOrderRepository.findOne({
      where: { id },
      relations: ['business', 'customer'],
    });

    if (!request) {
      throw new NotFoundException('Custom order request not found');
    }

    if (request.business?.id !== businessId) {
      throw new ForbiddenException(
        'You do not have access to this custom order request',
      );
    }

    const validTransitions: Partial<Record<CustomOrderStatus, CustomOrderStatus[]>> = {
      [CustomOrderStatus.ACCEPTED]: [
        CustomOrderStatus.IN_PROGRESS,
        CustomOrderStatus.CANCELLED,
      ],
      [CustomOrderStatus.DEPOSIT_PAID]: [
        CustomOrderStatus.IN_PROGRESS,
        CustomOrderStatus.CANCELLED,
      ],
      [CustomOrderStatus.IN_PROGRESS]: [
        CustomOrderStatus.COMPLETED,
        CustomOrderStatus.CANCELLED,
      ],
    };

    const allowed = validTransitions[request.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Invalid status transition');
    }

    request.status = dto.status;

    return this.customOrderRepository.save(request);
  }

  async cancel(
    id: string,
    customerId: string,
  ): Promise<CustomOrderRequest> {
    const request = await this.customOrderRepository.findOne({
      where: { id },
      relations: ['business', 'customer'],
    });

    if (!request) {
      throw new NotFoundException('Custom order request not found');
    }

    if (request.customer?.user_id !== customerId) {
      throw new ForbiddenException(
        'You do not have access to this custom order request',
      );
    }

    if (
      request.status !== CustomOrderStatus.PENDING &&
      request.status !== CustomOrderStatus.QUOTED
    ) {
      throw new BadRequestException(
        'Only pending or quoted requests can be cancelled by the customer',
      );
    }

    request.status = CustomOrderStatus.CANCELLED;

    return this.customOrderRepository.save(request);
  }
}
