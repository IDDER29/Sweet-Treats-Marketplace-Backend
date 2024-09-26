import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Deliveries } from './deliveries.entity';

@Entity()
export class DeliveryPerson {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  delivery_person_id: string;

  @Column({ type: 'varchar', length: 255 })
  first_name: string;

  @Column({ type: 'varchar', length: 255 })
  last_name: string;

  @Column({ type: 'varchar', length: 255 })
  phone_number: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicle_type: string;

  @OneToMany(() => Deliveries, (delivery) => delivery.delivery_person)
  deliveries: Deliveries[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
