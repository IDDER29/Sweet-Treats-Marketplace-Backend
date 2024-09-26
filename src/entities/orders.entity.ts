import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Users } from './users.entity';
import { Businesses } from './businesses.entity';

@Entity()
export class Orders {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  order_id: string;

  @ManyToOne(() => Users, (user) => user.user_id)
  user_id: Users;

  @ManyToOne(() => Businesses, (business) => business.business_id)
  business_id: Businesses;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING',
  })
  order_status: string;

  @Column({ type: 'timestamp', nullable: true })
  delivery_time: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  modified_at: Date;
}
