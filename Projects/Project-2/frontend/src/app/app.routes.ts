import { Routes } from '@angular/router';

import { devOnlyGuard } from './core/guards/dev-only.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.HomePage),
    title: '3legant Golf — Golf Accessories & Gear',
  },
  {
    path: 'styleguide',
    canActivate: [devOnlyGuard],
    loadComponent: () => import('./features/styleguide/styleguide').then((m) => m.Styleguide),
    title: 'Style Guide',
  },
];
