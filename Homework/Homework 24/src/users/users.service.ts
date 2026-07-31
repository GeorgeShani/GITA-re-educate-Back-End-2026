import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addMonths } from '../common/utils/date.util';
import { escapeRegExp } from '../common/utils/escape-regexp.util';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const FILTERABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'gender',
] as const;

const SUBSCRIPTION_DURATION_MONTHS = 1;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const subscriptionStartDate = new Date();

    try {
      return await this.userModel.create({
        ...createUserDto,
        subscriptionStartDate,
        subscriptionEndDate: addMonths(
          subscriptionStartDate,
          SUBSCRIPTION_DURATION_MONTHS,
        ),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          `User with email ${createUserDto.email} already exists`,
        );
      }

      throw error;
    }
  }

  async findAll(query: FindUsersDto) {
    const { page = 1, take = 30, ...filters } = query;
    const activeFilters = FILTERABLE_FIELDS.filter((field) => filters[field]);

    const mongoFilter: Record<string, unknown> = activeFilters.length
      ? {
          $or: activeFilters.map((field) => ({
            [field]: {
              $regex: `^${escapeRegExp(filters[field]!)}`,
              $options: 'i',
            },
          })),
        }
      : {};

    return this.userModel
      .find(mongoFilter)
      .skip((page - 1) * take)
      .limit(take)
      .exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true, runValidators: true })
      .exec();

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
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

    await user.save();
    return user;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
