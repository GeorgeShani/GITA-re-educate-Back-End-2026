import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';

import { AddressDto } from '../common/dto/address.dto';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone?: string;
  emailVerificationTokenHash: string;
  emailVerificationExpiresAt: Date;
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(
    input: CreateUserInput,
    session: ClientSession,
  ): Promise<UserDocument> {
    const { passwordHash, ...rest } = input;
    try {
      // Named passwordHash on the input (the caller has already hashed
      // it — this service never sees a plaintext password) but mapped
      // onto the schema's `password` field, which is what it's actually
      // called at rest.
      const [user] = await this.userModel.create(
        [{ ...rest, password: passwordHash }],
        { session },
      );
      return user;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ _id: id, isDeleted: false })
      .exec();
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), isDeleted: false })
      .exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), isDeleted: false })
      .select('+password')
      .exec();
  }

  findByEmailVerificationTokenHash(hash: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ emailVerificationTokenHash: hash, isDeleted: false })
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
      .exec();
  }

  findByPasswordResetTokenHash(hash: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ passwordResetTokenHash: hash, isDeleted: false })
      .select('+passwordResetTokenHash +passwordResetExpiresAt')
      .exec();
  }

  async markEmailVerified(
    userId: string,
    session: ClientSession,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        emailVerified: true,
        $unset: {
          emailVerificationTokenHash: '',
          emailVerificationExpiresAt: '',
        },
      },
      { session },
    );
  }

  async updateLastLogin(userId: string, session: ClientSession): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { lastLoginAt: new Date() },
      { session },
    );
  }

  async setPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    session: ClientSession,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
      { session },
    );
  }

  async resetPassword(
    userId: string,
    passwordHash: string,
    session: ClientSession,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        password: passwordHash,
        $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
      },
      { session },
    );
  }

  // No SCOPE.md domain event covers plain address-book CRUD, so these
  // stay outside CQRS — same reasoning as CartService.removeCoupon.
  async addAddress(userId: string, address: AddressDto): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (address.isDefault) {
      user.addresses.forEach((existing) => (existing.isDefault = false));
    }
    user.addresses.push(address);
    await user.save();
    return user;
  }

  async updateAddress(
    userId: string,
    addressId: string,
    address: Partial<AddressDto>,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    const existing = user.addresses.id(addressId);
    if (!existing) {
      throw new NotFoundException(`Address ${addressId} not found`);
    }

    if (address.isDefault) {
      user.addresses.forEach((entry) => (entry.isDefault = false));
    }
    Object.assign(existing, address);
    await user.save();
    return user;
  }

  async removeAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument> {
    const user = await this.findById(userId);
    const existing = user.addresses.id(addressId);
    if (!existing) {
      throw new NotFoundException(`Address ${addressId} not found`);
    }
    existing.deleteOne();
    await user.save();
    return user;
  }

  async setStripeCustomerId(
    userId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { stripeCustomerId });
  }

  findByIdWithStripeCustomerId(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ _id: userId, isDeleted: false })
      .select('+stripeCustomerId')
      .exec();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
