import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdminAuditLog,
  AdminOverview,
  AdminSessionInfo,
  AnimationPreset,
  BackgroundAsset,
  BirthdayProject,
  BirthdayTemplate,
  ContentReport,
  MediaFileEntry,
  MusicTrack,
  ProjectStatus,
  PublicCatalog,
  ReportReason,
  SiteSettings,
  StorageUsageSummary,
} from '../types/birthday';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// ─── Firestore Mirror Helpers (Strictly Matching firebase-blueprint.json) ────
function buildFirestoreProjectPayload(project: BirthdayProject) {
  return {
    id: project.id,
    recipientName: project.recipientName.slice(0, 80),
    senderName: project.senderName.slice(0, 80),
    age: typeof project.age === 'number' ? project.age : 0,
    headline: project.headline.slice(0, 140),
    message: project.message.slice(0, 2000),
    templateId: project.templateId.slice(0, 64),
    backgroundId: (project.backgroundId || '').slice(0, 64),
    backgroundUrl: (project.backgroundUrl || '').slice(0, 500),
    musicId: (project.musicId || '').slice(0, 64),
    musicUrl: (project.musicUrl || '').slice(0, 500),
    animationPresetId: project.animationPresetId.slice(0, 64),
    accentColor: (project.accentColor || '#E11D48').slice(0, 32),
    fontStyle: project.fontStyle,
    status: project.status,
    visitCount: Math.max(0, project.visitCount || 0),
    storageBytes: Math.max(0, project.storageBytes || 0),
    wishes: (project.wishes || []).slice(0, 20).map((w) => ({
      id: w.id,
      author: w.author.slice(0, 60),
      relationship: w.relationship.slice(0, 40),
      text: w.text.slice(0, 400),
    })),
    photos: (project.photos || []).slice(0, 12).map((p) => ({
      id: p.id,
      url: p.url.slice(0, 500),
      caption: p.caption.slice(0, 140),
    })),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(project.expiresAt)),
  };
}

async function mirrorProjectCreateToFirestore(project: BirthdayProject): Promise<void> {
  const path = `projects/${project.id}`;
  try {
    await setDoc(doc(db, 'projects', project.id), buildFirestoreProjectPayload(project));
  } catch (err) {
    // Log structured error context without blocking public flow if quota/network hiccups
    try {
      handleFirestoreError(err, OperationType.CREATE, path);
    } catch {
      // Structured log emitted by handleFirestoreError
    }
  }
}

async function mirrorReportCreateToFirestore(report: ContentReport): Promise<void> {
  const path = `reports/${report.id}`;
  try {
    await setDoc(doc(db, 'reports', report.id), {
      id: report.id,
      projectId: report.projectId,
      reason: report.reason,
      details: report.details.slice(0, 500),
      status: 'open',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.CREATE, path);
    } catch {
      // Structured log emitted by handleFirestoreError
    }
  }
}

async function mirrorAdminFirestoreWrite(fn: () => Promise<void>, op: OperationType, path: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await fn();
  } catch (err) {
    try {
      handleFirestoreError(err, op, path);
    } catch {
      // Structured log emitted
    }
  }
}

// ─── Public No-Login APIs ─────────────────────────────────────────────────────
export function fetchPublicCatalog(): Promise<PublicCatalog> {
  return requestJson<PublicCatalog>('/api/catalog');
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function optimizeImageFile(file: File, maxSizeMb: number): Promise<{ file: File; optimized: boolean }> {
  // Keep animated GIFs untouched so animation frames are preserved
  if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
    return { file, optimized: false };
  }

  const maxBytes = maxSizeMb * 1024 * 1024;
  // Optimize if file exceeds 2.2 MB or exceeds the configured upload ceiling
  if (file.size <= Math.min(2.2 * 1024 * 1024, maxBytes * 0.85)) {
    return { file, optimized: false };
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, optimized: false };
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.86;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) break;
      quality -= 0.14;
    }

    if (!blob || blob.size >= file.size) {
      return { file, optimized: false };
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'birthday-photo';
    const optimizedFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    return { file: optimizedFile, optimized: true };
  } catch {
    return { file, optimized: false };
  }
}

export async function uploadPublicPhoto(
  rawFile: File,
  maxSizeMb = 6
): Promise<{ url: string; sizeBytes: number; storageSource: 'firebase' | 'server'; optimized?: boolean }> {
  const { file, optimized } = await optimizeImageFile(rawFile, maxSizeMb);

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`"${rawFile.name}" is still larger than the ${maxSizeMb} MB limit even after optimization.`);
  }

  // Primary multipart upload to server (fast, reliable, validated)
  try {
    const form = new FormData();
    form.append('file', file);
    const serverResult = await requestJson<{ url: string; sizeBytes: number }>('/api/upload/photo', {
      method: 'POST',
      body: form,
    });
    return {
      url: serverResult.url,
      sizeBytes: serverResult.sizeBytes,
      storageSource: 'server',
      optimized,
    };
  } catch (multipartErr) {
    // Fallback to JSON base64 upload in case a proxy strips multipart headers or filename metadata
    try {
      const dataUrl = await fileToDataUrl(file);
      const fallbackResult = await requestJson<{ url: string; sizeBytes: number }>('/api/upload/photo-data', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      return {
        url: fallbackResult.url,
        sizeBytes: fallbackResult.sizeBytes,
        storageSource: 'server',
        optimized,
      };
    } catch (fallbackErr) {
      throw fallbackErr instanceof Error
        ? fallbackErr
        : multipartErr instanceof Error
          ? multipartErr
          : new Error('Photo upload failed.');
    }
  }
}

export async function createBirthdayProject(
  payload: Partial<BirthdayProject>
): Promise<{ project: BirthdayProject; editToken: string }> {
  const result = await requestJson<{ project: BirthdayProject; editToken: string }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void mirrorProjectCreateToFirestore(result.project);
  return result;
}

export async function fetchPublicBirthdayPage(id: string): Promise<{ project: BirthdayProject }> {
  try {
    return await requestJson<{ project: BirthdayProject }>(`/api/projects/public/${encodeURIComponent(id)}`);
  } catch (serverErr) {
    // Fallback read from Firestore if present as published snapshot
    const path = `projects/${id}`;
    try {
      const snap = await getDoc(doc(db, 'projects', id));
      if (snap.exists() && snap.data().status === 'published') {
        const d = snap.data();
        return {
          project: {
            id: d.id,
            recipientName: d.recipientName,
            senderName: d.senderName,
            age: d.age ?? null,
            headline: d.headline,
            message: d.message,
            templateId: d.templateId,
            backgroundId: d.backgroundId || '',
            backgroundUrl: d.backgroundUrl || '',
            musicId: d.musicId || '',
            musicUrl: d.musicUrl || '',
            animationPresetId: d.animationPresetId,
            accentColor: d.accentColor || '#E11D48',
            fontStyle: d.fontStyle || 'editorial',
            showCake: true,
            showEnvelopeIntro: true,
            status: 'published',
            visitCount: d.visitCount || 0,
            storageBytes: d.storageBytes || 0,
            wishes: d.wishes || [],
            photos: d.photos || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
          },
        };
      }
    } catch (fsErr) {
      try {
        handleFirestoreError(fsErr, OperationType.GET, path);
      } catch {
        // logged
      }
    }
    throw serverErr;
  }
}

export function verifyEditToken(id: string, editToken: string): Promise<{ project: BirthdayProject }> {
  return requestJson<{ project: BirthdayProject }>(`/api/projects/${encodeURIComponent(id)}/verify-token`, {
    method: 'POST',
    headers: { 'X-Edit-Token': editToken },
    body: JSON.stringify({ editToken }),
  });
}

export function updateBirthdayProject(
  id: string,
  editToken: string,
  payload: Partial<BirthdayProject>
): Promise<{ project: BirthdayProject }> {
  return requestJson<{ project: BirthdayProject }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'X-Edit-Token': editToken },
    body: JSON.stringify(payload),
  });
}

export function publishBirthdayProject(
  id: string,
  editToken: string,
  status: 'published' | 'draft' = 'published'
): Promise<{ project: BirthdayProject }> {
  return requestJson<{ project: BirthdayProject }>(`/api/projects/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    headers: { 'X-Edit-Token': editToken },
    body: JSON.stringify({ status }),
  });
}

export function rotateProjectEditToken(
  id: string,
  editToken: string
): Promise<{ editToken: string; project: BirthdayProject }> {
  return requestJson<{ editToken: string; project: BirthdayProject }>(
    `/api/projects/${encodeURIComponent(id)}/rotate-token`,
    {
      method: 'POST',
      headers: { 'X-Edit-Token': editToken },
    }
  );
}

export function deleteBirthdayProjectByToken(id: string, editToken: string): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Edit-Token': editToken },
  });
}

export async function submitContentReport(
  projectId: string,
  reason: ReportReason,
  details: string
): Promise<{ report: ContentReport }> {
  const result = await requestJson<{ report: ContentReport }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ projectId, reason, details }),
  });
  void mirrorReportCreateToFirestore(result.report);
  return result;
}

// ─── Admin Authentication & Protected APIs ────────────────────────────────────
export function fetchAdminSession(): Promise<AdminSessionInfo> {
  return requestJson<AdminSessionInfo>('/api/admin/session');
}

export function loginAdmin(username: string, password: string): Promise<AdminSessionInfo> {
  return requestJson<AdminSessionInfo>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/admin/logout', { method: 'POST' });
}

export function fetchAdminOverview(): Promise<AdminOverview> {
  return requestJson<AdminOverview>('/api/admin/overview');
}

export function fetchAdminProjects(): Promise<{ projects: BirthdayProject[] }> {
  return requestJson<{ projects: BirthdayProject[] }>('/api/admin/projects');
}

export async function adminSetProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<{ project: BirthdayProject }> {
  const res = await requestJson<{ project: BirthdayProject }>(`/api/admin/projects/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  void mirrorAdminFirestoreWrite(
    () => updateDoc(doc(db, 'projects', id), { status, updatedAt: serverTimestamp() }),
    OperationType.UPDATE,
    `projects/${id}`
  );
  return res;
}

export async function adminDeleteProject(id: string): Promise<{ deleted: boolean }> {
  const res = await requestJson<{ deleted: boolean }>(`/api/admin/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  void mirrorAdminFirestoreWrite(
    () => deleteDoc(doc(db, 'projects', id)),
    OperationType.DELETE,
    `projects/${id}`
  );
  return res;
}

export function fetchAdminTemplates(): Promise<{ templates: BirthdayTemplate[] }> {
  return requestJson<{ templates: BirthdayTemplate[] }>('/api/admin/templates');
}

export async function adminCreateTemplate(
  payload: Partial<BirthdayTemplate>
): Promise<{ template: BirthdayTemplate }> {
  const res = await requestJson<{ template: BirthdayTemplate }>('/api/admin/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () => setDoc(doc(db, 'templates', res.template.id), { ...res.template, updatedAt: serverTimestamp() }),
    OperationType.CREATE,
    `templates/${res.template.id}`
  );
  return res;
}

export async function adminUpdateTemplate(
  id: string,
  payload: Partial<BirthdayTemplate>
): Promise<{ template: BirthdayTemplate }> {
  const res = await requestJson<{ template: BirthdayTemplate }>(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () => setDoc(doc(db, 'templates', id), { ...res.template, updatedAt: serverTimestamp() }),
    OperationType.UPDATE,
    `templates/${id}`
  );
  return res;
}

export async function adminDeleteTemplate(id: string): Promise<{ deleted: boolean }> {
  const res = await requestJson<{ deleted: boolean }>(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  void mirrorAdminFirestoreWrite(
    () => deleteDoc(doc(db, 'templates', id)),
    OperationType.DELETE,
    `templates/${id}`
  );
  return res;
}

export function fetchAdminAnimations(): Promise<{ animationPresets: AnimationPreset[] }> {
  return requestJson<{ animationPresets: AnimationPreset[] }>('/api/admin/animations');
}

export async function adminCreateAnimation(
  payload: Partial<AnimationPreset>
): Promise<{ animationPreset: AnimationPreset }> {
  const res = await requestJson<{ animationPreset: AnimationPreset }>('/api/admin/animations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () =>
      setDoc(doc(db, 'animationPresets', res.animationPreset.id), {
        ...res.animationPreset,
        updatedAt: serverTimestamp(),
      }),
    OperationType.CREATE,
    `animationPresets/${res.animationPreset.id}`
  );
  return res;
}

export async function adminUpdateAnimation(
  id: string,
  payload: Partial<AnimationPreset>
): Promise<{ animationPreset: AnimationPreset }> {
  const res = await requestJson<{ animationPreset: AnimationPreset }>(
    `/api/admin/animations/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  void mirrorAdminFirestoreWrite(
    () => setDoc(doc(db, 'animationPresets', id), { ...res.animationPreset, updatedAt: serverTimestamp() }),
    OperationType.UPDATE,
    `animationPresets/${id}`
  );
  return res;
}

export async function adminDeleteAnimation(id: string): Promise<{ deleted: boolean }> {
  const res = await requestJson<{ deleted: boolean }>(`/api/admin/animations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  void mirrorAdminFirestoreWrite(
    () => deleteDoc(doc(db, 'animationPresets', id)),
    OperationType.DELETE,
    `animationPresets/${id}`
  );
  return res;
}

export function fetchAdminMusic(): Promise<{ musicTracks: MusicTrack[] }> {
  return requestJson<{ musicTracks: MusicTrack[] }>('/api/admin/music');
}

export function adminUploadAudio(file: File): Promise<{ url: string; sizeBytes: number }> {
  const form = new FormData();
  form.append('file', file);
  return requestJson<{ url: string; sizeBytes: number }>('/api/admin/upload/audio', {
    method: 'POST',
    body: form,
  });
}

export async function adminCreateMusic(payload: Partial<MusicTrack>): Promise<{ musicTrack: MusicTrack }> {
  const res = await requestJson<{ musicTrack: MusicTrack }>('/api/admin/music', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () => setDoc(doc(db, 'musicTracks', res.musicTrack.id), { ...res.musicTrack, updatedAt: serverTimestamp() }),
    OperationType.CREATE,
    `musicTracks/${res.musicTrack.id}`
  );
  return res;
}

export async function adminDeleteMusic(id: string): Promise<{ deleted: boolean }> {
  const res = await requestJson<{ deleted: boolean }>(`/api/admin/music/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  void mirrorAdminFirestoreWrite(
    () => deleteDoc(doc(db, 'musicTracks', id)),
    OperationType.DELETE,
    `musicTracks/${id}`
  );
  return res;
}

export function fetchAdminBackgrounds(): Promise<{ backgrounds: BackgroundAsset[] }> {
  return requestJson<{ backgrounds: BackgroundAsset[] }>('/api/admin/backgrounds');
}

export function adminUploadBackgroundImage(file: File): Promise<{ url: string; sizeBytes: number }> {
  const form = new FormData();
  form.append('file', file);
  return requestJson<{ url: string; sizeBytes: number }>('/api/admin/upload/image', {
    method: 'POST',
    body: form,
  });
}

export async function adminCreateBackground(
  payload: Partial<BackgroundAsset>
): Promise<{ background: BackgroundAsset }> {
  const res = await requestJson<{ background: BackgroundAsset }>('/api/admin/backgrounds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () => setDoc(doc(db, 'backgrounds', res.background.id), { ...res.background, updatedAt: serverTimestamp() }),
    OperationType.CREATE,
    `backgrounds/${res.background.id}`
  );
  return res;
}

export async function adminDeleteBackground(id: string): Promise<{ deleted: boolean }> {
  const res = await requestJson<{ deleted: boolean }>(`/api/admin/backgrounds/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  void mirrorAdminFirestoreWrite(
    () => deleteDoc(doc(db, 'backgrounds', id)),
    OperationType.DELETE,
    `backgrounds/${id}`
  );
  return res;
}

export function fetchAdminReports(): Promise<{ reports: ContentReport[] }> {
  return requestJson<{ reports: ContentReport[] }>('/api/admin/reports');
}

export function adminResolveReport(
  id: string,
  action: 'dismiss' | 'unpublish' | 'delete_project'
): Promise<{ report: ContentReport }> {
  return requestJson<{ report: ContentReport }>(`/api/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export function fetchAdminSettings(): Promise<{ settings: SiteSettings }> {
  return requestJson<{ settings: SiteSettings }>('/api/admin/settings');
}

export async function adminUpdateSettings(payload: Partial<SiteSettings>): Promise<{ settings: SiteSettings }> {
  const res = await requestJson<{ settings: SiteSettings }>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  void mirrorAdminFirestoreWrite(
    () =>
      setDoc(doc(db, 'settings', 'global'), {
        siteName: res.settings.siteName,
        tagline: res.settings.tagline,
        maxImageSizeMb: res.settings.maxImageSizeMb,
        maxAudioSizeMb: res.settings.maxAudioSizeMb,
        maxPhotosPerProject: res.settings.maxPhotosPerProject,
        projectExpirationDays: res.settings.projectExpirationDays,
        rateLimitPerHour: res.settings.rateLimitPerHour,
        allowPublicPublishing: res.settings.allowPublicPublishing,
        updatedAt: serverTimestamp(),
      }),
    OperationType.WRITE,
    'settings/global'
  );
  return res;
}

export function adminRunStorageCleanup(): Promise<{
  purgedProjects: number;
  deletedOrphanFiles: number;
  reclaimedBytes: number;
  storage: StorageUsageSummary;
}> {
  return requestJson('/api/admin/storage/cleanup', { method: 'POST' });
}

export function adminBulkProjects(
  ids: string[],
  action: 'publish' | 'unpublish' | 'delete'
): Promise<{ updated: number; deleted: number }> {
  return requestJson('/api/admin/projects/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  });
}

export function adminExtendProject(id: string, days: number): Promise<{ project: BirthdayProject }> {
  return requestJson(`/api/admin/projects/${encodeURIComponent(id)}/extend`, {
    method: 'PATCH',
    body: JSON.stringify({ days }),
  });
}

export function adminRevokeProjectToken(id: string): Promise<{ revoked: boolean; projectId: string }> {
  return requestJson(`/api/admin/projects/${encodeURIComponent(id)}/revoke-token`, {
    method: 'POST',
  });
}

export function fetchAdminMedia(): Promise<{ files: MediaFileEntry[] }> {
  return requestJson('/api/admin/media');
}

export function adminDeleteMedia(url: string): Promise<{ deleted: boolean; reclaimedBytes: number }> {
  return requestJson('/api/admin/media', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  });
}

export function fetchAdminAuditLogs(): Promise<{ auditLogs: AdminAuditLog[] }> {
  return requestJson('/api/admin/audit-logs');
}

export function adminResetRateLimits(): Promise<{ clearedBuckets: number }> {
  return requestJson('/api/admin/security/reset-rate-limits', { method: 'POST' });
}

export function adminChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ updated: boolean }> {
  return requestJson('/api/admin/security/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function fetchAdminExportBackup(): Promise<Record<string, unknown>> {
  return requestJson('/api/admin/export');
}

