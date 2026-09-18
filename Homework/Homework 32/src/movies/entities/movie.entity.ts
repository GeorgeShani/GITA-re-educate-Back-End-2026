import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Director } from '../../directors/entities/director.entity';

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  genre: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Director, (director) => director.films, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'directorId' })
  director: Director | null;
}
