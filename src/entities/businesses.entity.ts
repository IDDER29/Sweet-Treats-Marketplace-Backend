import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessOwners } from './businessOwners.entity';

@Entity()
export class Businesses {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  business_id: string;

  // Many-to-One relationship with BusinessOwners
  @ManyToOne(() => BusinessOwners, (owner) => owner.businesses)
  @JoinColumn({ name: 'owner_id' })
  owner: BusinessOwners;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'text' })
  business_address: string;

  @Column({ type: 'varchar', length: 255 })
  phone: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
