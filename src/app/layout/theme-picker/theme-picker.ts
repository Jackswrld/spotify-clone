import { Component, ElementRef, inject, signal } from '@angular/core';
import { ThemeService } from '../../state/theme.service';

/** Palette button in the top bar; opens the list of colour themes. */
@Component({
  selector: 'app-theme-picker',
  templateUrl: './theme-picker.html',
  styleUrl: './theme-picker.scss',
  host: {
    '(document:keydown.escape)': 'open.set(false)',
    '(document:click)': 'closeIfOutside($event)',
  },
})
export class ThemePicker {
  protected readonly themes = inject(ThemeService);
  protected readonly open = signal(false);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected readonly groups = [
    { label: 'Dark', items: this.themes.themes.filter((t) => t.mode === 'dark') },
    { label: 'Light', items: this.themes.themes.filter((t) => t.mode === 'light') },
  ];

  protected pick(id: string): void {
    this.themes.set(id);
  }

  protected closeIfOutside(event: Event): void {
    if (this.open() && !this.el.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
