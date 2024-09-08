import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Product } from '../../product/entities/product.entity'; // Import Product entity

@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  businessName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  businessType: string;

  @Column()
  address: string;

  @Column()
  phoneNumber: string;

  @Column()
  agreeToTerms: boolean;

  // A business can have multiple products
  @OneToMany(() => Product, (product) => product.business)
  products: Product[];
}
