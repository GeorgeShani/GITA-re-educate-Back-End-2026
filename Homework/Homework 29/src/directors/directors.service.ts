import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from '../common/utils/paginate.util';
import { CreateDirectorDto } from './dto/create-director.dto';
import { FindDirectorsDto } from './dto/find-directors.dto';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { Director } from './entities/director.entity';

@Injectable()
export class DirectorsService {
  constructor(
    @InjectRepository(Director)
    private readonly directorsRepository: Repository<Director>,
  ) {}

  create(createDirectorDto: CreateDirectorDto) {
    const director = this.directorsRepository.create(createDirectorDto);
    return this.directorsRepository.save(director);
  }

  async findAll(query: FindDirectorsDto) {
    const {
      page = 1,
      limit = 10,
      name,
      nationality,
      birthYearFrom,
      birthYearTo,
    } = query;

    const qb = this.directorsRepository
      .createQueryBuilder('director')
      .leftJoinAndSelect('director.films', 'films');

    if (name) {
      qb.andWhere(
        '(director.firstName LIKE :name OR director.lastName LIKE :name)',
        { name: `%${name}%` },
      );
    }

    if (nationality) {
      qb.andWhere('director.nationality = :nationality', { nationality });
    }

    if (birthYearFrom !== undefined) {
      qb.andWhere('director.birthYear >= :birthYearFrom', { birthYearFrom });
    }

    if (birthYearTo !== undefined) {
      qb.andWhere('director.birthYear <= :birthYearTo', { birthYearTo });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return paginate(data, total, page, limit);
  }

  async findOne(id: number) {
    const director = await this.directorsRepository.findOne({
      where: { id },
      relations: { films: true },
    });

    if (!director) {
      throw new NotFoundException(`Director with id ${id} not found`);
    }

    return director;
  }

  async update(id: number, updateDirectorDto: UpdateDirectorDto) {
    const director = await this.findOne(id);
    Object.assign(director, updateDirectorDto);
    return this.directorsRepository.save(director);
  }

  async remove(id: number) {
    const director = await this.findOne(id);
    await this.directorsRepository.remove(director);
    return director;
  }
}
