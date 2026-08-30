import { Types } from 'mongoose';
import { ExpenseCategory } from '../enums/expense-category.enum';

export interface ExpenseSummary {
  id: Types.ObjectId;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
  user: Types.ObjectId;
}

export interface CategoryStatistic {
  category: ExpenseCategory;
  /** Sum of `totalPrice` across every expense in the category. */
  totalAmount: number;
  /** Number of expense records in the category. */
  count: number;
  /** Sum of `quantity` across every expense in the category. */
  totalQuantity: number;
  expenses: ExpenseSummary[];
}

export interface TopSpender {
  userId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  totalSpent: number;
  expenseCount: number;
}
