import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { Users } from '../../entities/users.entity';
import { Business } from '../../business/entities/business.entity';
import { Driver } from '../../driver/entities/driver.entity';
import { OrderItem } from './order-item.entity';

export enum FulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  SHIPPING = 'SHIPPING',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  SHIPPED = 'SHIPPED', // legacy alias kept for back-compat
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

@Entity()
@Index('idx_order_business_created', ['business', 'createdAt'])
@Index('idx_order_customer_created', ['customer', 'createdAt'])
@Index('idx_order_status', ['status'])
@Check('CHK_order_total_nonneg', '"totalAmount" >= 0')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The customer who placed the order (active Users entity)
  @ManyToOne(() => Users)
  @JoinColumn({ name: 'customer_id' })
  customer: Users;

  // The business fulfilling the order (active Business entity).
  // One order belongs to a single business; multi-vendor carts must be split.
  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  // Assigned delivery partner (null until a seller assigns one).
  @ManyToOne(() => Driver, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: FulfillmentType,
    default: FulfillmentType.DELIVERY,
  })
  fulfillmentType: FulfillmentType;

  // Gratuity, added on top of the total (never discounted).
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tipAmount: number;

  // Snapshot of the delivery address text at order time (kept even if the saved
  // Address is later edited/deleted). `deliveryAddressId` links the source.
  @Column({ type: 'text', nullable: true })
  deliveryAddress: string;

  @Column({ type: 'uuid', nullable: true })
  deliveryAddressId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contactPhone: string;

  @Column({ type: 'text', nullable: true })
  giftMessage: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 10, default: 'gbp' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  requestedDeliveryDate: string;

  @Column({ nullable: true })
  deliverySlotId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  @Column({ nullable: true })
  discountCodeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
