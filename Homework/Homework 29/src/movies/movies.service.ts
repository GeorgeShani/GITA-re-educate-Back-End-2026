import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../common/utils/paginate.util';
import { Director } from '../directors/entities/director.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { FindMoviesDto } from './dto/find-movies.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie } from './entities/movie.entity';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly moviesRepository: Repository<Movie>,
    @InjectRepository(Director)
    private readonly directorsRepository: Repository<Director>,
  ) {}

  async create(createMovieDto: CreateMovieDto) {
    const { directorId, ...rest } = createMovieDto;
    const movie = this.moviesRepository.create(rest);

    if (directorId) {
      movie.director = await this.findDirectorOrThrow(directorId);
    }

    return this.moviesRepository.save(movie);
  }

  async findAll(query: FindMoviesDto) {
    const {
      page = 1,
      limit = 10,
      name,
      genre,
      yearFrom,
      yearTo,
      directorId,
    } = query;

    const qb = this.moviesRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.director', 'director');

    if (name) {
      qb.andWhere('movie.name LIKE :name', { name: `%${name}%` });
    }

    if (genre) {
      qb.andWhere('movie.genre = :genre', { genre });
    }

    if (yearFrom !== undefined) {
      qb.andWhere('movie.year >= :yearFrom', { yearFrom });
    }

    if (yearTo !== undefined) {
      qb.andWhere('movie.year <= :yearTo', { yearTo });
    }

    if (directorId !== undefined) {
      qb.andWhere('director.id = :directorId', { directorId });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return paginate(data, total, page, limit);
  }

  async findOne(id: number) {
    const movie = await this.moviesRepository.findOne({ where: { id } });

    if (!movie) {
      throw new NotFoundException(`Movie with id ${id} not found`);
    }

    return movie;
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    const movie = await this.findOne(id);
    const { directorId, ...rest } = updateMovieDto;

    Object.assign(movie, rest);

    if (directorId !== undefined) {
      movie.director = directorId
        ? await this.findDirectorOrThrow(directorId)
        : null;
    }

    return this.moviesRepository.save(movie);
  }

  async remove(id: number) {
    const movie = await this.findOne(id);
    await this.moviesRepository.remove(movie);
    return movie;
  }

  private async findDirectorOrThrow(directorId: number) {
    const director = await this.directorsRepository.findOne({
      where: { id: directorId },
    });

    if (!director) {
      throw new NotFoundException(`Director with id ${directorId} not found`);
    }

    return director;
  }
}
