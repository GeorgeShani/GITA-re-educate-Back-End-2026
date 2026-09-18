import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { CreateUserInput } from './dto/create-user.input.js';
import { User, UserDocument } from './schemas/user.schema.js';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(data: CreateUserInput): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: data.email }).exec();

    if (existing) {
      throw new ConflictException('Email is already taken');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    return this.userModel.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      password: hashedPassword,
    });
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async comparePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
