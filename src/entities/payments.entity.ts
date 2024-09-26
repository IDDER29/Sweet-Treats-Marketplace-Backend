import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Orders } from './orders.entity';

@Entity()
export class Payments {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  payment_id: string;

  @ManyToOne(() => Orders, (order) => order.order_id)
  order_id: Orders;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  payment_status: string;

  @CreateDateColumn({ type: 'timestamp' })
  payment_date: Date;
}
