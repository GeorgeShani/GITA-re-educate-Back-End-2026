import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { faker } from '@faker-js/faker';
import { User } from './schema/user.schema';
import { QueryUsersDto } from './dto/query-users.dto';

const TOTAL_USERS_TO_SEED = 150_000;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const CACHE_TTL = 5 * 60 * 1000;

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
    const userCount = await this.userModel.countDocuments();
    if (userCount === 0) {
      console.log('Seeding users...');
      const dataToInsert: Partial<User>[] = [];
      for (let i = 0; i < TOTAL_USERS_TO_SEED; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        dataToInsert.push({
          fullName: `${firstName} ${lastName}`,
          email: `${faker.internet.username({ firstName, lastName }).toLowerCase()}.${i}@example.com`,
          age: faker.number.int({ min: 1, max: 90 }),
          gender: faker.helpers.arrayElement(['m', 'f']),
        });
      }

      await this.userModel.insertMany(dataToInsert, { ordered: false });
      console.log('Seeding done');
    }
  }

  async findAll(query: QueryUsersDto) {
    const cacheKey = `users:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const filter: QueryFilter<User> = {};

    if (query.age !== undefined) {
      filter.age = query.age;
    } else if (query.ageFrom !== undefined || query.ageTo !== undefined) {
      filter.age = {};
      if (query.ageFrom !== undefined) filter.age.$gte = query.ageFrom;
      if (query.ageTo !== undefined) filter.age.$lte = query.ageTo;
    }

    if (query.gender) {
      filter.gender = query.gender;
    }

    if (query.name) {
      filter.fullName = { $regex: query.name, $options: 'i' };
    }

    const page = Math.max(DEFAULT_PAGE, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(MIN_LIMIT, query.limit ?? DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.userModel.find(filter).skip(skip).limit(limit).lean(),
      this.userModel.countDocuments(filter),
    ]);

    const result = {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  async countAll() {
    const cacheKey = 'total-users';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const total = await this.userModel.estimatedDocumentCount();
    const result = { total };

    await this.cacheManager.set(cacheKey, result, CACHE_TTL);
    return result;
  }
}
