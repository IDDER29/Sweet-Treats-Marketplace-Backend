import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'n1', ...x })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        update: () => ({
          set: () => ({ where: () => ({ execute: jest.fn() }) }),
        }),
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();
    service = module.get(NotificationService);
  });

  it('record() persists a notification for the user', async () => {
    await service.record('u1', { type: 'ORDER_PLACED', title: 'Order placed' });
    expect(repo.save).toHaveBeenCalled();
    const arg = repo.create.mock.calls[0][0];
    expect(arg.user).toEqual({ user_id: 'u1' });
    expect(arg.type).toBe('ORDER_PLACED');
  });

  it('record() never throws (best-effort)', async () => {
    repo.save.mockRejectedValue(new Error('db down'));
    await expect(
      service.record('u1', { type: 'X', title: 'Y' }),
    ).resolves.toBeUndefined();
  });

  it('findForUser paginates', async () => {
    repo.findAndCount.mockResolvedValue([[{ id: 'n1' }], 1]);
    const res = await service.findForUser('u1', { page: 1, limit: 20 });
    expect(res.total).toBe(1);
    expect(res.data).toHaveLength(1);
  });

  it('markRead 404s a foreign/unknown notification', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markRead stamps readAt once', async () => {
    const n: any = { id: 'n1', readAt: null };
    repo.findOne.mockResolvedValue(n);
    const res = await service.markRead('u1', 'n1');
    expect(res.readAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalled();
  });
});
