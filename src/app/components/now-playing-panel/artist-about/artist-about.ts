import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface Artist {
  name: string;
  monthlyListeners: string;
  imageUrl: string;
  isVerified: boolean;
  latestRelease: string;
  isFollowing: boolean;
}

@Component({
  selector: 'app-artist-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './artist-about.html',
  styleUrl: './artist-about.scss',
})
export class ArtistAboutComponent {
  // @Input receives one artist object from the parent, matching future API data flow.
  @Input() artist: Artist = {
    name: '',
    monthlyListeners: '',
    imageUrl: '',
    isVerified: false,
    latestRelease: '',
    isFollowing: false,
  };

  protected readonly heading = 'About the artist';
  protected readonly verifiedLabel = 'Verified artist';
  protected readonly followLabel = 'Follow';
}
