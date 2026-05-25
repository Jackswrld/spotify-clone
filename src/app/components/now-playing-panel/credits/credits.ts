import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface CreditEntry {
  name: string;
  roles: string[];
  isMainArtist: boolean;
  isFollowing: boolean;
}

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credits.html',
  styleUrl: './credits.scss',
})
export class CreditsComponent {
  // @Input gives this list component only the credits slice it needs.
  @Input() credits: CreditEntry[] = [];

  protected readonly heading = 'Credits';
  protected readonly showAllLabel = 'Show all';
  protected readonly followLabel = 'Follow';

  protected formatRoles(roles: string[]): string {
    return roles.join(' · ');
  }
}
