import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Movie } from '../../movies/entities/movie.entity';

@Entity('directors')
export class Director {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'int', nullable: true })
  birthYear: number | null;

  @Column({ nullable: true })
  nationality: string | null;

  @OneToMany(() => Movie, (movie) => movie.director)
  films: Movie[];
}
