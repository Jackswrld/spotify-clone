import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LibraryItem {
  id: number;
  title: string;
  subtitle: string;
  category: 'Playlist' | 'Album' | 'Artist' | 'Podcast';
  imageUrl: string;
  isActive: boolean;
  badgeColor: string;
  downloaded: boolean;
}

export interface LibraryFilter {
  label: string;
  value: 'All' | 'Playlists' | 'Podcasts' | 'Albums' | 'Artists' | 'Downloaded';
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './library.html',
  styleUrls: ['./library.scss'],
})
export class Library {
  protected readonly playerHeight = '88px';
  protected sidebarState: 'collapsed' | 'normal' | 'expanded' = 'normal';
  protected selectedFilter: LibraryFilter['value'] = 'All';

  protected readonly filters: LibraryFilter[] = [
    { label: 'Playlists', value: 'Playlists' },
    { label: 'Podcasts', value: 'Podcasts' },
    { label: 'Albums', value: 'Albums' },
    { label: 'Artists', value: 'Artists' },
    { label: 'Downloaded', value: 'Downloaded' },
  ];

  protected readonly libraryItems: LibraryItem[] = [
    {
      id: 1,
      title: 'Late Night Vibes',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #5e4ce0 0%, #b144ff 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 2,
      title: 'Naija Hits 🔥',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #ff4f6a 0%, #ffbe72 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 3,
      title: 'Afrobeats 2024',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #11b8d3 0%, #183c7f 100%)',
      isActive: true,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 4,
      title: 'Sad Hours 🌙',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #7f56d9 0%, #3f3efc 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 5,
      title: 'Road Trip Bangers',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #f53e2d 0%, #ff8a41 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 6,
      title: 'Lo-fi Study Session',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #3b3f9a 0%, #68c6cc 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 7,
      title: 'Gym Mode 💪',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #2dbb9f 0%, #19f3d5 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 8,
      title: 'RnB Sundays',
      subtitle: 'Playlist',
      category: 'Playlist',
      imageUrl: 'linear-gradient(135deg, #511d6b 0%, #c23cdd 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 9,
      title: 'After Hours',
      subtitle: 'The Weeknd',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #140f3a 0%, #4b3b9c 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 10,
      title: 'Legends Never Die',
      subtitle: 'Juice WRLD',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #d7648c 0%, #ffb0c9 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 11,
      title: 'Certified Lover Boy',
      subtitle: 'Drake',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #2c5364 0%, #0f2027 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 12,
      title: 'Mr. Morale & The Big Steppers',
      subtitle: 'Kendrick Lamar',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #372c25 0%, #8d4d2e 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 13,
      title: 'SOS',
      subtitle: 'SZA',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #3e1f52 0%, #9e5fd2 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 14,
      title: 'IGOR',
      subtitle: 'Tyler, The Creator',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #d48330 0%, #f0b345 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 15,
      title: 'Whole Lotta Red',
      subtitle: 'Playboi Carti',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #730003 0%, #d21d2d 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: true,
    },
    {
      id: 16,
      title: 'Hollywood’s Bleeding',
      subtitle: 'Post Malone',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #140f1f 0%, #6c4e9e 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 17,
      title: 'Happier Than Ever',
      subtitle: 'Billie Eilish',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #1f2833 0%, #90d7ff 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 18,
      title: 'A Different Kind of Human',
      subtitle: 'AURORA',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #602b8f 0%, #b689ff 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 19,
      title: '=',
      subtitle: 'Ed Sheeran',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #0f323f 0%, #18b1a3 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 20,
      title: 'Blonde',
      subtitle: 'Frank Ocean',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #f2c0ca 0%, #8b73c1 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 21,
      title: 'Astroworld',
      subtitle: 'Travis Scott',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #1a172f 0%, #413b71 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 22,
      title: 'Chemtrails over the Country Club',
      subtitle: 'Lana Del Rey',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #5b4c66 0%, #c782c2 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 23,
      title: 'Demons Protected by Angels',
      subtitle: 'NAV',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #2b2d35 0%, #467880 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 24,
      title: 'Drip or Drown 2',
      subtitle: 'Gunna',
      category: 'Album',
      imageUrl: 'linear-gradient(135deg, #432b26 0%, #d68d54 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 25,
      title: 'Rap Caviar',
      subtitle: 'Podcast',
      category: 'Podcast',
      imageUrl: 'linear-gradient(135deg, #0c1f2d 0%, #0b5263 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },
    {
      id: 26,
      title: 'Table Manners',
      subtitle: 'Podcast',
      category: 'Podcast',
      imageUrl: 'linear-gradient(135deg, #7a4f2d 0%, #ffba7f 100%)',
      isActive: false,
      badgeColor: '',
      downloaded: false,
    },

    {
      id: 27,
      title: 'Working Hard',
      subtitle: 'Podcast',
      category: 'Podcast',
      imageUrl: 'linear-gradient(135deg, #45b494 0%, #421bce 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: false,
    },

    {
      id: 28,
      title: 'Jack wrld',
      subtitle: 'Singer, Songwriter',
      category: 'Artist',
      imageUrl: 'linear-gradient(135deg, #d529a1 0%, #fcef63 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: false,
    },

     {
      id: 29,
      title: 'AURORA',
      subtitle: 'Singer',
      category: 'Artist',
      imageUrl: 'linear-gradient(135deg, #71f9d3 0%, #007b7d 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: false,
    },

    {
      id: 30,
      title: 'Alan Walker',
      subtitle: 'DJ and record producer',
      category: 'Artist',
      imageUrl: 'linear-gradient(135deg, #040082 0%, #007b7d 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: false,
    },

     {
      id: 31,
      title: 'The Weeknd',
      subtitle: 'Singer and Songwriter',
      category: 'Artist',
      imageUrl: 'linear-gradient(135deg, #c90b0b 0%, #030c0c 100%)',
      isActive: false,
      badgeColor: 'aqua',
      downloaded: false,
    },
  ];

  protected get filteredLibraryItems(): LibraryItem[] {
    const requested = this.selectedFilter;
    if (requested === 'All') {
      return this.libraryItems;
    }

    if (requested === 'Downloaded') {
      return this.libraryItems.filter((item) => item.downloaded);
    }

    return this.libraryItems.filter((item) => {
      if (item.category === 'Playlist' && requested === 'Playlists') {
        return true;
      }
      if (item.category === 'Podcast' && requested === 'Podcasts') {
        return true;
      }
      if (item.category === 'Album' && requested === 'Albums') {
        return true;
      }
      if (item.category === 'Artist' && requested === 'Artists') {
        return true;
      }
      return false;
    });
  }

  protected toggleCollapse(): void {
    this.sidebarState = this.sidebarState === 'collapsed' ? 'normal' : 'collapsed';
  }

  protected expandSidebar(): void {
    this.sidebarState = this.sidebarState === 'expanded' ? 'normal' : 'expanded';
  }

  protected selectFilter(filter: LibraryFilter['value']): void {
    this.selectedFilter = filter;
  }

  protected selectItem(item: LibraryItem): void {
    this.libraryItems.forEach((entry) => {
      entry.isActive = entry.id === item.id;
    });
  }
}
