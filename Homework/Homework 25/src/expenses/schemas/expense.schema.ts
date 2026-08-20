import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { User } from '../../users/schemas/user.schema';
import { ExpenseCategory } from '../enums/expense-category.enum';

export type ExpenseDocument = HydratedDocument<Expense>;

@Schema(baseSchemaOptions)
export class Expense {
  @Prop({ required: true, enum: ExpenseCategory })
  category!: ExpenseCategory;

  @Prop({ required: true, trim: true })
  productName!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 0 })
  totalPrice!: number;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
