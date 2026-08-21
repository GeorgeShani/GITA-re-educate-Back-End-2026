import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// A subdocument, not a top-level collection — SCOPE.md A9: addresses have
// no independent lifecycle apart from whoever holds them. Two places
// embed this same shape for different reasons:
//   - User.addresses — the live, editable address book
//   - Order.shippingAddress / Order.billingAddress — a frozen COPY taken
//     at checkout time, so editing or deleting a User address later can
//     never alter a past order's record
@Schema({ _id: true })
export class Address {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ trim: true })
  company?: string;

  @Prop({ required: true, trim: true })
  line1!: string;

  @Prop({ trim: true })
  line2?: string;

  @Prop({ required: true, trim: true })
  city!: string;

  @Prop({ trim: true })
  region?: string; // state/province

  @Prop({ required: true, trim: true })
  postalCode!: string;

  @Prop({
    required: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 2,
  })
  countryCode!: string; // ISO 3166-1 alpha-2

  @Prop({ trim: true })
  phone?: string;

  @Prop({ default: false })
  isDefault!: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
