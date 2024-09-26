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
import { Products } from './products.entity';

@Entity()
export class Reviews {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  review_id: string;

  @ManyToOne(() => Users, (user) => user.user_id)
  user_id: Users;

  @ManyToOne(() => Businesses, (business) => business.business_id, {
    nullable: true,
  })
  business_id: Businesses;

  @ManyToOne(() => Products, (product) => product.product_id, {
    nullable: true,
  })
  product_id: Products;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  rating: number;

  @Column({ type: 'text' })
  review_text: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
