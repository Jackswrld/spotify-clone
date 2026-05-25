import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { PanelStateService } from '../../services/panel-state.service';
import { Artist, ArtistAboutComponent } from './artist-about/artist-about';
import { CreditEntry, CreditsComponent } from './credits/credits';
import { NextInQueueComponent, QueueItem } from './next-in-queue/next-in-queue';
import { RelatedVideosComponent, VideoItem } from './related-videos/related-videos';
import { Track, TrackInfoComponent } from './track-info/track-info';

@Component({
  selector: 'app-now-playing-panel',
  standalone: true,
  imports: [
    CommonModule,
    TrackInfoComponent,
    RelatedVideosComponent,
    ArtistAboutComponent,
    CreditsComponent,
    NextInQueueComponent,
  ],
  templateUrl: './now-playing-panel.html',
  styleUrl: './now-playing-panel.scss',
})
export class NowPlayingPanelComponent {
  private readonly panelState = inject(PanelStateService);

  // The async pipe in the template subscribes to this stream and cleans up automatically.
  protected readonly isPanelOpen$ = this.panelState.isPanelOpen$;

  protected readonly panelLabel = 'Now playing';
  protected readonly closeLabel = 'Close now playing panel';

  protected readonly currentTrack: Track = {
    title: 'Here With Me',
    artist: 'd4vd',
    albumArt:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=700&q=80',
    isSaved: true,
  };

  protected readonly relatedVideos: VideoItem[] = [
    {
      title: 'Here With Me - Live Session',
      artist: 'd4vd',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=500&q=80',
    },
    {
      title: 'Romantic Homicide',
      artist: 'd4vd',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1504898770365-14faca6a7320?auto=format&fit=crop&w=500&q=80',
    },
    {
      title: 'Sleep Well - Official Video',
      artist: 'd4vd',
      thumbnailUrl:
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=500&q=80',
    },
  ];

  protected readonly artist: Artist = {
    name: 'd4vd',
    monthlyListeners: '21,581,652 monthly listeners',
    imageUrl:
      'https://images.unsplash.com/photo-1517230878791-4d28214057c2?auto=format&fit=crop&w=700&q=80',
    isVerified: true,
    latestRelease: 'WITHERED',
    isFollowing: false,
  };

  protected readonly credits: CreditEntry[] = [
    {
      name: 'd4vd',
      roles: ['Main Artist', 'Composer', 'Lyricist'],
      isMainArtist: true,
      isFollowing: false,
    },
    {
      name: 'Dan Darmawan',
      roles: ['Producer', 'Composer'],
      isMainArtist: false,
      isFollowing: false,
    },
    {
      name: 'David Burke',
      roles: ['Composer', 'Lyricist', 'Producer'],
      isMainArtist: false,
      isFollowing: false,
    },
  ];

  protected readonly nextInQueue: QueueItem = {
    title: 'Sleep Well',
    artist: 'd4vd',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80',
    isDownloaded: true,
    type: 'music-video',
  };

  protected closePanel(): void {
    this.panelState.togglePanel();
  }
}
