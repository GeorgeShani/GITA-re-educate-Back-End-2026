import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from '@/app/core/interceptors/auth.interceptor';
import { correlationIdInterceptor } from '@/app/core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from '@/app/core/interceptors/error.interceptor';
import { MockProductService } from '@/app/core/services/mock-product.service';
import { ProductService } from '@/app/core/services/product.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withComponentInputBinding(),
    ),
    // Incremental hydration is on by default as of v22 — withIncrementalHydration()
    // is deprecated, don't add it back. withEventReplay() captures clicks/inputs
    // that happen before hydration finishes and replays them once it does, which
    // is what actually protects perceived responsiveness on a slow connection.
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ includePostRequests: false }),
    ),
    // withFetch() is deprecated too — FetchBackend is the default HttpBackend
    // as of v22.
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, authInterceptor, errorInterceptor]),
    ),
    // MockProductService until a real backend exists — swap this one line
    // for a real HTTP-backed implementation later, no component changes.
    { provide: ProductService, useClass: MockProductService },
  ],
};
