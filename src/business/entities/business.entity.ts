import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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

  // The `agreeToTerms` field is added here, but it is not stored in the database, just for validation
  @Column()
  agreeToTerms: boolean;
}
