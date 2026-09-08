import type { Routes } from '@angular/router';

import { authGuard } from '@/app/core/guards/auth.guard';
import { devOnlyGuard } from '@/app/core/guards/dev-only.guard';

/**
 * Every feature is lazy — AGENTS.md requires it, and it is what keeps the
 * initial bundle inside the budget once the admin surface lands.
 *
 * Routes are added as their feature is built rather than stubbed ahead of
 * time: a route that resolves to nothing is worse than a 404, because it
 * looks like a bug rather than a missing page.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@/app/features/home/home'),
    title: '3legant Golf — More than just a game',
  },
  {
    path: 'shop',
    loadComponent: () => import('@/app/features/shop/shop'),
    title: 'Shop — 3legant Golf',
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('@/app/features/product/product-detail'),
    title: 'Product — 3legant Golf',
  },
  {
    path: 'sign-in',
    loadComponent: () => import('@/app/features/auth/sign-in'),
    title: 'Sign in — 3legant Golf',
  },
  {
    path: 'sign-up',
    loadComponent: () => import('@/app/features/auth/sign-up'),
    title: 'Create an account — 3legant Golf',
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('@/app/features/auth/forgot-password'),
    title: 'Forgot password — 3legant Golf',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('@/app/features/auth/reset-password'),
    title: 'Reset password — 3legant Golf',
  },
  {
    path: 'verify-email',
    loadComponent: () => import('@/app/features/auth/verify-email'),
    title: 'Verify email — 3legant Golf',
  },
  {
    path: 'cart',
    loadComponent: () => import('@/app/features/cart/cart'),
    title: 'Your Cart — 3legant Golf',
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('@/app/features/checkout/checkout'),
    title: 'Checkout — 3legant Golf',
  },
  {
    path: 'checkout/complete/:orderId',
    canActivate: [authGuard],
    loadComponent: () => import('@/app/features/checkout/order-complete'),
    title: 'Order placed — 3legant Golf',
  },
  {
    path: 'track',
    loadComponent: () => import('@/app/features/track/track'),
    title: 'Track your order — 3legant Golf',
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('@/app/features/account/account-shell'),
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      {
        path: 'profile',
        loadComponent: () => import('@/app/features/account/account-profile'),
        title: 'Profile — 3legant Golf',
      },
      {
        path: 'addresses',
        loadComponent: () => import('@/app/features/account/account-addresses'),
        title: 'Addresses — 3legant Golf',
      },
      {
        path: 'orders',
        loadComponent: () => import('@/app/features/account/account-orders'),
        title: 'Orders — 3legant Golf',
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('@/app/features/account/account-order-detail'),
        title: 'Order — 3legant Golf',
      },
      {
        path: 'wishlist',
        loadComponent: () => import('@/app/features/account/account-wishlist'),
        title: 'Wishlist — 3legant Golf',
      },
      {
        path: 'returns',
        loadComponent: () => import('@/app/features/account/account-returns'),
        title: 'Returns — 3legant Golf',
      },
      {
        path: 'returns/new',
        loadComponent: () => import('@/app/features/account/account-return-new'),
        title: 'Request a return — 3legant Golf',
      },
      {
        path: 'payment-methods',
        loadComponent: () => import('@/app/features/account/account-payment-methods'),
        title: 'Payment methods — 3legant Golf',
      },
      {
        path: 'settings',
        loadComponent: () => import('@/app/features/account/account-settings'),
        title: 'Settings — 3legant Golf',
      },
    ],
  },
  {
    path: 'blog',
    loadComponent: () => import('@/app/features/blog/blog-list'),
    title: 'Journal — 3legant Golf',
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('@/app/features/blog/blog-post'),
    title: 'Journal — 3legant Golf',
  },
  {
    path: 'pages/:slug',
    loadComponent: () => import('@/app/features/pages/content-page'),
    title: '3legant Golf',
  },
  {
    path: 'contact',
    loadComponent: () => import('@/app/features/contact/contact'),
    title: 'Contact us — 3legant Golf',
  },
  {
    path: 'newsletter/confirm',
    loadComponent: () => import('@/app/features/newsletter/newsletter-confirm'),
    title: 'Confirm subscription — 3legant Golf',
  },
  {
    path: 'newsletter/unsubscribe',
    loadComponent: () => import('@/app/features/newsletter/newsletter-unsubscribe'),
    title: 'Unsubscribe — 3legant Golf',
  },
  {
    path: 'styleguide',
    canActivate: [devOnlyGuard],
    loadComponent: () => import('@/app/features/styleguide/styleguide').then((m) => m.Styleguide),
    title: 'Style Guide',
  },
  {
    path: '**',
    loadComponent: () => import('@/app/features/not-found/not-found'),
    title: 'Page not found — 3legant Golf',
  },
];
