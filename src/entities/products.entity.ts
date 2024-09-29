// src/entities/products.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Businesses } from './businesses.entity';

@Entity()
export class Products {
  @PrimaryGeneratedColumn('uuid')
  product_id: string;

  @Column({ type: 'varchar', length: 255 })
  product_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal' })
  price: number;

  @Column({ type: 'int' })
  stock_quantity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image_url: string;

  @ManyToOne(() => Businesses, (business) => business.products)
  business: Businesses;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
