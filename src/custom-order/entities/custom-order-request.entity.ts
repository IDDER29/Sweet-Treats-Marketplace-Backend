import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from '../../entities/users.entity';
import { Business } from '../../business/entities/business.entity';

export enum CustomOrderStatus {
  PENDING = 'PENDING',
  QUOTED = 'QUOTED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity()
export class CustomOrderRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'customer_id' })
  customer: Users;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // Customer describes what they want
  @Column({ type: 'text' })
  description: string;

  // e.g. "wedding cake", "birthday cake", "seasonal hamper"
  @Column({ type: 'varchar', length: 100, nullable: true })
  itemType: string;

  // Desired delivery date
  @Column({ type: 'date', nullable: true })
  requestedDate: string;

  // Number of servings / portions
  @Column({ nullable: true })
  servings: number;

  // Special dietary requirements
  @Column({ type: 'text', nullable: true })
  dietaryRequirements: string;

  // Customer's reference images (S3 URLs)
  @Column({ type: 'simple-array', nullable: true })
  referenceImages: string[];

  @Column({ type: 'enum', enum: CustomOrderStatus, default: CustomOrderStatus.PENDING })
  status: CustomOrderStatus;

  // Business fills in after reviewing the request
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  depositAmount: number;

  @Column({ type: 'text', nullable: true })
  businessNotes: string;

  // How long the quote is valid
  @Column({ type: 'timestamp', nullable: true })
  quoteExpiresAt: Date;

  @Column({ default: 'gbp', length: 10 })
  currency: string;

  @Column({ type: 'text', nullable: true })
  deliveryAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
