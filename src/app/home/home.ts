import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

// Interfaces for type safety
interface QuickPlayItem {
  id: number;
  name: string;
  gradient: string;
}

interface FeaturedRelease {
  artist: string;
  albumType: string;
  albumTitle: string;
  gradient: string;
  artistGradient: string;
}

interface ShelfItem {
  id: number;
  title: string;
  subtitle: string;
  gradient: string;
}

interface NewReleaseItem {
  id: number;
  title: string;
  artist: string;
  gradient: string;
  titleColor?: string;
}

interface StationItem {
  id: number;
  name: string;
  subtitle: string;
  bg: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit {
  // Greeting and fun facts
  greeting: string = '';
  funFact: string = '';

  // Filter pills state
  selectedFilter: string = 'All';

  // Quick play grid mock data
  quickPlay: QuickPlayItem[] = [
    { id: 1, name: 'BEASTARS - ビースターズ-', gradient: 'linear-gradient(135deg,#1a1a2e,#e94560)' },
    { id: 2, name: 'BEST of REMA', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)' },
    { id: 3, name: 'DJ', gradient: 'linear-gradient(135deg,#00b09b,#96c93d)' },
    { id: 4, name: 'Musical Instruments', gradient: 'linear-gradient(135deg,#4776e6,#8e54e9)' },
    { id: 5, name: 'Hurry Up Tomorrow', gradient: 'linear-gradient(135deg,#0f0c29,#302b63)' },
    { id: 6, name: 'My Weeknd', gradient: 'linear-gradient(135deg,#c94b4b,#4b134f)' },
    { id: 7, name: "Jack's Wrld", gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' },
    { id: 8, name: 'Afrobeats 2024', gradient: 'linear-gradient(135deg,#f953c6,#b91d73)' }
  ];

  // Featured release mock data
  featuredRelease: FeaturedRelease = {
    artist: 'Drake',
    albumType: 'Album',
    albumTitle: ' MAID OF HONOUR',
    gradient: 'linear-gradient(135deg,#908080,#706060)',
    artistGradient: 'linear-gradient(135deg,#555,#222)'
  };

  // Made For You shelf mock data
  madeForYou: ShelfItem[] = [
    { id: 1, title: 'Discover Weekly', subtitle: 'Your shortcut to hidden gems, deep cuts and new artists', gradient: 'linear-gradient(135deg,#4a1a6b,#e85d04)' },
    { id: 2, title: 'Daily Mix 1', subtitle: 'Fireboy DML, Burna Boy, OMAH LAY and more', gradient: 'linear-gradient(135deg,#0d3b6e,#00b4d8)' },
    { id: 3, title: 'Daily Mix 2', subtitle: 'AURORA, Taylor Swift, Ariana Grande and more', gradient: 'linear-gradient(135deg,#1a5c3a,#a8e063)' },
    { id: 4, title: 'Daily Mix 3', subtitle: 'RADWIMPS, Kōsaki, YOASOBI and more', gradient: 'linear-gradient(135deg,#6b2d2d,#f77f00)' },
    { id: 5, title: 'Release Radar', subtitle: 'Catch all the latest music from artists you follow', gradient: 'linear-gradient(135deg,#2c3e50,#fd746c)' },
    { id: 6, title: 'On Repeat', subtitle: "Songs you just can't stop playing right now", gradient: 'linear-gradient(135deg,#134e5e,#71b280)' }
  ];

  // Recents shelf mock data
  recents: ShelfItem[] = [
    { id: 1, title: 'Blue cool', subtitle: 'Playlist • jack wrld', gradient: 'linear-gradient(135deg,#2193b0,#6dd5ed)' },
    { id: 2, title: 'DJ', subtitle: 'Playlist • Spotify', gradient: 'linear-gradient(135deg,#00b09b,#96c93d)' },
    { id: 3, title: 'BEASTARS - ビース...', subtitle: 'Playlist • Spotify', gradient: 'linear-gradient(135deg,#1a1a2e,#e94560)' },
    { id: 4, title: 'Liked Songs', subtitle: 'Playlist • Spotify', gradient: 'linear-gradient(135deg,#4776e6,#8e54e9)' },
    { id: 5, title: 'KPop Demon Hunters', subtitle: 'Playlist • jack wrld', gradient: 'linear-gradient(135deg,#c94b4b,#4b134f)' },
    { id: 6, title: 'Afrobeats 2024', subtitle: 'Playlist • Various Artists', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' }
  ];

   // Jump back in shelf mock data
  jumpBackIn: ShelfItem[] = [
    { id: 1, title: 'BEST of REMA', subtitle: 'Playlist • Wisdom', gradient: 'linear-gradient(50deg,#2A2A2A,#C63A22, #D96B3B, #8CC7E8)' },
    { id: 2, title: 'After Hours', subtitle: 'The Weeknd', gradient: 'linear-gradient(135deg,#2A2A2A,#FF0000)' },
    { id: 3, title: 'Anime', subtitle: 'Playlist • jack wrld', gradient: 'linear-gradient(135deg,#1a1a2e,#F2C94C)' },
    { id: 4, title: 'Gospel', subtitle: 'Playlist • jack wrld', gradient: 'linear-gradient(135deg,#F4EBDD,#8e54e9)' },
    { id: 5, title: 'Pureojuice', subtitle: 'Playlist • SSBN JAY', gradient: 'linear-gradient(135deg,#c94b4b,#4b134f, #8CC7E8)' },
    { id: 6, title: 'Afrobeats 2024', subtitle: 'Playlist • Various Artists', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' }
  ];
  // New releases shelf mock data
  newReleases: NewReleaseItem[] = [
    { id: 1, title: 'MISS U', artist: 'Henry Moodie', gradient: 'linear-gradient(135deg,#232526,#414345)' },
    { id: 2, title: 'Space Racer (Invincible UK Rage...)', artist: 'Pureojuice', gradient: 'linear-gradient(135deg,#1a1a2e,#4a4a8a)' },
    { id: 3, title: 'Dai Dai', artist: 'Shakira, Burna Boy', gradient: 'linear-gradient(135deg,#fff,#ddd)', titleColor: '#000' },
    { id: 4, title: 'Hello', artist: 'Tml Vibez, Victony', gradient: 'linear-gradient(135deg,#8B0000,#FF4500)' },
    { id: 5, title: 'MAID OF HONOUR', artist: 'Drake', gradient: 'linear-gradient(135deg,#bdc3c7,#2c3e50)' },
    { id: 6, title: 'Midnight Rain', artist: 'Taylor Swift', gradient: 'linear-gradient(135deg,#141e30,#243b55)' }
  ];

  // Recommended stations shelf mock data
  stations: StationItem[] = [
    { id: 1, name: 'Billie Eilish', subtitle: 'By Spotify', bg: '#ff6b6b' },
    { id: 2, name: 'NF', subtitle: 'By Spotify', bg: '#ff8e53' },
    { id: 3, name: 'Bryant Barnes', subtitle: 'With Breezee, Chezile, jasontheween and...', bg: '#c6f135' },
    { id: 4, name: 'Falling Behind', subtitle: 'With Laufey, beabadoobee, Faye...', bg: '#64e0c8' },
    { id: 5, name: 'Alone', subtitle: 'With Trevor Daniel, Joshua Golden, Lun...', bg: '#e8a87c' }
  ];

  // Fun facts array
  private funFacts: string[] = [
    "Did you know? The world's longest concert was designed to last 639 years. 🎶",
    "Fun fact: Listening to music while working out can boost performance by up to 15%.",
    "A study found cows produce more milk when listening to slow music. 🐄🎵",
    "Mozart wrote his first symphony at age 8. What were you doing at 8? 😅",
    "The most-streamed Spotify song ever is Blinding Lights by The Weeknd.",
    "Music activates every known part of the brain. You're basically a concert hall. 🧠",
    "Did you know? Music can be enjoyed in  different languages",
    "Did you know? The world's longest concert is scheduled to last 639 years. 🎶",
"Fun fact: The Weeknd’s Blinding Lights is one of the most-streamed songs in Spotify history.",
"Michael Jackson’s Thriller remains one of the best-selling albums ever. 👑",
"Did you know? Spotify was originally launched in Sweden in 2008. 🇸🇪",
"Fun fact: Beyoncé became the first Black woman to headline Coachella. 🐝",
"Drake once broke Spotify’s single-day streaming record in under 24 hours.",
"Did you know? Vinyl records are older than cassette tapes. 📀",
"Taylor Swift is one of the most-streamed female artists of all time. ✨",
"Fun fact: Music can trigger memories stronger than smells or pictures. 🧠🎵",
"Kendrick Lamar won a Pulitzer Prize for his album DAMN. 🏆",
"Did you know? Billie Eilish recorded Ocean Eyes in her bedroom. 🛏️🎶",
"The Beatles hold the record for the most No.1 songs on the Billboard Hot 100.",
"Fun fact: Listening to music while studying can improve focus for some people. 🎧",
"Travis Scott’s Astroworld album was inspired by a real amusement park. 🎢",
"Did you know? Mozart wrote his first symphony at just 8 years old.",
"Rihanna became a billionaire partly through music and entertainment ventures. 💎",
"Fun fact: Some albums take years to make, while others are recorded in days.",
"The first music video ever played on MTV was Video Killed the Radio Star. 📺",
"Did you know? Ed Sheeran wrote Shape of You in less than an hour. ⏳",
"Streaming has officially become the biggest source of music revenue worldwide.",
"Fun fact: SZA’s SOS broke multiple streaming records after release. 🌊",
"Elvis Presley never performed outside North America. 🎤",
"Did you know? The loudest concert ever reportedly reached 126 decibels. 🔊",
"Frank Ocean’s Blonde was released independently and still became a massive success.",
"Fun fact: Ariana Grande used to act on Nickelodeon before dominating music charts.",
"Spotify playlists can completely change an artist’s career overnight.",
"Did you know? Tupac once studied ballet and poetry. 🩰",
"Bad Bunny became Spotify’s most-streamed artist multiple years in a row.",
"Fun fact: Album covers are considered a major part of music branding.",
"The Weeknd’s real name is Abel Tesfaye.",
"Did you know? Kanye West produced beats for other artists before becoming famous as a rapper.",
"Music festivals can attract hundreds of thousands of fans yearly. 🎪",
"Fun fact: Some artists hide secret messages inside songs for fans to discover.",
"Daft Punk hid their faces for most of their career. 🤖",
"Did you know? The first iPod could hold around 1,000 songs.",
"Olivia Rodrigo’s driver license broke Spotify streaming records after release.",
"Fun fact: Live concerts can burn as many calories as a workout. 💃",
"Eminem’s Rap God contains over 1,500 words. 🔥",
"Did you know? Some songs are banned on radio stations because they’re too emotional after tragic events.",
"Tyler, The Creator designs visuals and stage concepts for many of his projects.",
"Fun fact: Music producers often spend hundreds of hours mixing one album.",
"Bruno Mars was performing on stage as a child before becoming famous.",
"Did you know? K-pop albums often include collectible photocards for fans. 📸",
"The longest officially released song is over 13 hours long. 😭",
"Fun fact: Album rollouts are carefully planned like movie promotions.",
"Juice WRLD recorded many songs through freestyle sessions. 🎙️",
"Did you know? Some artists record vocals inside closets for better sound.",
"Streaming platforms pay artists per stream, but the amount varies widely.",
"Fun fact: Many hit songs were originally written for different artists.",
"XXXTENTACION gained popularity mainly through SoundCloud. ☁️",
"Did you know? Adele’s albums are named after her age during production.",
"Music videos can cost millions of dollars to produce. 🎬",
"Fun fact: Fans sometimes solve hidden clues artists leave before album releases.",
"Metro Boomin originally wanted to become a bass player.",
"Did you know? The first Grammy Awards happened in 1959. 🏆",
"Some artists record over 100 songs before choosing an album tracklist.",
"Fun fact: Concert crowds can sometimes sing louder than the artist. 🎤",
"Playboi Carti’s Whole Lotta Red became a huge internet culture moment.",
"Did you know? Lo-fi music became popular because it helps people relax and study.",
"Artists sometimes change album names just days before release.",
"Fun fact: Background vocals can completely change the emotion of a song.",
"The most expensive music video ever made reportedly cost over $7 million.",
"Did you know? DJ stands for Disc Jockey. 🎛️",
"Streaming numbers can reach billions for global hit songs.",
"Fun fact: Some songs become popular years after release because of TikTok.",
"Lana Del Rey originally performed under a different stage name.",
"Did you know? Vinyl sales have been rising again despite streaming dominance.",
"Many artists experience post-album depression after releasing major projects.",
"Fun fact: Some producers make beats using sounds from everyday objects.",
"Travis Scott’s concerts are known for high-energy crowd experiences. 🌵",
"Did you know? The shortest song ever recorded is just over one second long.",
"Album intros are usually designed to set the mood for the entire project.",
"Fun fact: Headphones were once mainly used by telephone operators.",
"Pop Smoke helped popularize Brooklyn drill worldwide. 💫",
"Did you know? Spotify Wrapped became a yearly internet tradition.",
"Many singers drink warm tea before performances to protect their voices. 🍵",
"Fun fact: Auto-Tune was originally created to correct small pitch mistakes.",
"Some albums become classics years after their original release.",
"Did you know? The Beatles once stopped touring because fans screamed too loudly.",
"Music can increase dopamine levels in the brain. 🧠",
"Fun fact: Artists sometimes scrap entire albums before release.",
"Future recorded parts of DS2 while barely sleeping. 😭",
"Did you know? Concert tickets used to cost just a few dollars decades ago.",
"The first portable cassette player changed how people listened to music forever.",
"Fun fact: Many iconic album covers were shot in a single day.",
"Freestyle rap battles helped launch many hip-hop careers.",
"Did you know? Some singers lose their voices temporarily after tours.",
"Albums often have hidden meanings only fans notice after multiple listens.",
"Fun fact: Producers are sometimes responsible for creating an artist’s signature sound.",
"The first song ever uploaded to YouTube still exists today. ▶️",
"Did you know? Some artists preview unreleased songs at concerts to test reactions.",
"Music genres constantly evolve by mixing styles together.",
"Fun fact: The crowd noise in live albums is sometimes edited afterward.",
"Childish Gambino is also a successful actor and writer.",
"Did you know? Some songs are recorded in just one take.",
"Artists often keep unreleased songs stored for years.",
"Fun fact: Deluxe albums became popular because fans always want more music.",
"DJ Khaled doesn’t usually make beats himself but directs music collaborations.",
"Did you know? The world’s largest music festival happens in front of millions of people.",
"Streaming changed albums from physical collections into digital experiences.",
"Fun fact: Some musicians can identify musical notes instantly by ear. 🎹",
"Album release nights feel like holidays for dedicated fans. 🌙",
"Did you know? Music is one of the few things that activates almost every part of the brain. 🎵",
"Some artists hide snippets of unreleased songs inside trailers and ads.",
"Fun fact: Concert stages can take weeks to build before one performance.",
"Many legendary albums were considered risky before becoming classics.",
"Did you know? Fans sometimes wait years for their favorite artist to drop an album. 😭",
"Music has the power to connect people even when they speak different languages. 🌍🎶"
  ];

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.setGreetingAndFunFact();
  }

  /**
   * Sets greeting based on time of day and picks random fun fact
   * @example
   * 5-11: "Good morning ☀️"
   * 12-16: "Good afternoon 🌤️"
   * 17-20: "Good evening 🌙"
   * 21-4: "Good night 🌃"
   */
  private setGreetingAndFunFact(): void {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      this.greeting = 'Good morning ☀️';
    } else if (hour >= 12 && hour < 17) {
      this.greeting = 'Good afternoon 🌤️';
    } else if (hour >= 17 && hour < 21) {
      this.greeting = 'Good evening 🌙';
    } else {
      this.greeting = 'Good night 🌃';
    }

    // Pick random fun fact
    const randomIndex = Math.floor(Math.random() * this.funFacts.length);
    this.funFact = this.funFacts[randomIndex];
  }

  /**
   * Sets the selected filter pill
   * @param filter - Filter name ('All', 'Music', or 'Podcasts')
   */
  setFilter(filter: string): void {
    this.selectedFilter = filter;
  }

  /**
   * Checks if a filter pill should be active
   * @param filter - Filter name to check
   * @returns true if this filter is active
   */
  isFilterActive(filter: string): boolean {
    return this.selectedFilter === filter;
  }

  /**
   * Scrolls a shelf container to the left by 300px
   * Used by the left arrow button in the sticky header
   */
  scrollLeft(): void {
    const activeShelf = this.elementRef.nativeElement.querySelector('.active-shelf');
    if (activeShelf) {
      activeShelf.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  /**
   * Scrolls a shelf container to the right by 300px
   * Used by the right arrow button in the sticky header
   */
  scrollRight(): void {
    const activeShelf = this.elementRef.nativeElement.querySelector('.active-shelf');
    if (activeShelf) {
      activeShelf.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  /**
   * Helper method to get title color for new releases
   * @param item - New release item
   * @returns CSS color string or undefined
   */
  getTitleColor(item: NewReleaseItem): string | undefined {
    return item.titleColor;
  }
}
