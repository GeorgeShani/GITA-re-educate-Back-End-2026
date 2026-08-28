export type {
  AssistantTool,
  AssistantToolContext,
} from './assistant-tool.interface';
export { AddToCartTool } from './add-to-cart.tool';
export { ApplyCouponTool } from './apply-coupon.tool';
export { CheckStockTool } from './check-stock.tool';
export { CompareProductsTool } from './compare-products.tool';
export { GetCategoriesTool } from './get-categories.tool';
export { GetProductTool } from './get-product.tool';
export { SearchProductsTool } from './search-products.tool';
export { UpdateCartItemTool } from './update-cart-item.tool';

import { AddToCartTool } from './add-to-cart.tool';
import { ApplyCouponTool } from './apply-coupon.tool';
import { CheckStockTool } from './check-stock.tool';
import { CompareProductsTool } from './compare-products.tool';
import { GetCategoriesTool } from './get-categories.tool';
import { GetProductTool } from './get-product.tool';
import { SearchProductsTool } from './search-products.tool';
import { UpdateCartItemTool } from './update-cart-item.tool';

// SCOPE.md Phase 8's eight tools. Order matters for one thing only:
// Gemini's context caching keys off a stable prefix, so the
// declarations built from this array (and passed as config.tools on
// every call) need to stay in the same order call to call — this array
// literal already is that stable order.
export const ASSISTANT_TOOL_PROVIDERS = [
  SearchProductsTool,
  GetProductTool,
  CompareProductsTool,
  GetCategoriesTool,
  CheckStockTool,
  AddToCartTool,
  UpdateCartItemTool,
  ApplyCouponTool,
];

/** DI token for the assembled AssistantTool[] — see assistant.module.ts's factory provider. */
export const ASSISTANT_TOOLS_TOKEN = Symbol('ASSISTANT_TOOLS');
