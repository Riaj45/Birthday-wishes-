import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type {
  AdminAuditLog,
  AnimationPreset,
  BackgroundAsset,
  BirthdayProject,
  BirthdayTemplate,
  ContentReport,
  DailyMetricPoint,
  MediaFileEntry,
  MusicTrack,
  ProjectStatus,
  SiteSettings,
} from './src/types/birthday.ts';

dotenv.config();

const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const UPLOAD_SUBDIRS = ['photos', 'backgrounds', 'music'] as const;

for (const dir of [DATA_DIR, UPLOADS_DIR, ...UPLOAD_SUBDIRS.map((s) => path.join(UPLOADS_DIR, s))]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Server-Side Admin Auth Configuration (Never Exposed to Client) ───────────
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '@riaj2007').trim();
const RAW_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '721151';
const PASSWORD_SALT = crypto.createHash('sha256').update(`bm-salt:${ADMIN_USERNAME}`).digest('hex');
const ADMIN_PASSWORD_DERIVED = crypto.scryptSync(RAW_ADMIN_PASSWORD, PASSWORD_SALT, 64);
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHash('sha256').update(`bm-session-key:${ADMIN_USERNAME}:${ROOT_DIR}`).digest('hex');
const SESSION_COOKIE_NAME = 'bm_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface StoredProject extends BirthdayProject {
  editTokenHash: string;
}

interface AdminSessionRecord {
  id: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

interface PersistedStore {
  seedVersion?: number;
  projects: StoredProject[];
  templates: BirthdayTemplate[];
  animationPresets: AnimationPreset[];
  musicTracks: MusicTrack[];
  backgrounds: BackgroundAsset[];
  reports: ContentReport[];
  settings: SiteSettings;
  dailyStats: Record<string, { projectsCreated: number; visits: number }>;
  adminSessions: Record<string, AdminSessionRecord>;
  auditLogs?: AdminAuditLog[];
  adminPasswordHashOverride?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function verifyAdminCredentials(username: string, password: string): boolean {
  const userMatch = safeEqualHex(sha256Hex(username.trim()), sha256Hex(ADMIN_USERNAME));
  const candidateDerived = crypto.scryptSync(password, PASSWORD_SALT, 64);
  const expectedBuf = store?.adminPasswordHashOverride
    ? Buffer.from(store.adminPasswordHashOverride, 'hex')
    : ADMIN_PASSWORD_DERIVED;
  const passMatch =
    expectedBuf.length === candidateDerived.length && crypto.timingSafeEqual(candidateDerived, expectedBuf);
  return userMatch && passMatch;
}

function signSessionId(sessionId: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('base64url');
  return `${sessionId}.${sig}`;
}

function verifySignedSession(cookieVal: string | undefined): string | null {
  if (!cookieVal || !cookieVal.includes('.')) return null;
  const [sessionId, sig] = cookieVal.split('.');
  if (!sessionId || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(sessionId).digest('base64url');
  return safeEqualHex(sig, expected) ? sessionId : null;
}

function generateSecureId(bytes = 8): string {
  return crypto
    .randomBytes(bytes)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function generateEditToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function sanitizePublicProject(project: StoredProject): BirthdayProject {
  const { editTokenHash: _hidden, ...rest } = project;
  return rest;
}

function isProjectExpired(project: StoredProject): boolean {
  if (!project.expiresAt) return false;
  return new Date(project.expiresAt).getTime() <= Date.now();
}

// ─── Default Seed Catalog ─────────────────────────────────────────────────────
function createInitialStore(): PersistedStore {
  const now = new Date().toISOString();
  const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
  const dayOffsetKey = (daysAgo: number) => todayKey(new Date(Date.now() - daysAgo * 86400000));

  const templates: BirthdayTemplate[] = [
    {
      id: 'golden-candlelight',
      name: 'Golden Candlelight',
      category: 'Evening',
      description: 'Warm amber bokeh, fine ivory linen framing, and intimate candlelit serif typography.',
      previewImage: '/src/assets/images/template_golden_candlelight_1795407298151.jpg',
      themeMode: 'dark',
      accentColor: '#D97706',
      fontStyle: 'editorial',
      defaultAnimationId: 'amber-embers',
      defaultMusicId: 'candlelight-music-box',
      active: true,
      updatedAt: now,
    },
    {
      id: 'botanical-conservatory',
      name: 'Botanical Conservatory',
      category: 'Editorial',
      description: 'Sunlit eucalyptus, deckle-edge cotton stationery cards, and airy daylight composition.',
      previewImage: '/src/assets/images/template_botanical_garden_1795407301854.jpg',
      themeMode: 'light',
      accentColor: '#15803D',
      fontStyle: 'editorial',
      defaultAnimationId: 'botanical-petals',
      defaultMusicId: 'golden-hour-waltz',
      active: true,
      updatedAt: now,
    },
    {
      id: 'midnight-velvet',
      name: 'Midnight Velvet',
      category: 'Milestone',
      description: 'Deep slate drapery, champagne gold fireworks, and refined black-tie milestone styling.',
      previewImage: '/src/assets/images/template_midnight_velvet_1795407298778.jpg',
      themeMode: 'dark',
      accentColor: '#E11D48',
      fontStyle: 'classic',
      defaultAnimationId: 'midnight-fireworks',
      defaultMusicId: 'midnight-piano-lullaby',
      active: true,
      updatedAt: now,
    },
    {
      id: 'sunburst-polaroid',
      name: 'Sunburst Keepsake',
      category: 'Nostalgic',
      description: 'Warm afternoon film tones with tactile photo prints and cheerful confetti celebration.',
      previewImage: '/src/assets/images/template_polaroid_sunburst_1795407300813.jpg',
      themeMode: 'light',
      accentColor: '#E11D48',
      fontStyle: 'modern',
      defaultAnimationId: 'golden-confetti',
      defaultMusicId: 'happy-birthday-chimes',
      active: true,
      updatedAt: now,
    },
    {
      id: 'royal-champagne',
      name: 'Royal Champagne Toast',
      category: 'Milestone',
      description: 'Crystal coupe glasses, warm chandelier bokeh on espresso marble, and effervescent gold bubbles.',
      previewImage: '/src/assets/images/template_royal_champagne_1795418312549.jpg',
      themeMode: 'dark',
      accentColor: '#D97706',
      fontStyle: 'classic',
      defaultAnimationId: 'champagne-bubbles',
      defaultMusicId: 'candlelight-music-box',
      active: true,
      updatedAt: now,
    },
    {
      id: 'coastal-sunset',
      name: 'Coastal Sunset Breeze',
      category: 'Editorial',
      description: 'Sun-drenched Mediterranean linen terrace overlooking a golden horizon with fluttering butterflies.',
      previewImage: '/src/assets/images/template_coastal_sunset_1795418299674.jpg',
      themeMode: 'light',
      accentColor: '#EA580C',
      fontStyle: 'editorial',
      defaultAnimationId: 'golden-butterflies',
      defaultMusicId: 'golden-hour-waltz',
      active: true,
      updatedAt: now,
    },
    {
      id: 'sakura-springtime',
      name: 'Sakura Springtime',
      category: 'Nostalgic',
      description: 'Soft cherry blossom branches, handmade cotton stationery, and floating paper hearts.',
      previewImage: '/src/assets/images/template_sakura_blossom_1795418306311.jpg',
      themeMode: 'light',
      accentColor: '#DB2777',
      fontStyle: 'editorial',
      defaultAnimationId: 'paper-hearts',
      defaultMusicId: 'candlelight-music-box',
      active: true,
      updatedAt: now,
    },
    {
      id: 'afterhours-disco',
      name: 'After-Hours Disco Lounge',
      category: 'Evening',
      description: 'Mirrored rose-gold disco light reflections across charcoal stone with festive streamer ribbons.',
      previewImage: '/src/assets/images/template_afterhours_disco_1795418305440.jpg',
      themeMode: 'dark',
      accentColor: '#E11D48',
      fontStyle: 'modern',
      defaultAnimationId: 'festive-ribbons',
      defaultMusicId: 'happy-birthday-chimes',
      active: true,
      updatedAt: now,
    },
  ];

  const animationPresets: AnimationPreset[] = [
    {
      id: 'golden-confetti',
      name: 'Golden Confetti Shower',
      effectType: 'confetti',
      intensity: 'balanced',
      description: 'Tumbling 2D metallic foil confetti and celebratory bursts on reveal and candle blow-out.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'midnight-fireworks',
      name: 'Midnight Fireworks',
      effectType: 'fireworks',
      intensity: 'festive',
      description: '2D celebratory radial spark volleys illuminating the greeting card sky.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'amber-embers',
      name: 'Candlelight Embers',
      effectType: 'embers',
      intensity: 'gentle',
      description: 'Warm glowing golden bokeh embers drifting gently upward like candlelight.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'botanical-petals',
      name: 'Botanical Petal Drift',
      effectType: 'petals',
      intensity: 'gentle',
      description: 'Delicate fluttering blossom petals swaying across the invitation.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'starlight-shimmer',
      name: 'Starlight Constellation',
      effectType: 'starlight',
      intensity: 'balanced',
      description: 'Twinkling four-point stars shimmering behind your birthday greeting.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'silk-balloons',
      name: 'Silk Balloon Parade',
      effectType: 'balloons',
      intensity: 'balanced',
      description: '2D matte silk balloons with curved strings floating gently upward across the card.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'golden-butterflies',
      name: 'Golden Butterflies',
      effectType: 'butterflies',
      intensity: 'gentle',
      description: 'Animated 2D wing-flapping butterflies gliding smoothly across your greeting card.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'paper-hearts',
      name: 'Floating Paper Hearts',
      effectType: 'hearts',
      intensity: 'gentle',
      description: 'Layered 2D origami hearts drifting upward with warm celebratory sway.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'festive-ribbons',
      name: 'Festive Streamer Ribbons',
      effectType: 'ribbons',
      intensity: 'festive',
      description: 'Curling 2D celebratory party streamers cascading smoothly down the card.',
      active: true,
      updatedAt: now,
    },
    {
      id: 'champagne-bubbles',
      name: 'Champagne Shimmer',
      effectType: 'snowsparkle',
      intensity: 'balanced',
      description: 'Effervescent golden champagne bubbles rising and glistening softly.',
      active: true,
      updatedAt: now,
    },
  ];

  const musicTracks: MusicTrack[] = [
    {
      id: 'happy-birthday-chimes',
      title: 'Happy Birthday Chimes',
      artist: 'Birthday Magic Studio',
      sourceType: 'synth',
      synthPreset: 'happy-birthday',
      durationLabel: 'Loop · Warm Chimes',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'candlelight-music-box',
      title: 'Candlelight Music Box',
      artist: 'Birthday Magic Studio',
      sourceType: 'synth',
      synthPreset: 'music-box',
      durationLabel: 'Loop · Celesta',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'golden-hour-waltz',
      title: 'Golden Hour Waltz',
      artist: 'Birthday Magic Studio',
      sourceType: 'synth',
      synthPreset: 'waltz',
      durationLabel: 'Loop · Acoustic Harp',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'midnight-piano-lullaby',
      title: 'Midnight Piano Lullaby',
      artist: 'Birthday Magic Studio',
      sourceType: 'synth',
      synthPreset: 'piano-lullaby',
      durationLabel: 'Loop · Soft Rhodes',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
  ];

  const backgrounds: BackgroundAsset[] = [
    {
      id: 'bg-golden-candlelight',
      name: 'Golden Candlelight Table',
      category: 'Evening',
      imageUrl: '/src/assets/images/template_golden_candlelight_1795407298151.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-botanical-garden',
      name: 'Sunlit Conservatory',
      category: 'Botanical',
      imageUrl: '/src/assets/images/template_botanical_garden_1795407301854.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-midnight-velvet',
      name: 'Midnight Velvet Drape',
      category: 'Milestone',
      imageUrl: '/src/assets/images/template_midnight_velvet_1795407298778.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-sunburst-linen',
      name: 'Afternoon Chamomile Linen',
      category: 'Nostalgic',
      imageUrl: '/src/assets/images/template_polaroid_sunburst_1795407300813.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-editorial-cake',
      name: 'Beeswax Candles & Roses',
      category: 'Editorial',
      imageUrl: '/src/assets/images/hero_birthday_editorial_1795407298468.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-royal-champagne',
      name: 'Royal Champagne Marble',
      category: 'Milestone',
      imageUrl: '/src/assets/images/template_royal_champagne_1795418312549.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-coastal-sunset',
      name: 'Mediterranean Sunset Terrace',
      category: 'Editorial',
      imageUrl: '/src/assets/images/template_coastal_sunset_1795418299674.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-sakura-blossom',
      name: 'Sakura Blossom Tea Table',
      category: 'Nostalgic',
      imageUrl: '/src/assets/images/template_sakura_blossom_1795418306311.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
    {
      id: 'bg-afterhours-disco',
      name: 'Mirrored Disco Reflections',
      category: 'Evening',
      imageUrl: '/src/assets/images/template_afterhours_disco_1795418305440.jpg',
      sizeBytes: 0,
      active: true,
      updatedAt: now,
    },
  ];

  const sampleProjects: StoredProject[] = [
    {
      id: 'showcase-clara-30',
      recipientName: 'Clara Vance',
      senderName: 'Elena & Friends',
      age: 30,
      headline: 'Thirty Years of Light & Laughter',
      message:
        'From late-night studio talks to Sunday morning bakeries, you bring warmth to every table you join. Make a wish, blow out the candles, and know how deeply you are celebrated today.',
      eventDate: 'November 24',
      templateId: 'golden-candlelight',
      backgroundId: 'bg-golden-candlelight',
      backgroundUrl: '/src/assets/images/template_golden_candlelight_1795407298151.jpg',
      musicId: 'candlelight-music-box',
      musicUrl: '',
      animationPresetId: 'amber-embers',
      accentColor: '#D97706',
      fontStyle: 'editorial',
      showCake: true,
      showEnvelopeIntro: true,
      status: 'published',
      visitCount: 48,
      storageBytes: 0,
      wishes: [
        {
          id: 'w-1',
          author: 'Marcus',
          relationship: 'Brother',
          text: 'Here is to your best decade yet—may your studio always smell like fresh espresso and cedar.',
        },
        {
          id: 'w-2',
          author: 'Sora',
          relationship: 'College Roommate',
          text: 'Thank you for a decade of kindness, terrible road-trip playlists, and unforgettable dinners.',
        },
        {
          id: 'w-3',
          author: 'Nadia',
          relationship: 'Design Partner',
          text: 'Wishing you slow mornings, bold creative chapters, and endless joy at thirty.',
        },
      ],
      photos: [
        {
          id: 'p-1',
          url: '/src/assets/images/hero_birthday_editorial_1795407298468.jpg',
          caption: 'Dinner table ready for tonight',
        },
        {
          id: 'p-2',
          url: '/src/assets/images/template_polaroid_sunburst_1795407300813.jpg',
          caption: 'Sunday afternoon tea & cake',
        },
      ],
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: now,
      expiresAt: futureDate(87),
      editTokenHash: sha256Hex(generateEditToken()),
    },
    {
      id: 'showcase-devon-25',
      recipientName: 'Devon Park',
      senderName: 'The Greenhouse Crew',
      age: 25,
      headline: 'Happy 25th Birthday, Devon',
      message:
        'A quarter-century of curiosity, generosity, and turning every ordinary weekend into an adventure. Scroll through your notes and blow out every candle for good luck.',
      eventDate: 'December 2',
      templateId: 'botanical-conservatory',
      backgroundId: 'bg-botanical-garden',
      backgroundUrl: '/src/assets/images/template_botanical_garden_1795407301854.jpg',
      musicId: 'golden-hour-waltz',
      musicUrl: '',
      animationPresetId: 'botanical-petals',
      accentColor: '#15803D',
      fontStyle: 'editorial',
      showCake: true,
      showEnvelopeIntro: true,
      status: 'published',
      visitCount: 31,
      storageBytes: 0,
      wishes: [
        {
          id: 'w-4',
          author: 'Hannah',
          relationship: 'Sister',
          text: 'So proud of everything you built this year. Save me the corner slice with extra frosting!',
        },
        {
          id: 'w-5',
          author: 'Liam',
          relationship: 'Best Friend',
          text: 'Twenty-five looks brilliant on you. Let us plan the Kyoto trip next spring.',
        },
      ],
      photos: [
        {
          id: 'p-3',
          url: '/src/assets/images/template_botanical_garden_1795407301854.jpg',
          caption: 'Conservatory brunch memories',
        },
      ],
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      updatedAt: now,
      expiresAt: futureDate(88),
      editTokenHash: sha256Hex(generateEditToken()),
    },
  ];

  const settings: SiteSettings = {
    siteName: 'Birthday Magic',
    tagline: 'Bespoke birthday pages built in minutes—no account, no login, just a shareable link.',
    heroHeadline: 'Craft a memorable birthday website without creating an account.',
    footerNote: 'Birthday Magic · Public no-login birthday studio with private edit-key protection.',
    announcementEnabled: false,
    announcementText: '',
    maintenanceMode: false,
    maxImageSizeMb: 8,
    maxAudioSizeMb: 12,
    maxPhotosPerProject: 10,
    projectExpirationDays: 90,
    rateLimitPerHour: 30,
    allowPublicPublishing: true,
    updatedAt: now,
  };

  return {
    seedVersion: 2,
    projects: sampleProjects,
    templates,
    animationPresets,
    musicTracks,
    backgrounds,
    reports: [],
    settings,
    dailyStats: {
      [dayOffsetKey(6)]: { projectsCreated: 1, visits: 9 },
      [dayOffsetKey(5)]: { projectsCreated: 2, visits: 14 },
      [dayOffsetKey(4)]: { projectsCreated: 1, visits: 11 },
      [dayOffsetKey(3)]: { projectsCreated: 2, visits: 19 },
      [dayOffsetKey(2)]: { projectsCreated: 3, visits: 24 },
      [dayOffsetKey(1)]: { projectsCreated: 2, visits: 18 },
      [dayOffsetKey(0)]: { projectsCreated: 1, visits: 12 },
    },
    adminSessions: {},
    auditLogs: [],
  };
}

function migrateStoreIfNeeded(parsed: PersistedStore): PersistedStore {
  const defaults = createInitialStore();
  let changed = false;

  if (!Array.isArray(parsed.auditLogs)) {
    parsed.auditLogs = [];
    changed = true;
  }

  if ((parsed.seedVersion || 1) < 2) {
    for (const tpl of defaults.templates) {
      if (!parsed.templates.some((existing) => existing.id === tpl.id)) {
        parsed.templates.push(tpl);
      }
    }
    for (const anim of defaults.animationPresets) {
      if (!parsed.animationPresets.some((existing) => existing.id === anim.id)) {
        parsed.animationPresets.push(anim);
      }
    }
    for (const bg of defaults.backgrounds) {
      if (!parsed.backgrounds.some((existing) => existing.id === bg.id)) {
        parsed.backgrounds.push(bg);
      }
    }
    if (parsed.settings.maxImageSizeMb < 8) {
      parsed.settings.maxImageSizeMb = 8;
    }
    if (parsed.settings.announcementEnabled === undefined) {
      parsed.settings.announcementEnabled = false;
      parsed.settings.announcementText = '';
    }
    if (parsed.settings.maintenanceMode === undefined) {
      parsed.settings.maintenanceMode = false;
    }
    parsed.seedVersion = 2;
    changed = true;
  }

  if (changed) {
    saveStore(parsed);
  }
  return parsed;
}

function loadStore(): PersistedStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.templates)) {
        return migrateStoreIfNeeded(parsed);
      }
    }
  } catch (err) {
    console.error('Failed to read store.json, initializing fresh store:', err);
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: PersistedStore): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist store.json:', err);
  }
}

const store = loadStore();

function recordAudit(actor: string, action: string, target: string, details = ''): void {
  if (!Array.isArray(store.auditLogs)) store.auditLogs = [];
  store.auditLogs.unshift({
    id: `aud_${generateSecureId(6)}`,
    actor,
    action,
    target,
    details,
    createdAt: new Date().toISOString(),
  });
  if (store.auditLogs.length > 300) {
    store.auditLogs.length = 300;
  }
}

// ─── Storage Usage & Cleanup Policy ──────────────────────────────────────────
function safeUnlinkUploadUrl(url: string | undefined): number {
  if (!url || !url.startsWith('/uploads/')) return 0;
  const rel = url.replace(/^\/uploads\//, '');
  const fullPath = path.resolve(UPLOADS_DIR, rel);
  if (!fullPath.startsWith(UPLOADS_DIR)) return 0;
  try {
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      fs.unlinkSync(fullPath);
      return stat.size;
    }
  } catch {
    // ignore unlink failure
  }
  return 0;
}

function computeDirBytes(subdir: string): { bytes: number; count: number; files: string[] } {
  const dir = path.join(UPLOADS_DIR, subdir);
  let bytes = 0;
  let count = 0;
  const files: string[] = [];
  if (!fs.existsSync(dir)) return { bytes, count, files };
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    try {
      const stat = fs.statSync(fp);
      if (stat.isFile()) {
        bytes += stat.size;
        count += 1;
        files.push(`/uploads/${subdir}/${name}`);
      }
    } catch {
      // ignore
    }
  }
  return { bytes, count, files };
}

function computeStorageSummary() {
  const photos = computeDirBytes('photos');
  const backgrounds = computeDirBytes('backgrounds');
  const music = computeDirBytes('music');
  const expiredProjectCount = store.projects.filter(isProjectExpired).length;
  return {
    totalBytes: photos.bytes + backgrounds.bytes + music.bytes,
    projectPhotosBytes: photos.bytes,
    backgroundsBytes: backgrounds.bytes,
    musicBytes: music.bytes,
    fileCount: photos.count + backgrounds.count + music.count,
    expiredProjectCount,
  };
}

function runExpirationAndStorageCleanup(): {
  purgedProjects: number;
  deletedOrphanFiles: number;
  reclaimedBytes: number;
} {
  let purgedProjects = 0;
  let reclaimedBytes = 0;

  const remaining: StoredProject[] = [];
  for (const project of store.projects) {
    if (isProjectExpired(project)) {
      purgedProjects += 1;
      for (const photo of project.photos) {
        reclaimedBytes += safeUnlinkUploadUrl(photo.url);
      }
    } else {
      remaining.push(project);
    }
  }
  store.projects = remaining;

  // Sweep unreferenced orphan files in /uploads/*
  const referenced = new Set<string>();
  for (const p of store.projects) {
    if (p.backgroundUrl?.startsWith('/uploads/')) referenced.add(p.backgroundUrl);
    if (p.musicUrl?.startsWith('/uploads/')) referenced.add(p.musicUrl);
    for (const ph of p.photos) {
      if (ph.url?.startsWith('/uploads/')) referenced.add(ph.url);
    }
  }
  for (const bg of store.backgrounds) {
    if (bg.imageUrl?.startsWith('/uploads/')) referenced.add(bg.imageUrl);
  }
  for (const t of store.templates) {
    if (t.previewImage?.startsWith('/uploads/')) referenced.add(t.previewImage);
  }
  for (const m of store.musicTracks) {
    if (m.audioUrl?.startsWith('/uploads/')) referenced.add(m.audioUrl);
  }

  let deletedOrphanFiles = 0;
  for (const subdir of UPLOAD_SUBDIRS) {
    const dirInfo = computeDirBytes(subdir);
    for (const fileUrl of dirInfo.files) {
      if (!referenced.has(fileUrl)) {
        const rel = fileUrl.replace(/^\/uploads\//, '');
        const fullPath = path.resolve(UPLOADS_DIR, rel);
        try {
          const stat = fs.statSync(fullPath);
          // Only purge orphan files older than 30 minutes (so in-progress drafts are not deleted prematurely)
          if (Date.now() - stat.mtimeMs > 30 * 60 * 1000) {
            reclaimedBytes += safeUnlinkUploadUrl(fileUrl);
            deletedOrphanFiles += 1;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Purge expired admin sessions
  const now = Date.now();
  for (const [sid, session] of Object.entries(store.adminSessions)) {
    if (session.expiresAt <= now) {
      delete store.adminSessions[sid];
    }
  }

  if (purgedProjects > 0 || deletedOrphanFiles > 0) {
    saveStore(store);
  }

  return { purgedProjects, deletedOrphanFiles, reclaimedBytes };
}

// Run cleanup on boot and every 15 minutes
runExpirationAndStorageCleanup();
setInterval(() => {
  runExpirationAndStorageCleanup();
}, 15 * 60 * 1000).unref();

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateBuckets.set(key, timestamps);
    return { allowed: false, retryAfterSec };
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return { allowed: true, retryAfterSec: 0 };
}

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
function getValidAdminSession(req: Request): AdminSessionRecord | null {
  const rawCookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const sessionId = verifySignedSession(rawCookie);
  if (!sessionId) return null;
  const record = store.adminSessions[sessionId];
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    delete store.adminSessions[sessionId];
    saveStore(store);
    return null;
  }
  return record;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = getValidAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  next();
}

// ─── Multer Upload Helpers (Dynamic Size & MIME Validation) ───────────────────
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
]);
const ALLOWED_AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);

function makeUploader(subdir: (typeof UPLOAD_SUBDIRS)[number], kind: 'image' | 'audio') {
  return (req: Request, res: Response, next: NextFunction) => {
    const destDir = path.join(UPLOADS_DIR, subdir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const maxMb = kind === 'image' ? store.settings.maxImageSizeMb : store.settings.maxAudioSizeMb;
    const maxBytes = Math.max(1, maxMb) * 1024 * 1024;
    const allowedMimes = kind === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_AUDIO_MIMES;
    const allowedExts = kind === 'image' ? ALLOWED_IMAGE_EXTS : ALLOWED_AUDIO_EXTS;

    const upload = multer({
      storage: multer.diskStorage({
        destination: (_r, _f, cb) => cb(null, destDir),
        filename: (_r, file, cb) => {
          const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
          const ext = allowedExts.has(rawExt) ? rawExt : kind === 'image' ? '.jpg' : '.mp3';
          cb(null, `${Date.now()}-${generateSecureId(6)}${ext}`);
        },
      }),
      limits: { fileSize: maxBytes, files: 1 },
      fileFilter: (_r, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        const ext = path.extname(file.originalname || '').toLowerCase();
        const valid = allowedMimes.has(mime) || (allowedExts.has(ext) && (mime === '' || mime === 'application/octet-stream'));
        if (!valid) {
          cb(
            new Error(
              kind === 'image'
                ? 'Unsupported image format. Please use JPEG, PNG, WEBP, GIF, or AVIF.'
                : 'Unsupported audio format. Please use MP3, WAV, OGG, or M4A.'
            )
          );
          return;
        }
        cb(null, true);
      },
    }).single('file');

    upload(req, res, (err: unknown) => {
      if (err) {
        const msg =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? `File exceeds the maximum allowed size of ${maxMb} MB.`
            : err instanceof Error
              ? err.message
              : 'Upload failed.';
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  };
}

// ─── Project Validation ───────────────────────────────────────────────────────
function clampString(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLen);
}

function sanitizePhotos(raw: unknown, maxPhotos: number) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, Math.min(12, maxPhotos))
    .map((item) => {
      const obj = (item || {}) as Record<string, unknown>;
      const url = clampString(obj.url, 500);
      if (!url) return null;
      return {
        id: sanitizeId(String(obj.id || generateSecureId(5))) || generateSecureId(5),
        url,
        caption: clampString(obj.caption, 140),
        sizeBytes: typeof obj.sizeBytes === 'number' && obj.sizeBytes >= 0 ? obj.sizeBytes : 0,
        storageSource: obj.storageSource === 'firebase' ? ('firebase' as const) : ('server' as const),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function sanitizeWishes(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((item) => {
      const obj = (item || {}) as Record<string, unknown>;
      const text = clampString(obj.text, 400);
      if (!text) return null;
      return {
        id: sanitizeId(String(obj.id || generateSecureId(5))) || generateSecureId(5),
        author: clampString(obj.author, 60, 'A Friend'),
        relationship: clampString(obj.relationship, 40, 'Friend'),
        text,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function recordDailyStat(kind: 'projectsCreated' | 'visits') {
  const key = todayKey();
  if (!store.dailyStats[key]) {
    store.dailyStats[key] = { projectsCreated: 0, visits: 0 };
  }
  store.dailyStats[key][kind] += 1;
}

// ─── Express Application ──────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Safe static serving for uploaded media
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  // ── Public Catalog & Settings ───────────────────────────────────────────────
  app.get('/api/catalog', (_req, res) => {
    res.json({
      templates: store.templates.filter((t) => t.active),
      animationPresets: store.animationPresets.filter((a) => a.active),
      musicTracks: store.musicTracks.filter((m) => m.active),
      backgrounds: store.backgrounds.filter((b) => b.active),
      settings: store.settings,
    });
  });

  // ── Public Photo Upload (No Login, Rate Limited & Validated) ────────────────
  app.post(
    '/api/upload/photo',
    (req, res, next) => {
      const ip = getClientIp(req);
      const limit = checkRateLimit(`upload:${ip}`, Math.max(20, store.settings.rateLimitPerHour * 3), 60 * 60 * 1000);
      if (!limit.allowed) {
        res.status(429).json({ error: `Upload rate limit reached. Try again in ${limit.retryAfterSec}s.` });
        return;
      }
      next();
    },
    makeUploader('photos', 'image'),
    (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided.' });
        return;
      }
      res.status(201).json({
        url: `/uploads/photos/${req.file.filename}`,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
      });
    }
  );

  // Fallback JSON Base64 Image Upload (helps if proxies strip multipart boundaries)
  app.post('/api/upload/photo-data', (req, res) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`upload:${ip}`, Math.max(20, store.settings.rateLimitPerHour * 3), 60 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Upload rate limit reached. Try again in ${limit.retryAfterSec}s.` });
      return;
    }
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      res.status(400).json({ error: 'Invalid image data payload.' });
      return;
    }
    const mime = match[1].toLowerCase();
    const buf = Buffer.from(match[2], 'base64');
    const maxBytes = Math.max(1, store.settings.maxImageSizeMb) * 1024 * 1024;
    if (buf.length > maxBytes) {
      res.status(400).json({ error: `File exceeds maximum allowed size of ${store.settings.maxImageSizeMb} MB.` });
      return;
    }
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
    };
    const destDir = path.join(UPLOADS_DIR, 'photos');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const filename = `${Date.now()}-${generateSecureId(6)}${extMap[mime] || '.jpg'}`;
    fs.writeFileSync(path.join(destDir, filename), buf);
    res.status(201).json({
      url: `/uploads/photos/${filename}`,
      sizeBytes: buf.length,
      mimeType: mime,
    });
  });

  // ── Public Project Creation (No Login, Generates Private Edit Token) ────────
  app.post('/api/projects', (req, res) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`create:${ip}`, store.settings.rateLimitPerHour, 60 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many projects created recently. Please retry in ${limit.retryAfterSec}s.` });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const recipientName = clampString(body.recipientName, 80);
    const senderName = clampString(body.senderName, 80);
    const headline = clampString(body.headline, 140);
    const message = clampString(body.message, 2000);

    if (!recipientName || !senderName || !headline || !message) {
      res.status(400).json({ error: 'Recipient name, sender name, headline, and message are required.' });
      return;
    }

    const requestedPublish = body.status === 'published';
    if (requestedPublish && !store.settings.allowPublicPublishing) {
      res.status(403).json({ error: 'Public publishing is currently paused by the administrator.' });
      return;
    }

    const projectId = generateSecureId(8);
    const editToken = generateEditToken();
    const editTokenHash = sha256Hex(editToken);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + store.settings.projectExpirationDays * 86400000).toISOString();

    const photos = sanitizePhotos(body.photos, store.settings.maxPhotosPerProject);
    const storageBytes = photos.reduce((sum, p) => sum + (p.sizeBytes || 0), 0);

    const project: StoredProject = {
      id: projectId,
      recipientName,
      senderName,
      age: typeof body.age === 'number' && Number.isFinite(body.age) && body.age >= 0 && body.age <= 150 ? Math.round(body.age) : null,
      headline,
      message,
      eventDate: clampString(body.eventDate, 40),
      templateId: sanitizeId(String(body.templateId || 'golden-candlelight')) || 'golden-candlelight',
      backgroundId: sanitizeId(String(body.backgroundId || 'bg-golden-candlelight')),
      backgroundUrl: clampString(body.backgroundUrl, 500),
      musicId: sanitizeId(String(body.musicId || 'happy-birthday-chimes')),
      musicUrl: clampString(body.musicUrl, 500),
      animationPresetId: sanitizeId(String(body.animationPresetId || 'golden-confetti')) || 'golden-confetti',
      accentColor: clampString(body.accentColor, 32, '#E11D48'),
      fontStyle: body.fontStyle === 'modern' || body.fontStyle === 'classic' ? body.fontStyle : 'editorial',
      showCake: body.showCake !== false,
      showEnvelopeIntro: body.showEnvelopeIntro !== false,
      status: requestedPublish ? 'published' : 'draft',
      visitCount: 0,
      storageBytes,
      wishes: sanitizeWishes(body.wishes),
      photos,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      editTokenHash,
    };

    store.projects.unshift(project);
    recordDailyStat('projectsCreated');
    saveStore(store);

    res.status(201).json({
      project: sanitizePublicProject(project),
      editToken,
    });
  });

  // ── Public Published Birthday Page Read (Never Exposes Edit Token) ──────────
  app.get('/api/projects/public/:id', (req, res) => {
    const id = sanitizeId(req.params.id);
    const project = store.projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: 'Birthday page not found.' });
      return;
    }
    if (isProjectExpired(project)) {
      res.status(410).json({ error: 'This birthday page has expired.' });
      return;
    }
    if (project.status !== 'published') {
      res.status(404).json({ error: 'This birthday page is not currently published.' });
      return;
    }

    if (req.query.track !== '0') {
      project.visitCount += 1;
      recordDailyStat('visits');
      saveStore(store);
    }

    res.json({ project: sanitizePublicProject(project) });
  });

  // ── Verify Private Edit Token (For Edit Link & Recovery) ────────────────────
  app.post('/api/projects/:id/verify-token', (req, res) => {
    const id = sanitizeId(req.params.id);
    const token = String(req.headers['x-edit-token'] || req.body?.editToken || '').trim();
    const project = store.projects.find((p) => p.id === id);
    if (!project || isProjectExpired(project)) {
      res.status(404).json({ error: 'Project not found or expired.' });
      return;
    }
    if (!token || !safeEqualHex(sha256Hex(token), project.editTokenHash)) {
      res.status(403).json({ error: 'Invalid or revoked edit token.' });
      return;
    }
    res.json({ project: sanitizePublicProject(project) });
  });

  // ── Update Project (Requires Valid Private Edit Token) ──────────────────────
  app.put('/api/projects/:id', (req, res) => {
    const id = sanitizeId(req.params.id);
    const token = String(req.headers['x-edit-token'] || '').trim();
    const project = store.projects.find((p) => p.id === id);
    if (!project || isProjectExpired(project)) {
      res.status(404).json({ error: 'Project not found or expired.' });
      return;
    }
    if (!token || !safeEqualHex(sha256Hex(token), project.editTokenHash)) {
      res.status(403).json({ error: 'Invalid or revoked edit token.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const recipientName = clampString(body.recipientName, 80, project.recipientName);
    const senderName = clampString(body.senderName, 80, project.senderName);
    const headline = clampString(body.headline, 140, project.headline);
    const message = clampString(body.message, 2000, project.message);

    if (!recipientName || !senderName || !headline || !message) {
      res.status(400).json({ error: 'Required project fields cannot be empty.' });
      return;
    }

    const photos = body.photos !== undefined ? sanitizePhotos(body.photos, store.settings.maxPhotosPerProject) : project.photos;
    const wishes = body.wishes !== undefined ? sanitizeWishes(body.wishes) : project.wishes;

    project.recipientName = recipientName;
    project.senderName = senderName;
    if (body.age !== undefined) {
      project.age = typeof body.age === 'number' && Number.isFinite(body.age) && body.age >= 0 && body.age <= 150 ? Math.round(body.age) : null;
    }
    project.headline = headline;
    project.message = message;
    if (body.eventDate !== undefined) project.eventDate = clampString(body.eventDate, 40);
    if (body.templateId !== undefined) project.templateId = sanitizeId(String(body.templateId)) || project.templateId;
    if (body.backgroundId !== undefined) project.backgroundId = sanitizeId(String(body.backgroundId));
    if (body.backgroundUrl !== undefined) project.backgroundUrl = clampString(body.backgroundUrl, 500);
    if (body.musicId !== undefined) project.musicId = sanitizeId(String(body.musicId));
    if (body.musicUrl !== undefined) project.musicUrl = clampString(body.musicUrl, 500);
    if (body.animationPresetId !== undefined) project.animationPresetId = sanitizeId(String(body.animationPresetId)) || project.animationPresetId;
    if (body.accentColor !== undefined) project.accentColor = clampString(body.accentColor, 32, project.accentColor);
    if (body.fontStyle === 'editorial' || body.fontStyle === 'modern' || body.fontStyle === 'classic') {
      project.fontStyle = body.fontStyle;
    }
    if (typeof body.showCake === 'boolean') project.showCake = body.showCake;
    if (typeof body.showEnvelopeIntro === 'boolean') project.showEnvelopeIntro = body.showEnvelopeIntro;
    project.photos = photos;
    project.wishes = wishes;
    project.storageBytes = photos.reduce((sum, p) => sum + (p.sizeBytes || 0), 0);
    project.updatedAt = new Date().toISOString();

    saveStore(store);
    res.json({ project: sanitizePublicProject(project) });
  });

  // ── Publish / Unpublish Own Project (Requires Edit Token + Rate Limit) ──────
  app.post('/api/projects/:id/publish', (req, res) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`publish:${ip}`, store.settings.rateLimitPerHour, 60 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Publishing rate limit reached. Try again in ${limit.retryAfterSec}s.` });
      return;
    }

    const id = sanitizeId(req.params.id);
    const token = String(req.headers['x-edit-token'] || '').trim();
    const project = store.projects.find((p) => p.id === id);
    if (!project || isProjectExpired(project)) {
      res.status(404).json({ error: 'Project not found or expired.' });
      return;
    }
    if (!token || !safeEqualHex(sha256Hex(token), project.editTokenHash)) {
      res.status(403).json({ error: 'Invalid or revoked edit token.' });
      return;
    }

    const nextStatus: ProjectStatus = req.body?.status === 'draft' ? 'draft' : 'published';
    if (nextStatus === 'published' && !store.settings.allowPublicPublishing) {
      res.status(403).json({ error: 'Public publishing is currently paused by the administrator.' });
      return;
    }

    project.status = nextStatus;
    project.updatedAt = new Date().toISOString();
    saveStore(store);

    res.json({ project: sanitizePublicProject(project) });
  });

  // ── Rotate / Revoke Edit Token ──────────────────────────────────────────────
  app.post('/api/projects/:id/rotate-token', (req, res) => {
    const id = sanitizeId(req.params.id);
    const token = String(req.headers['x-edit-token'] || '').trim();
    const project = store.projects.find((p) => p.id === id);
    if (!project || isProjectExpired(project)) {
      res.status(404).json({ error: 'Project not found or expired.' });
      return;
    }
    if (!token || !safeEqualHex(sha256Hex(token), project.editTokenHash)) {
      res.status(403).json({ error: 'Invalid or revoked edit token.' });
      return;
    }

    const newEditToken = generateEditToken();
    project.editTokenHash = sha256Hex(newEditToken);
    project.updatedAt = new Date().toISOString();
    saveStore(store);

    res.json({ editToken: newEditToken, project: sanitizePublicProject(project) });
  });

  // ── Delete Own Project Using Private Edit Token ─────────────────────────────
  app.delete('/api/projects/:id', (req, res) => {
    const id = sanitizeId(req.params.id);
    const token = String(req.headers['x-edit-token'] || '').trim();
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const project = store.projects[idx];
    if (!token || !safeEqualHex(sha256Hex(token), project.editTokenHash)) {
      res.status(403).json({ error: 'Invalid or revoked edit token.' });
      return;
    }

    for (const ph of project.photos) {
      safeUnlinkUploadUrl(ph.url);
    }
    store.projects.splice(idx, 1);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Public Content Report Submission ────────────────────────────────────────
  app.post('/api/reports', (req, res) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`report:${ip}`, 15, 60 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many reports submitted. Please retry in ${limit.retryAfterSec}s.` });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const projectId = sanitizeId(String(body.projectId || ''));
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) {
      res.status(404).json({ error: 'Target birthday page does not exist.' });
      return;
    }

    const validReasons = new Set(['spam', 'inappropriate', 'harassment', 'copyright', 'other']);
    const reason = validReasons.has(String(body.reason)) ? (body.reason as ContentReport['reason']) : 'inappropriate';
    const details = clampString(body.details, 500);

    const report: ContentReport = {
      id: `rep_${generateSecureId(6)}`,
      projectId: project.id,
      projectRecipient: project.recipientName,
      reason,
      details,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    store.reports.unshift(report);
    saveStore(store);
    res.status(201).json({ report });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN AUTHENTICATION & PROTECTED ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/api/admin/session', (req, res) => {
    const session = getValidAdminSession(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      username: session.username,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: `Too many login attempts. Retry in ${limit.retryAfterSec}s.` });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password || !verifyAdminCredentials(username, password)) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const sessionId = generateSecureId(24);
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    store.adminSessions[sessionId] = {
      id: sessionId,
      username: ADMIN_USERNAME,
      createdAt: now,
      expiresAt,
    };
    recordAudit(ADMIN_USERNAME, 'admin.login', 'session', `Signed in from ${ip}`);
    saveStore(store);

    res.cookie(SESSION_COOKIE_NAME, signSessionId(sessionId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });

    res.json({
      authenticated: true,
      username: ADMIN_USERNAME,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    const rawCookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const sessionId = verifySignedSession(rawCookie);
    if (sessionId && store.adminSessions[sessionId]) {
      const actor = store.adminSessions[sessionId].username;
      delete store.adminSessions[sessionId];
      recordAudit(actor, 'admin.logout', 'session', 'Signed out cleanly');
      saveStore(store);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ authenticated: false });
  });

  // All routes below require verified Admin session
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const totalProjects = store.projects.length;
    const publishedProjects = store.projects.filter((p) => p.status === 'published' && !isProjectExpired(p)).length;
    const draftProjects = store.projects.filter((p) => p.status === 'draft').length;
    const unpublishedProjects = store.projects.filter((p) => p.status === 'unpublished').length;
    const totalVisits = store.projects.reduce((sum, p) => sum + (p.visitCount || 0), 0);
    const openReports = store.reports.filter((r) => r.status === 'open').length;

    const dailyMetrics: DailyMetricPoint[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000);
      const key = todayKey(d);
      const stat = store.dailyStats[key] || { projectsCreated: 0, visits: 0 };
      dailyMetrics.push({
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        projectsCreated: stat.projectsCreated,
        visits: stat.visits,
      });
    }

    const templateCounts = new Map<string, number>();
    for (const p of store.projects) {
      templateCounts.set(p.templateId, (templateCounts.get(p.templateId) || 0) + 1);
    }
    const topTemplates = Array.from(templateCounts.entries())
      .map(([templateId, count]) => ({
        templateId,
        name: store.templates.find((t) => t.id === templateId)?.name || templateId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topPages = [...store.projects]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        recipientName: p.recipientName,
        headline: p.headline,
        visitCount: p.visitCount,
        status: p.status,
      }));

    res.json({
      totalProjects,
      publishedProjects,
      draftProjects,
      unpublishedProjects,
      totalVisits,
      openReports,
      storage: computeStorageSummary(),
      dailyMetrics,
      topTemplates,
      topPages,
    });
  });

  // ── Admin Projects Management ───────────────────────────────────────────────
  app.get('/api/admin/projects', requireAdmin, (_req, res) => {
    res.json({ projects: store.projects.map(sanitizePublicProject) });
  });

  app.patch('/api/admin/projects/:id/status', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const project = store.projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const status = req.body?.status;
    if (status !== 'published' && status !== 'unpublished' && status !== 'draft') {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    project.status = status;
    project.updatedAt = new Date().toISOString();
    recordAudit(ADMIN_USERNAME, 'project.status', project.id, `Changed status to ${status}`);
    saveStore(store);
    res.json({ project: sanitizePublicProject(project) });
  });

  app.post('/api/admin/projects/bulk', requireAdmin, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x: unknown) => sanitizeId(String(x))) : [];
    const action = req.body?.action;
    if (ids.length === 0 || !['publish', 'unpublish', 'delete'].includes(String(action))) {
      res.status(400).json({ error: 'Provide project IDs and a valid bulk action.' });
      return;
    }
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    let affected = 0;

    if (action === 'delete') {
      const remaining: StoredProject[] = [];
      for (const p of store.projects) {
        if (idSet.has(p.id)) {
          affected += 1;
          for (const ph of p.photos) safeUnlinkUploadUrl(ph.url);
        } else {
          remaining.push(p);
        }
      }
      store.projects = remaining;
    } else {
      const nextStatus: ProjectStatus = action === 'publish' ? 'published' : 'unpublished';
      for (const p of store.projects) {
        if (idSet.has(p.id)) {
          p.status = nextStatus;
          p.updatedAt = now;
          affected += 1;
        }
      }
    }

    recordAudit(ADMIN_USERNAME, `project.bulk_${action}`, `${affected} pages`, `Bulk ${action} applied`);
    saveStore(store);
    res.json({
      affected,
      updated: action === 'delete' ? 0 : affected,
      deleted: action === 'delete' ? affected : 0,
      action,
    });
  });

  app.patch('/api/admin/projects/:id/extend', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const project = store.projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const days = Math.max(1, Math.min(365, Math.round(Number(req.body?.days) || 30)));
    const baseTime = Math.max(Date.now(), new Date(project.expiresAt || Date.now()).getTime());
    project.expiresAt = new Date(baseTime + days * 86400000).toISOString();
    project.updatedAt = new Date().toISOString();
    recordAudit(ADMIN_USERNAME, 'project.extend', project.id, `Extended expiry by +${days} days`);
    saveStore(store);
    res.json({ project: sanitizePublicProject(project) });
  });

  app.post('/api/admin/projects/:id/revoke-token', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const project = store.projects.find((p) => p.id === id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    project.editTokenHash = sha256Hex(generateEditToken());
    project.updatedAt = new Date().toISOString();
    recordAudit(ADMIN_USERNAME, 'project.revoke_token', project.id, 'Revoked existing owner edit token');
    saveStore(store);
    res.json({ revoked: true, projectId: project.id });
  });

  app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const [removed] = store.projects.splice(idx, 1);
    for (const ph of removed.photos) {
      safeUnlinkUploadUrl(ph.url);
    }
    const now = new Date().toISOString();
    for (const rep of store.reports) {
      if (rep.projectId === id && rep.status === 'open') {
        rep.status = 'resolved';
        rep.resolvedAt = now;
      }
    }
    recordAudit(ADMIN_USERNAME, 'project.delete', id, `Deleted "${removed.recipientName}"`);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Admin Templates CRUD ────────────────────────────────────────────────────
  app.get('/api/admin/templates', requireAdmin, (_req, res) => {
    res.json({ templates: store.templates });
  });

  app.post('/api/admin/templates', requireAdmin, (req, res) => {
    const b = (req.body || {}) as Record<string, unknown>;
    const name = clampString(b.name, 80);
    if (!name) {
      res.status(400).json({ error: 'Template name is required.' });
      return;
    }
    const id = sanitizeId(String(b.id || name.toLowerCase().replace(/\s+/g, '-'))) || `tpl_${generateSecureId(5)}`;
    if (store.templates.some((t) => t.id === id)) {
      res.status(409).json({ error: 'A template with this ID already exists.' });
      return;
    }
    const template: BirthdayTemplate = {
      id,
      name,
      category: clampString(b.category, 40, 'Custom'),
      description: clampString(b.description, 300),
      previewImage: clampString(b.previewImage, 500, '/src/assets/images/template_golden_candlelight_1795407298151.jpg'),
      themeMode: b.themeMode === 'dark' ? 'dark' : 'light',
      accentColor: clampString(b.accentColor, 32, '#E11D48'),
      fontStyle: b.fontStyle === 'modern' || b.fontStyle === 'classic' ? b.fontStyle : 'editorial',
      defaultAnimationId: sanitizeId(String(b.defaultAnimationId || 'golden-confetti')),
      defaultMusicId: sanitizeId(String(b.defaultMusicId || 'happy-birthday-chimes')),
      active: b.active !== false,
      updatedAt: new Date().toISOString(),
    };
    store.templates.push(template);
    saveStore(store);
    res.status(201).json({ template });
  });

  app.put('/api/admin/templates/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const tpl = store.templates.find((t) => t.id === id);
    if (!tpl) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }
    const b = (req.body || {}) as Record<string, unknown>;
    if (b.name !== undefined) tpl.name = clampString(b.name, 80, tpl.name);
    if (b.category !== undefined) tpl.category = clampString(b.category, 40, tpl.category);
    if (b.description !== undefined) tpl.description = clampString(b.description, 300);
    if (b.previewImage !== undefined) tpl.previewImage = clampString(b.previewImage, 500, tpl.previewImage);
    if (b.themeMode === 'light' || b.themeMode === 'dark') tpl.themeMode = b.themeMode;
    if (b.accentColor !== undefined) tpl.accentColor = clampString(b.accentColor, 32, tpl.accentColor);
    if (b.fontStyle === 'editorial' || b.fontStyle === 'modern' || b.fontStyle === 'classic') tpl.fontStyle = b.fontStyle;
    if (b.defaultAnimationId !== undefined) tpl.defaultAnimationId = sanitizeId(String(b.defaultAnimationId));
    if (b.defaultMusicId !== undefined) tpl.defaultMusicId = sanitizeId(String(b.defaultMusicId));
    if (typeof b.active === 'boolean') tpl.active = b.active;
    tpl.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ template: tpl });
  });

  app.delete('/api/admin/templates/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const idx = store.templates.findIndex((t) => t.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Template not found.' });
      return;
    }
    store.templates.splice(idx, 1);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Admin Animation Presets CRUD ────────────────────────────────────────────
  app.get('/api/admin/animations', requireAdmin, (_req, res) => {
    res.json({ animationPresets: store.animationPresets });
  });

  app.post('/api/admin/animations', requireAdmin, (req, res) => {
    const b = (req.body || {}) as Record<string, unknown>;
    const name = clampString(b.name, 80);
    if (!name) {
      res.status(400).json({ error: 'Preset name is required.' });
      return;
    }
    const id = sanitizeId(String(b.id || name.toLowerCase().replace(/\s+/g, '-'))) || `anim_${generateSecureId(5)}`;
    const validEffects = new Set([
      'confetti',
      'fireworks',
      'embers',
      'petals',
      'starlight',
      'balloons',
      'butterflies',
      'hearts',
      'ribbons',
      'snowsparkle',
    ]);
    const validIntensity = new Set(['gentle', 'balanced', 'festive']);
    const preset: AnimationPreset = {
      id,
      name,
      effectType: validEffects.has(String(b.effectType)) ? (b.effectType as AnimationPreset['effectType']) : 'confetti',
      intensity: validIntensity.has(String(b.intensity)) ? (b.intensity as AnimationPreset['intensity']) : 'balanced',
      description: clampString(b.description, 240),
      active: b.active !== false,
      updatedAt: new Date().toISOString(),
    };
    store.animationPresets.push(preset);
    recordAudit(ADMIN_USERNAME, 'animation.create', preset.id, `Added ${preset.name}`);
    saveStore(store);
    res.status(201).json({ animationPreset: preset });
  });

  app.put('/api/admin/animations/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const preset = store.animationPresets.find((a) => a.id === id);
    if (!preset) {
      res.status(404).json({ error: 'Animation preset not found.' });
      return;
    }
    const b = (req.body || {}) as Record<string, unknown>;
    const validEffects = new Set([
      'confetti',
      'fireworks',
      'embers',
      'petals',
      'starlight',
      'balloons',
      'butterflies',
      'hearts',
      'ribbons',
      'snowsparkle',
    ]);
    const validIntensity = new Set(['gentle', 'balanced', 'festive']);
    if (b.name !== undefined) preset.name = clampString(b.name, 80, preset.name);
    if (validEffects.has(String(b.effectType))) preset.effectType = b.effectType as AnimationPreset['effectType'];
    if (validIntensity.has(String(b.intensity))) preset.intensity = b.intensity as AnimationPreset['intensity'];
    if (b.description !== undefined) preset.description = clampString(b.description, 240);
    if (typeof b.active === 'boolean') preset.active = b.active;
    preset.updatedAt = new Date().toISOString();
    recordAudit(ADMIN_USERNAME, 'animation.update', preset.id, `Updated ${preset.name}`);
    saveStore(store);
    res.json({ animationPreset: preset });
  });

  app.delete('/api/admin/animations/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const idx = store.animationPresets.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Animation preset not found.' });
      return;
    }
    store.animationPresets.splice(idx, 1);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Admin Music Library & Audio Upload ──────────────────────────────────────
  app.get('/api/admin/music', requireAdmin, (_req, res) => {
    res.json({ musicTracks: store.musicTracks });
  });

  app.post('/api/admin/upload/audio', requireAdmin, makeUploader('music', 'audio'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file uploaded.' });
      return;
    }
    res.status(201).json({
      url: `/uploads/music/${req.file.filename}`,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });

  app.post('/api/admin/music', requireAdmin, (req, res) => {
    const b = (req.body || {}) as Record<string, unknown>;
    const title = clampString(b.title, 80);
    if (!title) {
      res.status(400).json({ error: 'Track title is required.' });
      return;
    }
    const sourceType = b.sourceType === 'audio' ? 'audio' : 'synth';
    const track: MusicTrack = {
      id: sanitizeId(String(b.id || title.toLowerCase().replace(/\s+/g, '-'))) || `trk_${generateSecureId(5)}`,
      title,
      artist: clampString(b.artist, 80, 'Birthday Magic Studio'),
      sourceType,
      synthPreset: sourceType === 'synth' ? clampString(b.synthPreset, 40, 'happy-birthday') : undefined,
      audioUrl: sourceType === 'audio' ? clampString(b.audioUrl, 500) : undefined,
      durationLabel: clampString(b.durationLabel, 20, sourceType === 'audio' ? 'Uploaded Audio' : 'Loop · Synth'),
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : 0,
      active: b.active !== false,
      updatedAt: new Date().toISOString(),
    };
    store.musicTracks.push(track);
    saveStore(store);
    res.status(201).json({ musicTrack: track });
  });

  app.put('/api/admin/music/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const track = store.musicTracks.find((m) => m.id === id);
    if (!track) {
      res.status(404).json({ error: 'Music track not found.' });
      return;
    }
    const b = (req.body || {}) as Record<string, unknown>;
    if (b.title !== undefined) track.title = clampString(b.title, 80, track.title);
    if (b.artist !== undefined) track.artist = clampString(b.artist, 80, track.artist);
    if (b.durationLabel !== undefined) track.durationLabel = clampString(b.durationLabel, 20, track.durationLabel);
    if (typeof b.active === 'boolean') track.active = b.active;
    track.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ musicTrack: track });
  });

  app.delete('/api/admin/music/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const idx = store.musicTracks.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Music track not found.' });
      return;
    }
    const [removed] = store.musicTracks.splice(idx, 1);
    safeUnlinkUploadUrl(removed.audioUrl);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Admin Backgrounds Library & Image Upload ────────────────────────────────
  app.get('/api/admin/backgrounds', requireAdmin, (_req, res) => {
    res.json({ backgrounds: store.backgrounds });
  });

  app.post('/api/admin/upload/image', requireAdmin, makeUploader('backgrounds', 'image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded.' });
      return;
    }
    res.status(201).json({
      url: `/uploads/backgrounds/${req.file.filename}`,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });

  app.post('/api/admin/backgrounds', requireAdmin, (req, res) => {
    const b = (req.body || {}) as Record<string, unknown>;
    const name = clampString(b.name, 80);
    const imageUrl = clampString(b.imageUrl, 500);
    if (!name || !imageUrl) {
      res.status(400).json({ error: 'Background name and image URL are required.' });
      return;
    }
    const bg: BackgroundAsset = {
      id: sanitizeId(String(b.id || `bg-${name.toLowerCase().replace(/\s+/g, '-')}`)) || `bg_${generateSecureId(5)}`,
      name,
      category: clampString(b.category, 40, 'Custom'),
      imageUrl,
      sizeBytes: typeof b.sizeBytes === 'number' ? b.sizeBytes : 0,
      active: b.active !== false,
      updatedAt: new Date().toISOString(),
    };
    store.backgrounds.push(bg);
    saveStore(store);
    res.status(201).json({ background: bg });
  });

  app.put('/api/admin/backgrounds/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const bg = store.backgrounds.find((item) => item.id === id);
    if (!bg) {
      res.status(404).json({ error: 'Background not found.' });
      return;
    }
    const b = (req.body || {}) as Record<string, unknown>;
    if (b.name !== undefined) bg.name = clampString(b.name, 80, bg.name);
    if (b.category !== undefined) bg.category = clampString(b.category, 40, bg.category);
    if (typeof b.active === 'boolean') bg.active = b.active;
    bg.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ background: bg });
  });

  app.delete('/api/admin/backgrounds/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const idx = store.backgrounds.findIndex((item) => item.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Background not found.' });
      return;
    }
    const [removed] = store.backgrounds.splice(idx, 1);
    safeUnlinkUploadUrl(removed.imageUrl);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // ── Admin Moderation Reports ────────────────────────────────────────────────
  app.get('/api/admin/reports', requireAdmin, (_req, res) => {
    res.json({ reports: store.reports });
  });

  app.patch('/api/admin/reports/:id', requireAdmin, (req, res) => {
    const id = sanitizeId(req.params.id);
    const report = store.reports.find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    const action = req.body?.action;
    const now = new Date().toISOString();

    if (action === 'dismiss') {
      report.status = 'dismissed';
      report.resolvedAt = now;
    } else if (action === 'unpublish') {
      const target = store.projects.find((p) => p.id === report.projectId);
      if (target) {
        target.status = 'unpublished';
        target.updatedAt = now;
      }
      report.status = 'resolved';
      report.resolvedAt = now;
    } else if (action === 'delete_project') {
      const idx = store.projects.findIndex((p) => p.id === report.projectId);
      if (idx !== -1) {
        const [removed] = store.projects.splice(idx, 1);
        for (const ph of removed.photos) {
          safeUnlinkUploadUrl(ph.url);
        }
      }
      for (const r of store.reports) {
        if (r.projectId === report.projectId && r.status === 'open') {
          r.status = 'resolved';
          r.resolvedAt = now;
        }
      }
    } else {
      report.status = 'resolved';
      report.resolvedAt = now;
    }

    saveStore(store);
    res.json({ report });
  });

  // ── Admin Settings & Branding ───────────────────────────────────────────────
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    res.json({ settings: store.settings });
  });

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const b = (req.body || {}) as Record<string, unknown>;
    if (b.siteName !== undefined) store.settings.siteName = clampString(b.siteName, 60, store.settings.siteName);
    if (b.tagline !== undefined) store.settings.tagline = clampString(b.tagline, 180, store.settings.tagline);
    if (b.heroHeadline !== undefined) store.settings.heroHeadline = clampString(b.heroHeadline, 140, store.settings.heroHeadline);
    if (b.footerNote !== undefined) store.settings.footerNote = clampString(b.footerNote, 180, store.settings.footerNote);
    if (typeof b.announcementEnabled === 'boolean') store.settings.announcementEnabled = b.announcementEnabled;
    if (b.announcementText !== undefined) store.settings.announcementText = clampString(b.announcementText, 180);
    if (typeof b.maintenanceMode === 'boolean') store.settings.maintenanceMode = b.maintenanceMode;
    if (typeof b.maxImageSizeMb === 'number' && b.maxImageSizeMb >= 1 && b.maxImageSizeMb <= 50) {
      store.settings.maxImageSizeMb = Math.round(b.maxImageSizeMb);
    }
    if (typeof b.maxAudioSizeMb === 'number' && b.maxAudioSizeMb >= 1 && b.maxAudioSizeMb <= 50) {
      store.settings.maxAudioSizeMb = Math.round(b.maxAudioSizeMb);
    }
    if (typeof b.maxPhotosPerProject === 'number' && b.maxPhotosPerProject >= 1 && b.maxPhotosPerProject <= 12) {
      store.settings.maxPhotosPerProject = Math.round(b.maxPhotosPerProject);
    }
    if (typeof b.projectExpirationDays === 'number' && b.projectExpirationDays >= 1 && b.projectExpirationDays <= 365) {
      store.settings.projectExpirationDays = Math.round(b.projectExpirationDays);
    }
    if (typeof b.rateLimitPerHour === 'number' && b.rateLimitPerHour >= 1 && b.rateLimitPerHour <= 500) {
      store.settings.rateLimitPerHour = Math.round(b.rateLimitPerHour);
    }
    if (typeof b.allowPublicPublishing === 'boolean') {
      store.settings.allowPublicPublishing = b.allowPublicPublishing;
    }
    store.settings.updatedAt = new Date().toISOString();
    recordAudit(ADMIN_USERNAME, 'settings.update', 'global', 'Updated branding, limits, or maintenance settings');
    saveStore(store);
    res.json({ settings: store.settings });
  });

  // ── Admin Storage Usage, Media Browser & Cleanup Trigger ────────────────────
  app.get('/api/admin/media', requireAdmin, (_req, res) => {
    const referenced = new Set<string>();
    for (const p of store.projects) {
      if (p.backgroundUrl?.startsWith('/uploads/')) referenced.add(p.backgroundUrl);
      if (p.musicUrl?.startsWith('/uploads/')) referenced.add(p.musicUrl);
      for (const ph of p.photos) {
        if (ph.url?.startsWith('/uploads/')) referenced.add(ph.url);
      }
    }
    for (const bg of store.backgrounds) {
      if (bg.imageUrl?.startsWith('/uploads/')) referenced.add(bg.imageUrl);
    }
    for (const t of store.templates) {
      if (t.previewImage?.startsWith('/uploads/')) referenced.add(t.previewImage);
    }
    for (const m of store.musicTracks) {
      if (m.audioUrl?.startsWith('/uploads/')) referenced.add(m.audioUrl);
    }

    const files: MediaFileEntry[] = [];
    for (const category of UPLOAD_SUBDIRS) {
      const dir = path.join(UPLOADS_DIR, category);
      if (!fs.existsSync(dir)) continue;
      for (const filename of fs.readdirSync(dir)) {
        const fp = path.join(dir, filename);
        try {
          const stat = fs.statSync(fp);
          if (!stat.isFile()) continue;
          const url = `/uploads/${category}/${filename}`;
          files.push({
            url,
            filename,
            category,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            inUse: referenced.has(url),
          });
        } catch {
          // ignore
        }
      }
    }
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    res.json({ files });
  });

  app.delete('/api/admin/media', requireAdmin, (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url.startsWith('/uploads/')) {
      res.status(400).json({ error: 'Invalid upload file path.' });
      return;
    }
    const reclaimed = safeUnlinkUploadUrl(url);
    recordAudit(ADMIN_USERNAME, 'media.delete', url, `Deleted uploaded file (${reclaimed} bytes)`);
    saveStore(store);
    res.json({ deleted: true, reclaimedBytes: reclaimed, storage: computeStorageSummary() });
  });

  app.post('/api/admin/storage/cleanup', requireAdmin, (_req, res) => {
    const result = runExpirationAndStorageCleanup();
    recordAudit(
      ADMIN_USERNAME,
      'storage.cleanup',
      'uploads',
      `Purged ${result.purgedProjects} expired projects, ${result.deletedOrphanFiles} orphan files`
    );
    saveStore(store);
    res.json({
      ...result,
      storage: computeStorageSummary(),
    });
  });

  // ── Admin Audit Logs, Security Controls & JSON Backup Export ────────────────
  app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
    res.json({ auditLogs: store.auditLogs || [] });
  });

  app.post('/api/admin/security/reset-rate-limits', requireAdmin, (_req, res) => {
    const cleared = rateBuckets.size;
    rateBuckets.clear();
    recordAudit(ADMIN_USERNAME, 'security.reset_rate_limits', 'rate-limiter', `Cleared ${cleared} active IP buckets`);
    saveStore(store);
    res.json({ clearedBuckets: cleared });
  });

  app.post('/api/admin/security/change-password', requireAdmin, (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || !verifyAdminCredentials(ADMIN_USERNAME, currentPassword)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: 'New password must be between 6 and 128 characters.' });
      return;
    }
    store.adminPasswordHashOverride = crypto.scryptSync(newPassword, PASSWORD_SALT, 64).toString('hex');
    recordAudit(ADMIN_USERNAME, 'security.change_password', ADMIN_USERNAME, 'Updated administrator password hash');
    saveStore(store);
    res.json({ updated: true });
  });

  app.get('/api/admin/export', requireAdmin, (_req, res) => {
    recordAudit(ADMIN_USERNAME, 'admin.export', 'backup', 'Exported sanitized platform backup JSON');
    saveStore(store);
    res.json({
      exportedAt: new Date().toISOString(),
      settings: store.settings,
      templates: store.templates,
      animationPresets: store.animationPresets,
      musicTracks: store.musicTracks,
      backgrounds: store.backgrounds,
      projects: store.projects.map(sanitizePublicProject),
      reports: store.reports,
      auditLogs: store.auditLogs || [],
    });
  });

  // ── Vite Dev Middleware / Static Production Assets ──────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Birthday Magic server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Birthday Magic server:', err);
  process.exit(1);
});
