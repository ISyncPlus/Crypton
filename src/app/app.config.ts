import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { clockInterceptor } from './core/clock.interceptor';
import { AuthService } from './core/auth.service';
import { MarketService } from './core/market.service';
import { NotificationsService } from './core/notifications.service';
import { ThemeService } from './core/theme.service';
import { CryptonTitleStrategy } from './title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    { provide: TitleStrategy, useClass: CryptonTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([clockInterceptor, authInterceptor])),
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(NotificationsService);
      inject(MarketService).start();
      return inject(AuthService).restore();
    }),
  ],
};
