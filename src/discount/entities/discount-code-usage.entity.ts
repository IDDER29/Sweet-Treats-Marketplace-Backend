import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DiscountCode } from './discount-code.entity';
import { Users } from '../../entities/users.entity';
import { Order } from '../../order/entities/order.entity';

@Entity()
export class DiscountCodeUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DiscountCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'discount_code_id' })
  discountCode: DiscountCode;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @CreateDateColumn()
  usedAt: Date;
}
