import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Businesses } from './businesses.entity';

@Entity()
export class Products {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  product_id: string;

  @ManyToOne(() => Businesses, (business) => business.business_id)
  business_id: Businesses;

  @Column({ type: 'varchar', length: 255 })
  product_name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image_url: string;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
