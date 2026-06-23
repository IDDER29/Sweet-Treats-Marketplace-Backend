import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
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

  @Index()
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

  @Column({ default: true })
  isAcceptingOrders: boolean;

  @Column({ default: false })
  isSuspended: boolean;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  hygieneCertificateNumber: string;

  @Column({ type: 'date', nullable: true })
  hygieneCertificateExpiry: string;

  @Column({ default: false })
  hygieneCertificateVerified: boolean;

  // Stripe Connect: the seller's connected-account id (acct_…). Null until the
  // business completes onboarding. `payoutsEnabled` mirrors the account's
  // charges/payouts capability, updated from account.updated webhooks.
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeAccountId: string | null;

  @Column({ default: false })
  payoutsEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // A business can have multiple products
  @OneToMany(() => Product, (product) => product.business)
  products: Product[];
}
