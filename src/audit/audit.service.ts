import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Best-effort: a failed audit write must never break the user-facing action,
   * but it must be loud in the logs so the gap is visible. (A stricter,
   * transactional audit is a documented hardening step in the backlog.)
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepository.insert({
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        actorId: entry.actorId ?? null,
        actorRole: entry.actorRole ?? null,
        ip: entry.ip ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.action} on ${entry.resourceType}:${entry.resourceId}: ${err.message}`,
      );
    }
  }

  /** Recent audit entries for a resource (admin/forensics). */
  findForResource(resourceType: string, resourceId: string, limit = 50) {
    return this.auditRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }
}
