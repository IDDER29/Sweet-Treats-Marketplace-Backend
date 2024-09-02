import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  businessName: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  businessType: string;

  @Column()
  address: string;

  @Column()
  phoneNumber: string;
}
