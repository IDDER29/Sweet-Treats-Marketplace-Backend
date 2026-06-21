import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Category } from '../../category/entities/category.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index() // Improve query performance on product name
  @Column({ type: 'varchar', length: 255, default: 'Unnamed Product' })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  ingredients: string;

  @Column({ type: 'text', array: true, default: [] })
  allergens: string[];

  @Column({ type: 'text', array: true, default: [] })
  kitchenAllergens: string[]; // cross-contamination risk

  // New field for dietary label
  @Column({ type: 'varchar', length: 255, nullable: true })
  dietaryLabel: string;

  // New field for calories
  @Column({ type: 'int', nullable: true })
  calories: number;

  // New field for macronutrients
  @Column({ type: 'text', nullable: true })
  macronutrients: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @ManyToOne(() => Category, { nullable: true, eager: false })
  @JoinColumn({ name: 'category_id' })
  categoryRelation: Category;

  @Column({ nullable: true })
  seasonStartMonth: number;

  @Column({ nullable: true })
  seasonEndMonth: number;

  @Column({ type: 'varchar', length: 50, default: 'Standard size' })
  size: string;

  // New field for weight
  @Column({ type: 'varchar', length: 50, nullable: true })
  weight: string;

  // New field for shelf life
  @Column({ type: 'varchar', length: 255, nullable: true })
  shelfLife: string;

  // New field for storage instructions
  @Column({ type: 'text', nullable: true })
  storageInstructions: string;

  // Updated field for seasonal availability
  @Column({ type: 'varchar', length: 50, nullable: true })
  seasonalAvailability: string;

  @Column({ type: 'text', nullable: true })
  servingSuggestions: string;

  @Column({ type: 'text', nullable: true })
  variations: string;

  @Column({ type: 'text', nullable: true })
  customizationOptions: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ default: true })
  trackStock: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  leadTimeDays: number;

  @Column({ type: 'int', nullable: true })
  maxOrderQuantity: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unitLabel: string; // e.g. "cookies", "pack of 6"

  @Column({ type: 'int', default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column('jsonb', { array: false, default: [] })
  images: {
    url: string;
    name: string;
    key: string;
  }[];

  @Column('text', { array: true, default: [] })
  options: string[];

  @ManyToOne(() => Business, (business) => business.products)
  business: Business;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
