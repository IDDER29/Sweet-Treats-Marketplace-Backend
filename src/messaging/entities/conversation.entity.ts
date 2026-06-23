import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Users } from '../../entities/users.entity';
import { Business } from '../../business/entities/business.entity';

// One conversation thread per customer↔shop pair (Etsy-style).
@Entity()
@Unique(['customer', 'business'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Users;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
