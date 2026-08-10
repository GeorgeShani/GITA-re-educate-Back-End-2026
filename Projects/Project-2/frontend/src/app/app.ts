import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconSprite } from '@/app/shared/ui/icon-sprite';
import { ToastStack } from '@/app/shared/ui/toast-stack';

@Component({
  selector: 'store-root',
  imports: [RouterOutlet, IconSprite, ToastStack],
  template: `
    <icon-sprite />
    <toast-stack />
    <router-outlet />
  `,
})
export class App {}
