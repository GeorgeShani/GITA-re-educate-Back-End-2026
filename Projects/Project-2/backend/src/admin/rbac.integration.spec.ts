import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { Roles, ROLES_KEY } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@/common/interfaces/request-with-user.interface';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminBlogController } from '@/blog/admin-blog.controller';
import { AdminCategoriesController } from '@/catalog/admin-categories.controller';
import { AdminProductsController } from '@/catalog/admin-products.controller';
import { AdminContactController } from '@/contact/admin-contact.controller';
import { AdminCouponsController } from '@/coupons/admin-coupons.controller';
import { AdminGiftCardsController } from '@/gift-cards/admin-gift-cards.controller';
import { AdminInventoryController } from '@/inventory/admin-inventory.controller';
import { AdminMediaController } from '@/media/admin-media.controller';
import { AdminNewsletterController } from '@/newsletter/admin-newsletter.controller';
import { AdminEmailController } from '@/notifications/admin-email.controller';
import { AdminOrdersController } from '@/orders/admin-orders.controller';
import { AdminPagesController } from '@/pages/admin-pages.controller';
import { AdminReturnsController } from '@/returns/admin-returns.controller';
import { AdminReviewsController } from '@/reviews/admin-reviews.controller';
import { AdminShippingController } from '@/shipping/admin-shipping.controller';
import { AdminTaxController } from '@/tax/admin-tax.controller';
import { AdminUsersController } from '@/users/admin-users.controller';

// SCOPE.md Part D priority #9: "RBAC on every admin route." Rather than
// duplicating the same guard-behavior assertions 19 times (one per
// controller), this does two things:
//   1. Unit-tests RolesGuard itself thoroughly — the one mechanism every
//      admin route actually depends on.
//   2. Statically enumerates every real admin controller in the app and
//      asserts each one actually carries JwtAuthGuard + RolesGuard +a
//      non-empty @Roles() matching its documented ADMIN_ROLES bucket —
//      so a new admin controller that forgets to gate itself fails this
//      test immediately, without needing its own bespoke spec.
const ADMIN_CONTROLLERS: {
  name: string;
  controller: new (...args: never[]) => unknown;
  expectedRoles: readonly Role[];
}[] = [
  {
    name: 'AdminDashboardController',
    controller: AdminDashboardController,
    expectedRoles: [Role.ADMIN],
  },
  {
    name: 'AdminAuditLogController',
    controller: AdminAuditLogController,
    expectedRoles: [Role.ADMIN],
  },
  {
    name: 'AdminProductsController',
    controller: AdminProductsController,
    expectedRoles: ADMIN_ROLES.catalog,
  },
  {
    name: 'AdminCategoriesController',
    controller: AdminCategoriesController,
    expectedRoles: ADMIN_ROLES.catalog,
  },
  {
    name: 'AdminInventoryController',
    controller: AdminInventoryController,
    expectedRoles: ADMIN_ROLES.catalog,
  },
  {
    name: 'AdminMediaController',
    controller: AdminMediaController,
    expectedRoles: ADMIN_ROLES.catalog,
  },
  {
    name: 'AdminOrdersController',
    controller: AdminOrdersController,
    expectedRoles: ADMIN_ROLES.commerce,
  },
  {
    name: 'AdminReturnsController',
    controller: AdminReturnsController,
    expectedRoles: ADMIN_ROLES.commerce,
  },
  {
    name: 'AdminReviewsController',
    controller: AdminReviewsController,
    expectedRoles: ADMIN_ROLES.commerce,
  },
  {
    name: 'AdminCouponsController',
    controller: AdminCouponsController,
    expectedRoles: ADMIN_ROLES.money,
  },
  {
    name: 'AdminGiftCardsController',
    controller: AdminGiftCardsController,
    expectedRoles: ADMIN_ROLES.money,
  },
  {
    name: 'AdminShippingController',
    controller: AdminShippingController,
    expectedRoles: ADMIN_ROLES.money,
  },
  {
    name: 'AdminTaxController',
    controller: AdminTaxController,
    expectedRoles: ADMIN_ROLES.money,
  },
  {
    name: 'AdminBlogController',
    controller: AdminBlogController,
    expectedRoles: ADMIN_ROLES.content,
  },
  {
    name: 'AdminPagesController',
    controller: AdminPagesController,
    expectedRoles: ADMIN_ROLES.content,
  },
  {
    name: 'AdminContactController',
    controller: AdminContactController,
    expectedRoles: ADMIN_ROLES.content,
  },
  {
    name: 'AdminNewsletterController',
    controller: AdminNewsletterController,
    expectedRoles: ADMIN_ROLES.content,
  },
  {
    name: 'AdminEmailController',
    controller: AdminEmailController,
    expectedRoles: ADMIN_ROLES.content,
  },
  {
    name: 'AdminUsersController',
    controller: AdminUsersController,
    expectedRoles: ADMIN_ROLES.people,
  },
];

describe('Admin RBAC (integration)', () => {
  describe('every admin controller is gated', () => {
    it.each(ADMIN_CONTROLLERS)(
      '$name requires JwtAuthGuard + RolesGuard and a non-empty @Roles() matching its ADMIN_ROLES bucket',
      ({ controller, expectedRoles }) => {
        const guards: unknown[] =
          Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
        expect(guards).toContain(JwtAuthGuard);
        expect(guards).toContain(RolesGuard);

        const roles: Role[] | undefined = Reflect.getMetadata(
          ROLES_KEY,
          controller,
        );
        expect(roles).toBeDefined();
        expect(roles!.length).toBeGreaterThan(0);
        // ADMIN.ROLES.people is admin-only by design — every other
        // bucket's controller should accept exactly its own bucket.
        expect([...roles!].sort()).toEqual([...expectedRoles].sort());
        // ADMIN is always in the mix — no bucket ever excludes the
        // superset role.
        expect(roles).toContain(Role.ADMIN);
      },
    );
  });

  describe('RolesGuard behavior', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    class UnguardedRoute {
      handler() {}
    }

    class AdminOnlyRoute {
      @Roles(Role.ADMIN)
      handler() {}
    }

    class CatalogRoute {
      @Roles(Role.ADMIN, Role.MANAGER)
      handler() {}
    }

    function contextFor(
      target: new () => object,
      handlerName: string,
      user?: AuthenticatedUser,
    ): ExecutionContext {
      // @Roles() is SetMetadata, which attaches metadata to the method
      // itself (descriptor.value) — that lives on the prototype, not on
      // the class/constructor. getHandler() must return that same
      // function reference for Reflector to find it.
      return {
        getHandler: () => (target.prototype as never)[handlerName],
        getClass: () => target,
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows any authenticated request through when no @Roles() is declared', () => {
      const ctx = contextFor(UnguardedRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.CUSTOMER,
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows a request whose role is in the required set', () => {
      const ctx = contextFor(AdminOnlyRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.ADMIN,
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects a request whose role is not in the required set', () => {
      const ctx = contextFor(AdminOnlyRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.CUSTOMER,
      });
      expect(() => guard.canActivate(ctx)).toThrow(/Insufficient role/);
    });

    it('rejects a request with no user at all when roles are required', () => {
      const ctx = contextFor(AdminOnlyRoute, 'handler', undefined);
      expect(() => guard.canActivate(ctx)).toThrow(/Insufficient role/);
    });

    it('allows any one of multiple accepted roles, not just the first', () => {
      const asManager = contextFor(CatalogRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.MANAGER,
      });
      expect(guard.canActivate(asManager)).toBe(true);

      const asAdmin = contextFor(CatalogRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.ADMIN,
      });
      expect(guard.canActivate(asAdmin)).toBe(true);
    });

    it('rejects a role outside the accepted set even when other admin-adjacent roles would pass elsewhere', () => {
      const asSupport = contextFor(CatalogRoute, 'handler', {
        userId: 'u1',
        email: 'a@b.com',
        role: Role.SUPPORT, // valid for ADMIN_ROLES.commerce, not .catalog
      });
      expect(() => guard.canActivate(asSupport)).toThrow(/Insufficient role/);
    });
  });
});
