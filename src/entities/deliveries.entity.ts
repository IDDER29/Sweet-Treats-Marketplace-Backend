import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Orders } from './orders.entity';
import { DeliveryPerson } from './deliveryPerson.entity';

@Entity()
export class Deliveries {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  delivery_id: string;

  @ManyToOne(() => Orders, (order) => order.order_id)
  order_id: Orders;

  @ManyToOne(() => DeliveryPerson, (person) => person.delivery_person_id)
  delivery_person: DeliveryPerson;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING',
  })
  delivery_status: string;

  @Column({ type: 'text' })
  delivery_address: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  modified_at: Date;
}
