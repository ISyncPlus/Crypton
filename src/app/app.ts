import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toaster } from './ui/toaster';

@Component({
  selector: 'cx-root',
  imports: [RouterOutlet, Toaster],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <cx-toaster />
  `,
})
export class App {}
