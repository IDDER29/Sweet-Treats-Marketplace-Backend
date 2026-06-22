import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only record of privileged / financial actions (admin moderation,
 * later: refunds, payouts, role changes). Never updated or deleted — it is the
 * evidentiary trail for "who did what to which resource, when".
 */
@Entity()
@Index('idx_audit_resource', ['resourceType', 'resourceId'])
@Index('idx_audit_actor_created', ['actorId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The authenticated principal who performed the action (null = system/job).
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  // Dotted action name, e.g. 'business.suspend'.
  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  resourceType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceId: string | null;

  // Non-sensitive context (reason, changed fields). Never store secrets/PII here.
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
