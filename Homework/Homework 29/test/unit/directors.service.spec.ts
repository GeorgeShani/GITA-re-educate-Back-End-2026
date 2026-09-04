import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { DirectorsService } from '../../src/directors/directors.service';
import { Director } from '../../src/directors/entities/director.entity';

function createQueryBuilderMock() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn<() => Promise<[Director[], number]>>(),
  };
}

function createDirectorsRepositoryMock() {
  return {
    create: jest.fn<(entity: Partial<Director>) => Partial<Director>>(),
    save: jest.fn<(entity: Partial<Director>) => Promise<Partial<Director>>>(),
    findOne: jest.fn<(options: unknown) => Promise<Director | null>>(),
    remove: jest.fn<(entity: Director) => Promise<Director>>(),
    createQueryBuilder:
      jest.fn<(alias: string) => ReturnType<typeof createQueryBuilderMock>>(),
  };
}

describe('DirectorsService', () => {
  let service: DirectorsService;
  let directorsRepository: ReturnType<typeof createDirectorsRepositoryMock>;

  const directorMock: Director = {
    id: 1,
    firstName: 'Christopher',
    lastName: 'Nolan',
    birthYear: 1970,
    nationality: 'British-American',
    films: [],
  };

  beforeEach(async () => {
    directorsRepository = createDirectorsRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectorsService,
        {
          provide: getRepositoryToken(Director),
          useValue: directorsRepository,
        },
      ],
    }).compile();

    service = module.get<DirectorsService>(DirectorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates and saves a director', async () => {
      const dto = {
        firstName: 'Christopher',
        lastName: 'Nolan',
        birthYear: 1970,
        nationality: 'British-American',
      };
      const createdEntity: Partial<Director> = { ...dto };
      directorsRepository.create.mockReturnValue(createdEntity);
      directorsRepository.save.mockResolvedValue({ ...createdEntity, id: 1 });

      const result = await service.create(dto);

      expect(directorsRepository.create).toHaveBeenCalledWith(dto);
      expect(directorsRepository.save).toHaveBeenCalledWith(createdEntity);
      expect(result).toEqual({ ...createdEntity, id: 1 });
    });
  });

  describe('findAll', () => {
    let qb: ReturnType<typeof createQueryBuilderMock>;

    beforeEach(() => {
      qb = createQueryBuilderMock();
      directorsRepository.createQueryBuilder.mockReturnValue(qb);
    });

    it('returns a paginated result with defaults and no filters applied', async () => {
      qb.getManyAndCount.mockResolvedValue([[directorMock], 1]);

      const result = await service.findAll({});

      expect(directorsRepository.createQueryBuilder).toHaveBeenCalledWith(
        'director',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'director.films',
        'films',
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [directorMock],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('applies the name filter across first and last name', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ name: 'nolan' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(director.firstName LIKE :name OR director.lastName LIKE :name)',
        { name: '%nolan%' },
      );
    });

    it('applies the nationality and birth year range filters', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        nationality: 'British',
        birthYearFrom: 1950,
        birthYearTo: 1980,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'director.nationality = :nationality',
        { nationality: 'British' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'director.birthYear >= :birthYearFrom',
        { birthYearFrom: 1950 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'director.birthYear <= :birthYearTo',
        { birthYearTo: 1980 },
      );
    });

    it('computes the correct offset for a given page and limit', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 5 });

      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('returns totalPages of 0 when there are no matching directors', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns the director with films loaded when found', async () => {
      directorsRepository.findOne.mockResolvedValue(directorMock);

      const result = await service.findOne(1);

      expect(directorsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { films: true },
      });
      expect(result).toEqual(directorMock);
    });

    it('throws NotFoundException when the director does not exist', async () => {
      directorsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges the dto into the existing director and saves it', async () => {
      const existing: Director = { ...directorMock, firstName: 'Chris' };
      directorsRepository.findOne.mockResolvedValue(existing);
      directorsRepository.save.mockImplementation((director) =>
        Promise.resolve(director),
      );

      const result = await service.update(1, {
        firstName: 'Christopher',
      });

      expect(existing.firstName).toBe('Christopher');
      expect(directorsRepository.save).toHaveBeenCalledWith(existing);
      expect(result.firstName).toBe('Christopher');
    });

    it('throws NotFoundException and does not save when the director does not exist', async () => {
      directorsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
      expect(directorsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes and returns the director when found', async () => {
      directorsRepository.findOne.mockResolvedValue(directorMock);
      directorsRepository.remove.mockResolvedValue(directorMock);

      const result = await service.remove(1);

      expect(directorsRepository.remove).toHaveBeenCalledWith(directorMock);
      expect(result).toEqual(directorMock);
    });

    it('throws NotFoundException and does not remove when the director does not exist', async () => {
      directorsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(directorsRepository.remove).not.toHaveBeenCalled();
    });
  });
});
