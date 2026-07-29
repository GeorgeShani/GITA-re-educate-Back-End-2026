import type { ExpenseCategory } from '../enums/expense-category.enum';

export class Expense {
  id!: number;
  category!: ExpenseCategory;
  productName!: string;
  quantity!: number;
  price!: number;
  totalPrice!: number;
}
