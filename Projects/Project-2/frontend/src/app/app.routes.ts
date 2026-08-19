import { Routes } from '@angular/router';

import { devOnlyGuard } from './core/guards/dev-only.guard';

// The '' home route was demolished along with the navbar/footer/homepage
// composition (see the reset-and-re-platform plan) — no real page exists
// to serve at '/' yet. /styleguide stays as the only route until the
// shell is rebuilt.
export const routes: Routes = [
  {
    path: 'styleguide',
    canActivate: [devOnlyGuard],
    loadComponent: () => import('./features/styleguide/styleguide').then((m) => m.Styleguide),
    title: 'Style Guide',
  },
];
