// Copy this file to environment.local.ts and add your Last.fm key (optional).
// environment.local.ts is git-ignored and used by the development build.
import type { AppConfig } from '../app/core/config';

export const environment: AppConfig = {
  audiusBaseUrl: 'https://api.audius.co/v1',
  audiusAppName: 'audius-music-app-dev',
  audiusApiKey: '',
  lastFmApiKey: '',
  lrclibClient: 'audius-music-app/0.1 (local dev)',
};
