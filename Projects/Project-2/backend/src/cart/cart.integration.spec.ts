import mongoose from 'mongoose';

import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import {
  Category,
  CategoryDocument,
  CategorySchema,
} from '../catalog/schemas/category.schema';
import {
  Product,
  ProductDocument,
  ProductSchema,
} from '../catalog/schemas/product.schema';
import {
  Coupon,
  CouponDocument,
  CouponSchema,
} from '../coupons/schemas/coupon.schema';
import { OutboxRepository } from '../core/outbox/outbox.repository';
import {
  OutboxEvent,
  OutboxEventDocument,
  OutboxEventSchema,
} from '../core/outbox/outbox.schema';
import { ApplyCouponCommand } from './commands/apply-coupon.command';
import { ApplyCouponHandler } from './commands/handlers/apply-coupon.handler';
import { MergeGuestCartHandler } from './commands/handlers/merge-guest-cart.handler';
import { MergeGuestCartCommand } from './commands/merge-guest-cart.command';
import { CartPricingService } from './cart-pricing.service';
import { Cart, CartDocument, CartSchema } from './schemas/cart.schema';

const USER_ID = new mongoose.Types.ObjectId();
const VARIANT_SKU = 'GLV-001-L';

describe('Cart (integration)', () => {
  let ctx: MongoTestContext;
  let cartModel: mongoose.Model<CartDocument>;
  let couponModel: mongoose.Model<CouponDocument>;
  let productModel: mongoose.Model<ProductDocument>;
  let categoryModel: mongoose.Model<CategoryDocument>;
  let applyCouponHandler: ApplyCouponHandler;
  let mergeGuestCartHandler: MergeGuestCartHandler;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    cartModel = getTestModel<CartDocument>(Cart.name, CartSchema);
    couponModel = getTestModel<CouponDocument>(Coupon.name, CouponSchema);
    productModel = getTestModel<ProductDocument>(Product.name, ProductSchema);
    categoryModel = getTestModel<CategoryDocument>(
      Category.name,
      CategorySchema,
    );
    const outboxModel = getTestModel<OutboxEventDocument>(
      OutboxEvent.name,
      OutboxEventSchema,
    );
    const outboxRepository = new OutboxRepository(outboxModel);
    const cartPricingService = new CartPricingService(productModel);

    applyCouponHandler = new ApplyCouponHandler(
      mongoose.connection,
      cartModel,
      couponModel,
      productModel,
      cartPricingService,
      outboxRepository,
    );
    mergeGuestCartHandler = new MergeGuestCartHandler(
      mongoose.connection,
      cartModel,
      outboxRepository,
    );
  }, 120_000);

  beforeEach(async () => {
    const category = await categoryModel.create({
      name: 'Gloves',
      slug: 'gloves',
      path: '/',
    });
    categoryId = category.id;

    const product = await productModel.create({
      name: 'Waterproof Golf Glove',
      slug: 'waterproof-golf-glove',
      description: 'Stays dry.',
      categoryId: category._id,
      basePriceMinor: 2999,
      variants: [{ sku: VARIANT_SKU, attributes: {}, isActive: true }],
      publishedAt: new Date(),
    });
    productId = product.id;
  });

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  async function seedCartWithOneItem(): Promise<CartDocument> {
    return cartModel.create({
      userId: USER_ID,
      items: [{ productId, variantSku: VARIANT_SKU, quantity: 3 }], // 3 * 2999 = 8997
    });
  }

  describe('coupon rule evaluation', () => {
    it('applies a valid, unscoped, active coupon', async () => {
      const cart = await seedCartWithOneItem();
      await couponModel.create({
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        startsAt: new Date(Date.now() - 1000),
        isActive: true,
      });

      const updated = await applyCouponHandler.execute(
        new ApplyCouponCommand(cart.id, 'welcome10', 'corr-1'),
      );

      expect(updated.couponCode).toBe('WELCOME10');
    });

    it('rejects a coupon below its minimum spend', async () => {
      const cart = await seedCartWithOneItem(); // subtotal 8997
      await couponModel.create({
        code: 'BIGSPEND',
        type: 'fixed',
        value: 1000,
        minSpendMinor: 10000, // above the cart's subtotal
        startsAt: new Date(Date.now() - 1000),
        isActive: true,
      });

      await expect(
        applyCouponHandler.execute(
          new ApplyCouponCommand(cart.id, 'BIGSPEND', 'corr-2'),
        ),
      ).rejects.toThrow(/minimum spend/i);
    });

    it('rejects a coupon that has not started yet', async () => {
      const cart = await seedCartWithOneItem();
      await couponModel.create({
        code: 'FUTURE',
        type: 'percentage',
        value: 10,
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
      });

      await expect(
        applyCouponHandler.execute(
          new ApplyCouponCommand(cart.id, 'FUTURE', 'corr-3'),
        ),
      ).rejects.toThrow(/not valid/i);
    });

    it('rejects an expired coupon', async () => {
      const cart = await seedCartWithOneItem();
      await couponModel.create({
        code: 'EXPIRED',
        type: 'percentage',
        value: 10,
        startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isActive: true,
      });

      await expect(
        applyCouponHandler.execute(
          new ApplyCouponCommand(cart.id, 'EXPIRED', 'corr-4'),
        ),
      ).rejects.toThrow(/not valid/i);
    });

    it('rejects a category-scoped coupon whose category is not in the cart', async () => {
      const cart = await seedCartWithOneItem();
      const otherCategory = await categoryModel.create({
        name: 'Bags',
        slug: 'bags',
        path: '/',
      });
      await couponModel.create({
        code: 'BAGSONLY',
        type: 'percentage',
        value: 15,
        categoryIds: [otherCategory._id],
        startsAt: new Date(Date.now() - 1000),
        isActive: true,
      });

      await expect(
        applyCouponHandler.execute(
          new ApplyCouponCommand(cart.id, 'BAGSONLY', 'corr-5'),
        ),
      ).rejects.toThrow(/does not apply/i);
    });

    // Regression test — ApplyCouponHandler originally only checked
    // coupon.productIds for scoped-coupon eligibility, never
    // coupon.categoryIds, so a category-only coupon could never pass.
    it('accepts a category-scoped coupon whose category IS in the cart', async () => {
      const cart = await seedCartWithOneItem();
      await couponModel.create({
        code: 'GLOVES15',
        type: 'percentage',
        value: 15,
        categoryIds: [new mongoose.Types.ObjectId(categoryId)],
        startsAt: new Date(Date.now() - 1000),
        isActive: true,
      });

      const updated = await applyCouponHandler.execute(
        new ApplyCouponCommand(cart.id, 'GLOVES15', 'corr-6'),
      );

      expect(updated.couponCode).toBe('GLOVES15');
    });
  });

  describe('cart merge on login', () => {
    it('creates a new user cart from the guest cart when the user has none yet', async () => {
      const guestCart = await cartModel.create({
        guestToken: 'guest-token-1',
        items: [{ productId, variantSku: VARIANT_SKU, quantity: 2 }],
      });

      const merged = await mergeGuestCartHandler.execute(
        new MergeGuestCartCommand(
          'guest-token-1',
          USER_ID.toString(),
          'corr-7',
        ),
      );

      expect(merged?.items).toHaveLength(1);
      expect(merged?.items[0].quantity).toBe(2);
      expect(merged?.userId?.toString()).toBe(USER_ID.toString());

      // The guest cart itself is gone — nothing left pointing at that token.
      expect(await cartModel.findById(guestCart._id)).toBeNull();
    });

    it('combines quantities for a line that already exists in the user cart', async () => {
      await cartModel.create({
        userId: USER_ID,
        items: [{ productId, variantSku: VARIANT_SKU, quantity: 1 }],
      });
      await cartModel.create({
        guestToken: 'guest-token-2',
        items: [{ productId, variantSku: VARIANT_SKU, quantity: 4 }],
      });

      const merged = await mergeGuestCartHandler.execute(
        new MergeGuestCartCommand(
          'guest-token-2',
          USER_ID.toString(),
          'corr-8',
        ),
      );

      expect(merged?.items).toHaveLength(1);
      expect(merged?.items[0].quantity).toBe(5); // 1 + 4, not two separate lines
    });

    it('is a no-op for an empty guest cart', async () => {
      await cartModel.create({ guestToken: 'guest-token-empty', items: [] });

      const merged = await mergeGuestCartHandler.execute(
        new MergeGuestCartCommand(
          'guest-token-empty',
          USER_ID.toString(),
          'corr-9',
        ),
      );

      expect(merged).toBeNull();
    });
  });
});
