import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';

export interface VideoItem {
  title: string;
  artist: string;
  thumbnailUrl: string;
}

@Component({
  selector: 'app-related-videos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './related-videos.html',
  styleUrl: './related-videos.scss',
})
export class RelatedVideosComponent {
  // @Input keeps this presentational child reusable when real API data arrives.
  @Input() videos: VideoItem[] = [];

  @ViewChild('videoRow') private videoRow?: ElementRef<HTMLDivElement>;

  protected readonly heading = 'Related music videos';
  protected readonly scrollLabel = 'Scroll related videos';
  protected readonly playLabel = 'Play video';
  protected readonly menuLabel = 'More options';

  protected scrollRight(): void {
    this.videoRow?.nativeElement.scrollBy({ left: 220, behavior: 'smooth' });
  }
}
