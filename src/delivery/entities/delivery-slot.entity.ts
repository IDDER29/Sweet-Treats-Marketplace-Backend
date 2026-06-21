import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity()
export class DeliverySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'time' })
  slotStart: string; // HH:MM

  @Column({ type: 'time' })
  slotEnd: string; // HH:MM

  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Column({ type: 'int', default: 0 })
  bookedCount: number;

  @Column({ type: 'varchar', length: 20, default: 'DELIVERY' })
  type: string; // 'DELIVERY' | 'COLLECTION'

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  heldUntil: Date; // for payment-window slot holds

  @CreateDateColumn()
  createdAt: Date;
}
