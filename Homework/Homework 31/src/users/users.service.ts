import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { S3Service } from '../aws/s3.service';
import { addMonths } from '../common/utils/date.util';
import { paginate } from '../common/utils/paginate.util';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { GenderStatistic } from './interfaces/gender-statistics.interface';

const FILTERABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'gender',
] as const;

const SUBSCRIPTION_DURATION_MONTHS = 1;

interface GenderStatisticRow {
  gender: string;
  count: string;
  averageAge: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly s3Service: S3Service,
  ) {}

  async create(createUserDto: CreateUserDto & { password: string }) {
    const subscriptionStartDate = new Date();
    const user = this.usersRepository.create({
      ...createUserDto,
      subscriptionStartDate,
      subscriptionEndDate: addMonths(
        subscriptionStartDate,
        SUBSCRIPTION_DURATION_MONTHS,
      ),
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        throw new ConflictException(
          `User with email ${createUserDto.email} already exists`,
        );
      }

      throw error;
    }
  }

  async findAll(query: FindUsersDto) {
    const { page = 1, limit = 10, ...filters } = query;
    const activeFields = FILTERABLE_FIELDS.filter((field) => filters[field]);

    const qb = this.usersRepository.createQueryBuilder('user');

    // Note: this ORs the active filters together (matching any one of them),
    // rather than requiring all of them to match. That mirrors the original
    // Homework 27 behaviour but is worth a second look if you want
    // "firstName AND email" style narrowing instead.
    activeFields.forEach((field, index) => {
      const condition = `user.${field} LIKE :${field}`;
      const params = { [field]: `${filters[field]}%` };

      if (index === 0) {
        qb.where(condition, params);
      } else {
        qb.orWhere(condition, params);
      }
    });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return paginate(data, total, page, limit);
  }

  /**
   * Groups every user by gender and returns the head count and average age
   * for each group.
   */
  async getGenderStatistics(): Promise<GenderStatistic[]> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.gender', 'gender')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(user.age)', 'averageAge')
      .groupBy('user.gender')
      .orderBy('user.gender', 'ASC')
      .getRawMany<GenderStatisticRow>();

    return rows.map((row) => ({
      gender: row.gender as GenderStatistic['gender'],
      count: Number(row.count),
      averageAge: Math.round(Number(row.averageAge ?? 0) * 10) / 10,
    }));
  }

  async findOne(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        throw new ConflictException(
          `User with email ${updateUserDto.email} already exists`,
        );
      }

      throw error;
    }
  }

  async remove(id: number) {
    const user = await this.findOne(id);

    if (user.profilePhotoKey) {
      // Same reasoning as products: nothing cascades this into an S3
      // delete on its own, so we do it explicitly before the row is gone
      // and there's no key left to clean up with.
      await this.s3Service.delete(user.profilePhotoKey);
    }

    await this.usersRepository.remove(user);
    return user;
  }

  findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  findByEmailWithPassword(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async isSubscriptionActive(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return !!user && user.subscriptionEndDate.getTime() > Date.now();
  }

  async upgradeSubscription(email: string) {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    user.subscriptionEndDate = addMonths(
      user.subscriptionEndDate,
      SUBSCRIPTION_DURATION_MONTHS,
    );

    return this.usersRepository.save(user);
  }

  async setProfilePhoto(id: number, file: Express.Multer.File) {
    const user = await this.findOne(id);
    const previousKey = user.profilePhotoKey;

    const uploaded = await this.s3Service.upload(file, `users/${id}`);
    user.profilePhotoKey = uploaded.key;
    user.profilePhotoUrl = uploaded.url;
    const saved = await this.usersRepository.save(user);

    if (previousKey) {
      // The new photo is already saved, so a failure to clean up the old
      // one shouldn't fail this request — it just leaves one orphaned S3
      // object behind, which is a much cheaper problem than losing the
      // user's new photo over a delete hiccup.
      await this.s3Service.delete(previousKey).catch(() => undefined);
    }

    return saved;
  }

  async removeProfilePhoto(id: number) {
    const user = await this.findOne(id);

    if (!user.profilePhotoKey) {
      throw new NotFoundException('User has no profile photo to remove');
    }

    await this.s3Service.delete(user.profilePhotoKey);
    user.profilePhotoKey = null;
    user.profilePhotoUrl = null;
    return this.usersRepository.save(user);
  }
}

/**
 * MySQL (via mysql2) reports a unique-constraint violation as
 * ER_DUP_ENTRY / errno 1062, wrapped by TypeORM in a QueryFailedError.
 * This is the SQL equivalent of checking Mongo's `error.code === 11000`.
 */
function isDuplicateEmailError(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY'
  );
}
