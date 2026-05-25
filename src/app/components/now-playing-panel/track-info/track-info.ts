import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface Track {
  title: string;
  artist: string;
  albumArt: string;
  isSaved: boolean;
}

@Component({
  selector: 'app-track-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './track-info.html',
  styleUrl: './track-info.scss',
})
export class TrackInfoComponent {
  // @Input lets the parent provide API-shaped data without this child fetching it directly.
  @Input() track: Track = {
    title: '',
    artist: '',
    albumArt: '',
    isSaved: false,
  };

  protected readonly shareLabel = 'Share track';
  protected readonly savedLabel = 'Saved to your library';
}
