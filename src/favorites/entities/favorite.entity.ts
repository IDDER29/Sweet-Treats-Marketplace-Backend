import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Users } from '../../entities/users.entity';
import { Product } from '../../product/entities/product.entity';

// A customer's favorited product (one row per user+product).
@Entity()
@Unique(['user', 'product'])
@Index('idx_favorite_user', ['user'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
