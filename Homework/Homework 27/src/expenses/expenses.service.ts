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
import {
  CategoryStatistic,
  TopSpender,
} from './interfaces/expense-statistics.interface';
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

  /**
   * Groups every expense by category and, per category, returns the total
   * amount spent, the number of expense records, the total quantity of items,
   * and the expenses themselves as an array.
   */
  getCategoryStatistics(): Promise<CategoryStatistic[]> {
    return this.expenseModel
      .aggregate<CategoryStatistic>([
        {
          $group: {
            _id: '$category',
            totalAmount: { $sum: '$totalPrice' },
            count: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            expenses: {
              $push: {
                id: '$_id',
                productName: '$productName',
                quantity: '$quantity',
                price: '$price',
                totalPrice: '$totalPrice',
                user: '$user',
              },
            },
          },
        },
        { $sort: { totalAmount: -1 } },
        {
          $project: {
            _id: 0,
            category: '$_id',
            totalAmount: 1,
            count: 1,
            totalQuantity: 1,
            expenses: 1,
          },
        },
      ])
      .exec();
  }

  /**
   * Groups expenses by user and returns the biggest spenders, ordered by the
   * total amount they have spent.
   */
  getTopSpenders(limit: number): Promise<TopSpender[]> {
    return this.expenseModel
      .aggregate<TopSpender>([
        {
          $group: {
            _id: '$user',
            totalSpent: { $sum: '$totalPrice' },
            expenseCount: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            userId: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            email: '$user.email',
            totalSpent: 1,
            expenseCount: 1,
          },
        },
      ])
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
