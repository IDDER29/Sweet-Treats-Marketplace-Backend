// src/entities/businesses.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessOwners } from './businessOwners.entity';
import { Products } from './products.entity';

@Entity()
export class Businesses {
  @PrimaryGeneratedColumn('uuid')
  business_id: string;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @ManyToOne(() => BusinessOwners, (owner) => owner.businesses)
  owner: BusinessOwners;

  @OneToMany(() => Products, (product) => product.business)
  products: Products[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
