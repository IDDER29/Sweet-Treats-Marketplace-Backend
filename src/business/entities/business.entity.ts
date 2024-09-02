import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Business {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  businessName: string;

  @Column()
  businessType: string;

  @Column()
  address: string;

  @Column()
  phoneNumber: string;

  @Column({ default: false })
  agreeToTerms: boolean;
}
