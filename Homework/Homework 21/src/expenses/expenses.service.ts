import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
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

  findAll() {
    return this.expenses;
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
