import { InjectionToken } from '@angular/core';

export interface AppConfig {
  audiusBaseUrl: string;
  audiusAppName: string;
  audiusApiKey: string;
  lastFmApiKey: string;
  lrclibClient: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
