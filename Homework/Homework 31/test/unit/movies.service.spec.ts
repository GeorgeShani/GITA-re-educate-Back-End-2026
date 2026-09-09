import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { Director } from '../../src/directors/entities/director.entity';
import { Movie } from '../../src/movies/entities/movie.entity';
import { MoviesService } from '../../src/movies/movies.service';

function createQueryBuilderMock() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn<() => Promise<[Partial<Movie>[], number]>>(),
  };
}

function createMoviesRepositoryMock() {
  return {
    create: jest.fn<(entity: Partial<Movie>) => Partial<Movie>>(),
    save: jest.fn<(entity: Partial<Movie>) => Promise<Partial<Movie>>>(),
    findOne: jest.fn<(options: unknown) => Promise<Partial<Movie> | null>>(),
    remove: jest.fn<(entity: Partial<Movie>) => Promise<Partial<Movie>>>(),
    createQueryBuilder:
      jest.fn<(alias: string) => ReturnType<typeof createQueryBuilderMock>>(),
  };
}

function createDirectorsRepositoryMock() {
  return {
    findOne: jest.fn<(options: unknown) => Promise<Director | null>>(),
  };
}

describe('MoviesService', () => {
  let service: MoviesService;
  let moviesRepository: ReturnType<typeof createMoviesRepositoryMock>;
  let directorsRepository: ReturnType<typeof createDirectorsRepositoryMock>;

  const directorMock: Director = {
    id: 5,
    firstName: 'Christopher',
    lastName: 'Nolan',
    birthYear: 1970,
    nationality: 'British-American',
    films: [],
  };

  const movieMock: Partial<Movie> = {
    id: 1,
    name: 'Interstellar',
    genre: 'Sci-Fi',
    year: 2014,
    description: null,
    director: null,
  };

  beforeEach(async () => {
    moviesRepository = createMoviesRepositoryMock();
    directorsRepository = createDirectorsRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: getRepositoryToken(Movie), useValue: moviesRepository },
        {
          provide: getRepositoryToken(Director),
          useValue: directorsRepository,
        },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a movie without a director when directorId is not provided', async () => {
      const dto = { name: 'Interstellar', genre: 'Sci-Fi', year: 2014 };
      const createdEntity: Partial<Movie> = { ...dto };
      moviesRepository.create.mockReturnValue(createdEntity);
      moviesRepository.save.mockResolvedValue({ ...createdEntity, id: 1 });

      const result = await service.create(dto);

      expect(moviesRepository.create).toHaveBeenCalledWith(dto);
      expect(directorsRepository.findOne).not.toHaveBeenCalled();
      expect(moviesRepository.save).toHaveBeenCalledWith(createdEntity);
      expect(result).toEqual({ ...createdEntity, id: 1 });
    });

    it('attaches the director when a valid directorId is provided', async () => {
      const dto = {
        name: 'Interstellar',
        genre: 'Sci-Fi',
        year: 2014,
        directorId: 5,
      };
      const createdEntity: Partial<Movie> = {
        name: dto.name,
        genre: dto.genre,
        year: dto.year,
      };
      moviesRepository.create.mockReturnValue(createdEntity);
      directorsRepository.findOne.mockResolvedValue(directorMock);
      moviesRepository.save.mockImplementation((movie) =>
        Promise.resolve({ ...movie, id: 1 }),
      );

      const result = await service.create(dto);

      expect(moviesRepository.create).toHaveBeenCalledWith({
        name: dto.name,
        genre: dto.genre,
        year: dto.year,
      });
      expect(directorsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(createdEntity.director).toEqual(directorMock);
      expect(result.director).toEqual(directorMock);
    });

    it('throws NotFoundException and does not save when the director does not exist', async () => {
      const dto = {
        name: 'Interstellar',
        genre: 'Sci-Fi',
        year: 2014,
        directorId: 999,
      };
      moviesRepository.create.mockReturnValue({
        name: dto.name,
        genre: dto.genre,
        year: dto.year,
      });
      directorsRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(moviesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    let qb: ReturnType<typeof createQueryBuilderMock>;

    beforeEach(() => {
      qb = createQueryBuilderMock();
      moviesRepository.createQueryBuilder.mockReturnValue(qb);
    });

    it('returns a paginated result with defaults and no filters applied', async () => {
      qb.getManyAndCount.mockResolvedValue([[movieMock], 1]);

      const result = await service.findAll({});

      expect(moviesRepository.createQueryBuilder).toHaveBeenCalledWith('movie');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'movie.director',
        'director',
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [movieMock],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('applies name, genre, year range and directorId filters', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        name: 'hang',
        genre: 'comedy',
        yearFrom: 2002,
        yearTo: 2010,
        directorId: 3,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('movie.name LIKE :name', {
        name: '%hang%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('movie.genre = :genre', {
        genre: 'comedy',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('movie.year >= :yearFrom', {
        yearFrom: 2002,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('movie.year <= :yearTo', {
        yearTo: 2010,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('director.id = :directorId', {
        directorId: 3,
      });
    });

    it('computes the correct offset for a given page and limit', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 5 });

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('returns totalPages of 0 when there are no matching movies', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns the movie when found', async () => {
      moviesRepository.findOne.mockResolvedValue(movieMock);

      const result = await service.findOne(1);

      expect(moviesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(movieMock);
    });

    it('throws NotFoundException when the movie does not exist', async () => {
      moviesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates scalar fields without touching the director', async () => {
      const existing: Partial<Movie> = {
        id: 1,
        name: 'Old Name',
        genre: 'Drama',
        year: 2000,
        director: null,
      };
      moviesRepository.findOne.mockResolvedValue(existing);
      moviesRepository.save.mockImplementation((movie) =>
        Promise.resolve(movie),
      );

      const result = await service.update(1, { name: 'New Name' });

      expect(existing.name).toBe('New Name');
      expect(directorsRepository.findOne).not.toHaveBeenCalled();
      expect(moviesRepository.save).toHaveBeenCalledWith(existing);
      expect(result.name).toBe('New Name');
    });

    it('reassigns the director when a new directorId is provided', async () => {
      const existing: Partial<Movie> = {
        id: 1,
        name: 'Old Name',
        director: null,
      };
      moviesRepository.findOne.mockResolvedValue(existing);
      directorsRepository.findOne.mockResolvedValue(directorMock);
      moviesRepository.save.mockImplementation((movie) =>
        Promise.resolve(movie),
      );

      const result = await service.update(1, { directorId: 5 });

      expect(directorsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(existing.director).toEqual(directorMock);
      expect(result.director).toEqual(directorMock);
    });

    it('clears the director when directorId is falsy (0)', async () => {
      const existing: Partial<Movie> = {
        id: 1,
        name: 'Old Name',
        director: directorMock,
      };
      moviesRepository.findOne.mockResolvedValue(existing);
      moviesRepository.save.mockImplementation((movie) =>
        Promise.resolve(movie),
      );

      await service.update(1, { directorId: 0 });

      expect(directorsRepository.findOne).not.toHaveBeenCalled();
      expect(existing.director).toBeNull();
    });

    it('throws NotFoundException and does not save when the movie does not exist', async () => {
      moviesRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
      expect(moviesRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException and does not save when the new director does not exist', async () => {
      const existing: Partial<Movie> = {
        id: 1,
        name: 'Old Name',
        director: null,
      };
      moviesRepository.findOne.mockResolvedValue(existing);
      directorsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, { directorId: 999 })).rejects.toThrow(
        NotFoundException,
      );
      expect(moviesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes and returns the movie when found', async () => {
      moviesRepository.findOne.mockResolvedValue(movieMock);
      moviesRepository.remove.mockResolvedValue(movieMock);

      const result = await service.remove(1);

      expect(moviesRepository.remove).toHaveBeenCalledWith(movieMock);
      expect(result).toEqual(movieMock);
    });

    it('throws NotFoundException and does not remove when the movie does not exist', async () => {
      moviesRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(moviesRepository.remove).not.toHaveBeenCalled();
    });
  });
});
