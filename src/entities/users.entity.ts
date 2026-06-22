import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  DELIVERY_PROVIDER = 'DELIVERY_PROVIDER',
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone_number: string; // Optionally, add validation for format

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  modified_at: Date;

  // Soft-delete marker. Account deletion sets this instead of removing the row,
  // so order/review history is preserved and the FK constraints are never hit.
  // TypeORM excludes soft-deleted rows from finds by default (e.g. login).
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;
}
