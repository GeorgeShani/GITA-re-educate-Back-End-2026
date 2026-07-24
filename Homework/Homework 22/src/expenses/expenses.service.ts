import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils/paginate.util';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FindExpensesDto } from './dto/find-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  private expenses: Expense[] = [];
  private nextId = 1;

  create(createExpenseDto: CreateExpenseDto) {
    const { quantity, price } = createExpenseDto;

    const expense: Expense = {
      id: this.nextId++,
      ...createExpenseDto,
      totalPrice: quantity * price,
    };

    this.expenses.push(expense);
    return expense;
  }

  findAll(query: FindExpensesDto) {
    const { page = 1, take = 30, category, priceFrom, priceTo } = query;
    const hasPriceRange = priceFrom !== undefined || priceTo !== undefined;

    const matchesPriceRange = (expense: Expense) =>
      (priceFrom === undefined || expense.price >= priceFrom) &&
      (priceTo === undefined || expense.price <= priceTo);
    const matchesCategory = (expense: Expense) => expense.category === category;

    let filtered = this.expenses;

    if (category && hasPriceRange) {
      filtered = this.expenses.filter(
        (expense) => matchesCategory(expense) || matchesPriceRange(expense),
      );
    } else if (category) {
      filtered = this.expenses.filter(matchesCategory);
    } else if (hasPriceRange) {
      filtered = this.expenses.filter(matchesPriceRange);
    }

    return paginate(filtered, page, take);
  }

  findOne(id: number) {
    const expense = this.expenses.find((expense) => expense.id === id);

    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    return expense;
  }

  update(id: number, updateExpenseDto: UpdateExpenseDto) {
    const expense = this.findOne(id);

    Object.assign(expense, updateExpenseDto);
    expense.totalPrice = expense.quantity * expense.price;

    return expense;
  }

  remove(id: number) {
    const index = this.expenses.findIndex((expense) => expense.id === id);

    if (index === -1) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    const [removedExpense] = this.expenses.splice(index, 1);
    return removedExpense;
  }
}
