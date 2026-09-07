import type { Routes } from '@angular/router';

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
