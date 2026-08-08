import { Routes } from '@angular/router';

import { devOnlyGuard } from './core/guards/dev-only.guard';

export const routes: Routes = [
  {
    path: 'styleguide',
    canActivate: [devOnlyGuard],
    loadComponent: () => import('./features/styleguide/styleguide').then((m) => m.Styleguide),
    title: 'Style Guide',
  },
];
