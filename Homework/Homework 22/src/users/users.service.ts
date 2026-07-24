import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils/paginate.util';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

const FILTERABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'gender',
] as const;

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  create(createUserDto: CreateUserDto) {
    const user: User = {
      id: this.nextId++,
      ...createUserDto,
    };

    this.users.push(user);
    return user;
  }

  findAll(query: FindUsersDto) {
    const { page = 1, take = 30, ...filters } = query;
    const activeFilters = FILTERABLE_FIELDS.filter((field) => filters[field]);

    const filtered = activeFilters.length
      ? this.users.filter((user) =>
          activeFilters.some((field) =>
            user[field].toLowerCase().startsWith(filters[field]!.toLowerCase()),
          ),
        )
      : this.users;

    return paginate(filtered, page, take);
  }

  findOne(id: number) {
    const user = this.users.find((user) => user.id === id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    const user = this.findOne(id);

    Object.assign(user, updateUserDto);
    return user;
  }

  remove(id: number) {
    const index = this.users.findIndex((user) => user.id === id);

    if (index === -1) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const [removedUser] = this.users.splice(index, 1);
    return removedUser;
  }
}
