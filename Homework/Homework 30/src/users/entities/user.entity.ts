import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gender } from '../enums/gender.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  phoneNumber: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'int' })
  age: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'datetime' })
  subscriptionStartDate: Date;

  @Column({ type: 'datetime' })
  subscriptionEndDate: Date;

  @Column({ type: 'varchar', nullable: true })
  profilePhotoKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  profilePhotoUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
