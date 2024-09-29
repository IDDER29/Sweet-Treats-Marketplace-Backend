// src/entities/users.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessOwners } from './businessOwners.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity()
export class Users {
  @PrimaryGeneratedColumn('uuid') // Auto-generated UUIDs
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  first_name: string;

  @Column({ type: 'varchar', length: 255 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string; // Remember to hash this in your service

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 255 })
  phone_number: string; // Optionally, add validation for format

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  modified_at: Date;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  // One-to-One relationship with BusinessOwners
  @OneToOne(() => BusinessOwners, (owner) => owner.user, { cascade: true })
  @JoinColumn({ name: 'owner_id' }) // This will be used as a foreign key
  businessOwner: BusinessOwners;
}
