export type FontStyle = 'editorial' | 'modern' | 'classic';
export type ProjectStatus = 'draft' | 'published' | 'unpublished';
export type AnimationEffectType = 'confetti' | 'fireworks' | 'embers' | 'petals' | 'starlight';
export type AnimationIntensity = 'gentle' | 'balanced' | 'festive';
export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'other';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface BirthdayPhoto {
  id: string;
  url: string;
  caption: string;
  sizeBytes?: number;
  storageSource?: 'firebase' | 'server';
}

export interface BirthdayWish {
  id: string;
  author: string;
  relationship: string;
  text: string;
}

export interface BirthdayProject {
  id: string;
  recipientName: string;
  senderName: string;
  age?: number | null;
  headline: string;
  message: string;
  eventDate?: string;
  templateId: string;
  backgroundId: string;
  backgroundUrl: string;
  musicId: string;
  musicUrl: string;
  animationPresetId: string;
  accentColor: string;
  fontStyle: FontStyle;
  showCake: boolean;
  showEnvelopeIntro: boolean;
  status: ProjectStatus;
  visitCount: number;
  storageBytes: number;
  wishes: BirthdayWish[];
  photos: BirthdayPhoto[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface BirthdayTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  previewImage: string;
  themeMode: 'light' | 'dark';
  accentColor: string;
  fontStyle: FontStyle;
  defaultAnimationId: string;
  defaultMusicId: string;
  active: boolean;
  updatedAt: string;
}

export interface AnimationPreset {
  id: string;
  name: string;
  effectType: AnimationEffectType;
  intensity: AnimationIntensity;
  description: string;
  active: boolean;
  updatedAt: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  sourceType: 'synth' | 'audio';
  synthPreset?: string;
  audioUrl?: string;
  durationLabel: string;
  sizeBytes: number;
  active: boolean;
  updatedAt: string;
}

export interface BackgroundAsset {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  sizeBytes: number;
  active: boolean;
  updatedAt: string;
}

export interface ContentReport {
  id: string;
  projectId: string;
  projectRecipient?: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  heroHeadline: string;
  footerNote: string;
  maxImageSizeMb: number;
  maxAudioSizeMb: number;
  maxPhotosPerProject: number;
  projectExpirationDays: number;
  rateLimitPerHour: number;
  allowPublicPublishing: boolean;
  updatedAt: string;
}

export interface PublicCatalog {
  templates: BirthdayTemplate[];
  animationPresets: AnimationPreset[];
  musicTracks: MusicTrack[];
  backgrounds: BackgroundAsset[];
  settings: SiteSettings;
}

export interface AdminSessionInfo {
  authenticated: boolean;
  username?: string;
  expiresAt?: string;
}

export interface StorageUsageSummary {
  totalBytes: number;
  projectPhotosBytes: number;
  backgroundsBytes: number;
  musicBytes: number;
  fileCount: number;
  expiredProjectCount: number;
}

export interface DailyMetricPoint {
  date: string;
  label: string;
  projectsCreated: number;
  visits: number;
}

export interface AdminOverview {
  totalProjects: number;
  publishedProjects: number;
  draftProjects: number;
  unpublishedProjects: number;
  totalVisits: number;
  openReports: number;
  storage: StorageUsageSummary;
  dailyMetrics: DailyMetricPoint[];
  topTemplates: { templateId: string; name: string; count: number }[];
  topPages: { id: string; recipientName: string; headline: string; visitCount: number; status: ProjectStatus }[];
}
