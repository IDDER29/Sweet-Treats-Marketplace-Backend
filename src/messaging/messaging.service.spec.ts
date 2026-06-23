import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagingService } from './messaging.service';
import { Conversation } from './entities/conversation.entity';
import { Message, SenderType } from './entities/message.entity';
import { Business } from '../business/entities/business.entity';
import { NotificationService } from '../notification/notification.service';

describe('MessagingService', () => {
  let service: MessagingService;
  let conversationRepo: any;
  let messageRepo: any;
  let businessRepo: any;
  let notifications: { record: jest.Mock };

  beforeEach(async () => {
    conversationRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'c1', ...x })),
      update: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    messageRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'm1', createdAt: new Date(), ...x })),
      find: jest.fn().mockResolvedValue([]),
    };
    businessRepo = { findOne: jest.fn() };
    notifications = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationRepo,
        },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    service = module.get(MessagingService);
  });

  it('customer message creates the conversation on first contact', async () => {
    businessRepo.findOne.mockResolvedValue({ id: 'b1' });
    conversationRepo.findOne.mockResolvedValue(null); // none yet
    const res = await service.sendFromCustomer('u1', 'b1', 'Hi!');
    expect(conversationRepo.save).toHaveBeenCalled();
    expect(res.senderType).toBe(SenderType.CUSTOMER);
    expect(res.body).toBe('Hi!');
  });

  it('customer message reuses an existing conversation', async () => {
    businessRepo.findOne.mockResolvedValue({ id: 'b1' });
    conversationRepo.findOne.mockResolvedValue({ id: 'c1' });
    await service.sendFromCustomer('u1', 'b1', 'Again');
    expect(conversationRepo.save).not.toHaveBeenCalled();
    expect(messageRepo.save).toHaveBeenCalled();
  });

  it('404s messaging an unknown shop', async () => {
    businessRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendFromCustomer('u1', 'missing', 'Hi'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('business reply notifies the customer', async () => {
    conversationRepo.findOne.mockResolvedValue({
      id: 'c1',
      customer: { user_id: 'u1' },
      business: { id: 'b1' },
    });
    const res = await service.sendFromBusiness('b1', 'c1', 'On it!');
    expect(res.senderType).toBe(SenderType.BUSINESS);
    expect(notifications.record).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'MESSAGE' }),
    );
  });

  it('forbids accessing a conversation you are not part of (404)', async () => {
    conversationRepo.findOne.mockResolvedValue(null); // scoped where filters it out
    await expect(
      service.getMessages('c1', { customerId: 'intruder' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('business cannot reply into a conversation it does not own (404)', async () => {
    conversationRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendFromBusiness('other-biz', 'c1', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates the customer conversation list with bounded page size', async () => {
    conversationRepo.findAndCount.mockResolvedValue([
      [{ id: 'c1', business: { id: 'b1' } }],
      1,
    ]);
    const res: any = await service.listForCustomer('u1', {
      page: 1,
      limit: 5,
    });
    expect(res).toMatchObject({ total: 1, page: 1, limit: 5, totalPages: 1 });
    expect(res.data).toHaveLength(1);
    expect(conversationRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 5 }),
    );
  });

  it('clamps an over-large limit to 100', async () => {
    await service.listForBusiness('b1', { limit: 10000 });
    expect(conversationRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
