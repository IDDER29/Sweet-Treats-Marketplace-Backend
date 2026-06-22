import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Users } from '../../entities/users.entity';
import { Product } from '../../product/entities/product.entity';

@Entity()
// One review per customer per product (DB-level guard behind the service check).
@Index('idx_review_user_product', ['user', 'product'], { unique: true })
// Listing reviews for a product is the hot path.
@Index('idx_review_product', ['product'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // 1-5, validated in the DTO
  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}
