import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { Artist } from '../models';
import { exactKey } from '../title';

export interface ArtistPhoto {
  image: string | null;
  fans: number;
}

const NONE: ArtistPhoto = { image: null, fans: 0 };

/** Real artist photos and fan counts (Deezer, through the music server). Apple's search has neither. */
@Injectable({ providedIn: 'root' })
export class ArtistPhotoApi {
  private readonly http = inject(HttpClient);
  private readonly memory = new Map<string, Observable<ArtistPhoto>>();

  photoFor(name: string): Observable<ArtistPhoto> {
    const key = exactKey(name);
    let photo = this.memory.get(key);
    if (!photo) {
      photo = this.http
        .get<ArtistPhoto>('/api/artist-photo', { params: new HttpParams().set('name', name.trim()) })
        .pipe(
          map((r) => ({ image: r?.image ?? null, fans: Number(r?.fans) || 0 })),
          catchError(() => {
            this.memory.delete(key); // a failure is retried next time
            return of(NONE);
          }),
          shareReplay(1),
        );
      this.memory.set(key, photo);
    }
    return photo;
  }

  /** A catalog artist with their photo and fan count filled in; Audius artists are returned as they are. */
  withPhoto(artist: Artist): Observable<Artist> {
    if (artist.source !== 'catalog') return of(artist);
    return this.photoFor(artist.name).pipe(
      map((p) => ({
        ...artist,
        avatar: p.image ? { small: p.image, medium: p.image, large: p.image } : artist.avatar,
        followerCount: p.fans,
      })),
    );
  }
}
