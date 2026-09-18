import { UserModel } from './models/user.model.js';
import { UserDocument } from './schemas/user.schema.js';

export function toUserModel(user: UserDocument): UserModel {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
