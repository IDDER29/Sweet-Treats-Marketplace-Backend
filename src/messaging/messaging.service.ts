import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message, SenderType } from './entities/message.entity';
import { Business } from '../business/entities/business.entity';
import { NotificationService } from '../notification/notification.service';

interface PageOpts {
  page?: number;
  limit?: number;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly notifications: NotificationService,
  ) {}

  // Customer opens (or continues) a thread with a shop.
  async sendFromCustomer(customerId: string, businessId: string, body: string) {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Shop not found');

    let conversation = await this.conversationRepo.findOne({
      where: {
        customer: { user_id: customerId },
        business: { id: businessId },
      },
    });
    if (!conversation) {
      conversation = await this.conversationRepo.save(
        this.conversationRepo.create({
          customer: { user_id: customerId } as any,
          business: { id: businessId } as any,
        }),
      );
    }
    return this.appendMessage(conversation, SenderType.CUSTOMER, body);
  }

  // Seller replies within one of their own conversations.
  async sendFromBusiness(
    businessId: string,
    conversationId: string,
    body: string,
  ) {
    const conversation = await this.getOwnedConversation(conversationId, {
      businessId,
    });
    const message = await this.appendMessage(
      conversation,
      SenderType.BUSINESS,
      body,
    );
    // Notify the customer of the reply (best-effort).
    if (conversation.customer?.user_id) {
      void this.notifications.record(conversation.customer.user_id, {
        type: 'MESSAGE',
        title: 'New message from a shop',
        body: body.slice(0, 140),
        data: { conversationId: conversation.id },
      });
    }
    return message;
  }

  listForCustomer(customerId: string, opts: PageOpts = {}) {
    return this.paginate(
      { customer: { user_id: customerId } },
      ['business'],
      opts,
    );
  }

  listForBusiness(businessId: string, opts: PageOpts = {}) {
    return this.paginate({ business: { id: businessId } }, ['customer'], opts);
  }

  // Bounded, newest-first conversation page for one participant. Caps the page
  // size so a heavy account can't pull every thread in a single request.
  private async paginate(where: any, relations: string[], opts: PageOpts) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
    const [rows, total] = await this.conversationRepo.findAndCount({
      where,
      relations,
      order: { lastMessageAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: rows.map((c) => this.toSummary(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMessages(
    conversationId: string,
    principal: { customerId?: string; businessId?: string },
  ) {
    await this.getOwnedConversation(conversationId, principal);
    const messages = await this.messageRepo.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });
    return messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      body: m.body,
      createdAt: m.createdAt,
    }));
  }

  // --- helpers ---------------------------------------------------------------
  private async appendMessage(
    conversation: Conversation,
    senderType: SenderType,
    body: string,
  ) {
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversation: { id: conversation.id } as any,
        senderType,
        body,
      }),
    );
    await this.conversationRepo.update(conversation.id, {
      lastMessageAt: new Date(),
    });
    return {
      id: message.id,
      conversationId: conversation.id,
      senderType,
      body: message.body,
      createdAt: message.createdAt,
    };
  }

  // Fetch a conversation only if the principal (customer or business) is a
  // participant — fail-closed otherwise.
  private async getOwnedConversation(
    conversationId: string,
    principal: { customerId?: string; businessId?: string },
  ): Promise<Conversation> {
    const where: any = { id: conversationId };
    if (principal.customerId)
      where.customer = { user_id: principal.customerId };
    if (principal.businessId) where.business = { id: principal.businessId };
    const conversation = await this.conversationRepo.findOne({
      where,
      relations: ['customer', 'business'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private toSummary(c: Conversation) {
    return {
      id: c.id,
      lastMessageAt: c.lastMessageAt,
      business: c.business
        ? {
            id: c.business.id,
            slug: c.business.slug,
            businessName: c.business.businessName,
          }
        : undefined,
      customer: c.customer
        ? {
            userId: c.customer.user_id,
            firstName: c.customer.first_name,
            lastName: c.customer.last_name,
          }
        : undefined,
    };
  }
}
