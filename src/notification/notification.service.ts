import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // Best-effort write — a notification failure must never break the action that
  // triggered it (e.g. placing or progressing an order).
  async record(userId: string, input: NotificationInput): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({ user: { user_id: userId } as any, ...input }),
      );
    } catch (e) {
      this.logger.warn(`failed to record notification: ${e?.message}`);
    }
  }

  async findForUser(
    userId: string,
    opts: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));
    const where: any = { user: { user_id: userId } };
    if (opts.unreadOnly) where.readAt = IsNull();

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: { user: { user_id: userId }, readAt: IsNull() },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.repo.findOne({
      where: { id, user: { user_id: userId } },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      n.readAt = new Date();
      await this.repo.save(n);
    }
    return n;
  }

  async markAllRead(userId: string) {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('user_id = :userId AND "readAt" IS NULL', { userId })
      .execute();
    return { ok: true };
  }
}
