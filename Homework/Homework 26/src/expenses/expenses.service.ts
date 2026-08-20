import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FindExpensesDto } from './dto/find-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense, ExpenseDocument } from './schemas/expense.schema';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseModel: Model<ExpenseDocument>,
  ) {}

  create(createExpenseDto: CreateExpenseDto, userId: string) {
    const { quantity, price } = createExpenseDto;

    return this.expenseModel.create({
      ...createExpenseDto,
      totalPrice: quantity * price,
      user: userId,
    });
  }

  async findAll(query: FindExpensesDto) {
    const { page = 1, take = 30, userId, category, priceFrom, priceTo } = query;
    const hasPriceRange = priceFrom !== undefined || priceTo !== undefined;

    const conditions: Record<string, unknown>[] = [];

    if (category) {
      conditions.push({ category });
    }

    if (hasPriceRange) {
      const priceCondition: Record<string, number> = {};
      if (priceFrom !== undefined) priceCondition.$gte = priceFrom;
      if (priceTo !== undefined) priceCondition.$lte = priceTo;
      conditions.push({ price: priceCondition });
    }

    const mongoFilter: Record<string, unknown> =
      conditions.length > 1 ? { $or: conditions } : (conditions[0] ?? {});

    if (userId) {
      mongoFilter.user = userId;
    }

    return this.expenseModel
      .find(mongoFilter)
      .populate('user')
      .skip((page - 1) * take)
      .limit(take)
      .exec();
  }

  async findOne(id: string) {
    const expense = await this.expenseModel
      .findById(id)
      .populate('user')
      .exec();

    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto, userId: string) {
    const expense = await this.findOwnedExpense(id, userId);

    Object.assign(expense, updateExpenseDto);
    expense.totalPrice = expense.quantity * expense.price;

    await expense.save();
    return expense.populate('user');
  }

  async remove(id: string, userId: string) {
    const expense = await this.findOwnedExpense(id, userId);

    await expense.deleteOne();
    return expense;
  }

  private async findOwnedExpense(id: string, userId: string) {
    const expense = await this.expenseModel.findById(id).exec();

    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    if (expense.user.toString() !== userId) {
      throw new ForbiddenException('You can only manage your own expenses');
    }

    return expense;
  }
}
