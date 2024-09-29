// src/entities/businessOwners.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Users } from './users.entity';
import { Businesses } from './businesses.entity';

@Entity()
export class BusinessOwners {
  @PrimaryGeneratedColumn('uuid')
  owner_id: string;

  @OneToOne(() => Users, (user) => user.businessOwner)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @OneToMany(() => Businesses, (business) => business.owner)
  businesses: Businesses[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  permissions: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
