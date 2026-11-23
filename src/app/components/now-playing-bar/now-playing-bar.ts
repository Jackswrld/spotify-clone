import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-now-playing-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './now-playing-bar.html',
  styleUrl: './now-playing-bar.scss'
})
export class NowPlayingBarComponent {
  @Input() albumArt = 'https://placehold.co/56x56';
  @Input() songTitle = 'Smooth Criminal';
  @Input() artistName = 'Michael Jackson';
  @Input() isPlaying = false;
  @Input() currentTime = 0;
  @Input() duration = 240;
  @Input() volume = 70;
  @Input() isShuffled = false;
  @Input() repeatMode = 'off';
  @Input() isMuted = false;

  @Output() onPlayPause = new EventEmitter<void>();
  @Output() onNext = new EventEmitter<void>();
  @Output() onPrevious = new EventEmitter<void>();
  @Output() onShuffle = new EventEmitter<void>();
  @Output() onRepeat = new EventEmitter<void>();
  @Output() onSeek = new EventEmitter<number>();
  @Output() onVolumeChange = new EventEmitter<number>();
  @Output() onMute = new EventEmitter<void>();
  @Output() onLyrics = new EventEmitter<void>();
  @Output() onQueue = new EventEmitter<void>();
  @Output() onMiniPlayer = new EventEmitter<void>();
  @Output() onFullscreen = new EventEmitter<void>();

  get playPauseIcon(): string {
    return this.isPlaying ? 'fa-pause' : 'fa-play';
  }

  get volumeIcon(): string {
    return this.isMuted ? 'fa-volume-xmark' : 'fa-volume-high';
  }

  get repeatActive(): boolean {
    return this.repeatMode !== 'off';
  }

  get currentTimeLabel(): string {
    return this.formatTime(Math.min(this.currentTime, this.duration));
  }

  get remainingTimeLabel(): string {
    return this.formatTime(Math.max(this.duration - this.currentTime, 0));
  }

  handlePlayPause(): void {
    this.onPlayPause.emit();
  }

  handleNext(): void {
    this.onNext.emit();
  }

  handlePrevious(): void {
    this.onPrevious.emit();
  }

  handleShuffle(): void {
    this.onShuffle.emit();
  }

  handleRepeat(): void {
    this.onRepeat.emit();
  }

  handleSeek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.onSeek.emit(value);
  }

  handleVolumeChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.onVolumeChange.emit(value);
  }

  handleMute(): void {
    this.onMute.emit();
  }

  handleLyrics(): void {
    this.onLyrics.emit();
  }

  handleQueue(): void {
    this.onQueue.emit();
  }

  handleMiniPlayer(): void {
    this.onMiniPlayer.emit();
  }

  handleFullscreen(): void {
    this.onFullscreen.emit();
  }

  private formatTime(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }
}
