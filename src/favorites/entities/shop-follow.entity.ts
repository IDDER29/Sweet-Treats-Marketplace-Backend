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
import { Business } from '../../business/entities/business.entity';

// A customer following a shop (one row per user+business).
@Entity()
@Unique(['user', 'business'])
@Index('idx_shopfollow_user', ['user'])
export class ShopFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @CreateDateColumn()
  createdAt: Date;
}
