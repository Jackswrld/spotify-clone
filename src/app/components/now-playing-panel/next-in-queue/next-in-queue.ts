import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface QueueItem {
  title: string;
  artist: string;
  thumbnailUrl: string;
  isDownloaded: boolean;
  type: 'music-video' | 'song';
}

@Component({
  selector: 'app-next-in-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './next-in-queue.html',
  styleUrl: './next-in-queue.scss',
})
export class NextInQueueComponent {
  // @Input keeps queue rendering separate from whichever API provides the queue later.
  @Input() item: QueueItem = {
    title: '',
    artist: '',
    thumbnailUrl: '',
    isDownloaded: false,
    type: 'song',
  };

  protected readonly heading = 'Next in queue';
  protected readonly openQueueLabel = 'Open queue';
  protected readonly downloadedLabel = 'Downloaded';
  protected readonly typeLabels: Record<QueueItem['type'], string> = {
    'music-video': 'Music video',
    song: 'Song',
  };
}
