import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Flag,
  FolderKanban,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  LayoutTemplate,
  Lock,
  LogOut,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { auth, signInAdminWithGoogle, signOutFirebaseAdmin } from '../firebase';
import {
  adminBulkProjects,
  adminChangePassword,
  adminCreateAnimation,
  adminCreateBackground,
  adminCreateMusic,
  adminCreateTemplate,
  adminDeleteAnimation,
  adminDeleteBackground,
  adminDeleteMedia,
  adminDeleteMusic,
  adminDeleteProject,
  adminDeleteTemplate,
  adminExtendProject,
  adminResetRateLimits,
  adminResolveReport,
  adminRevokeProjectToken,
  adminRunStorageCleanup,
  adminSetProjectStatus,
  adminUpdateAnimation,
  adminUpdateSettings,
  adminUpdateTemplate,
  adminUploadAudio,
  adminUploadBackgroundImage,
  fetchAdminAnimations,
  fetchAdminAuditLogs,
  fetchAdminBackgrounds,
  fetchAdminExportBackup,
  fetchAdminMedia,
  fetchAdminMusic,
  fetchAdminOverview,
  fetchAdminProjects,
  fetchAdminReports,
  fetchAdminSession,
  fetchAdminSettings,
  fetchAdminTemplates,
  loginAdmin,
  logoutAdmin,
} from '../services/api';
import type {
  AdminAuditLog,
  AdminOverview,
  AdminSessionInfo,
  AnimationEffectType,
  AnimationIntensity,
  AnimationPreset,
  BackgroundAsset,
  BirthdayProject,
  BirthdayTemplate,
  ContentReport,
  FontStyle,
  MediaFileEntry,
  MusicTrack,
  SiteSettings,
} from '../types/birthday';
import { birthdayAudio } from '../utils/audioEngine';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
  onCatalogUpdated: () => void;
}

type AdminSection =
  | 'overview'
  | 'projects'
  | 'templates'
  | 'animations'
  | 'music'
  | 'backgrounds'
  | 'reports'
  | 'storage'
  | 'activity'
  | 'settings';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onCatalogUpdated }) => {
  const [session, setSession] = useState<AdminSessionInfo | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);

  // Login Form State (Zero hardcoded credentials)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Workspace State
  const [section, setSection] = useState<AdminSection>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin Datasets
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [projects, setProjects] = useState<BirthdayProject[]>([]);
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [animations, setAnimations] = useState<AnimationPreset[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [settingsForm, setSettingsForm] = useState<SiteSettings | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFileEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Filters & Selections
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'published' | 'draft' | 'unpublished'>('all');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [inspectedProject, setInspectedProject] = useState<BirthdayProject | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('open');
  const [auditSearch, setAuditSearch] = useState('');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Security Password Change State
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  // Template Create/Edit Form
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('Editorial');
  const [tplDesc, setTplDesc] = useState('');
  const [tplImage, setTplImage] = useState('/src/assets/images/template_golden_candlelight_1795407298151.jpg');
  const [tplTheme, setTplTheme] = useState<'light' | 'dark'>('light');
  const [tplAccent, setTplAccent] = useState('#E11D48');
  const [tplFont, setTplFont] = useState<FontStyle>('editorial');

  // Animation Create/Edit Form
  const [editingAnimId, setEditingAnimId] = useState<string | null>(null);
  const [animName, setAnimName] = useState('');
  const [animEffect, setAnimEffect] = useState<AnimationEffectType>('confetti');
  const [animIntensity, setAnimIntensity] = useState<AnimationIntensity>('balanced');
  const [animDesc, setAnimDesc] = useState('');

  // Music Create Form
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicSynthPreset, setMusicSynthPreset] = useState('happy-birthday');
  const [musicMode, setMusicMode] = useState<'audio' | 'synth'>('audio');

  // Background Create Form
  const [bgName, setBgName] = useState('');
  const [bgCategory, setBgCategory] = useState('Editorial');
  const [bgFile, setBgFile] = useState<File | null>(null);

  // Cleanup result
  const [cleanupSummary, setCleanupSummary] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u));
    return () => {
      unsub();
      birthdayAudio.stop();
    };
  }, []);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ov, pr, tp, an, mu, bg, rp, st, md, al] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminProjects(),
        fetchAdminTemplates(),
        fetchAdminAnimations(),
        fetchAdminMusic(),
        fetchAdminBackgrounds(),
        fetchAdminReports(),
        fetchAdminSettings(),
        fetchAdminMedia(),
        fetchAdminAuditLogs(),
      ]);
      setOverview(ov);
      setProjects(pr.projects);
      setTemplates(tp.templates);
      setAnimations(an.animationPresets);
      setMusicTracks(mu.musicTracks);
      setBackgrounds(bg.backgrounds);
      setReports(rp.reports);
      setSettingsForm(st.settings);
      setMediaFiles(md.files);
      setAuditLogs(al.auditLogs);
      setSelectedProjectIds((prev) => prev.filter((id) => pr.projects.some((p) => p.id === id)));
      setInspectedProject((prev) => (prev ? pr.projects.find((p) => p.id === prev.id) || null : null));
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load admin data.' });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminSession()
      .then((s) => {
        setSession(s);
        if (s.authenticated) {
          void loadAllAdminData();
        }
      })
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setCheckingSession(false));
  }, [loadAllAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await loginAdmin(username, password);
      setPassword('');
      setSession(res);
      await loadAllAdminData();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    birthdayAudio.stop();
    await logoutAdmin().catch(() => {});
    if (auth.currentUser) {
      await signOutFirebaseAdmin().catch(() => {});
    }
    setSession({ authenticated: false });
    setOverview(null);
    setProjects([]);
  };

  const handleConnectFirebaseAuth = async () => {
    setFeedback(null);
    try {
      await signInAdminWithGoogle();
      setFeedback({ type: 'ok', text: 'Firebase Admin Auth connected for live Firestore synchronization.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Firebase sign-in failed.' });
    }
  };

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((p) => {
      if (projectStatusFilter !== 'all' && p.status !== projectStatusFilter) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.recipientName.toLowerCase().includes(q) ||
        p.senderName.toLowerCase().includes(q) ||
        p.headline.toLowerCase().includes(q)
      );
    });
  }, [projects, projectSearch, projectStatusFilter]);

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportProjectsCsv = () => {
    const header = ['ID', 'Recipient', 'Sender', 'Status', 'Visits', 'Photos', 'Wishes', 'Template', 'CreatedAt', 'ExpiresAt'];
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = projects.map((p) =>
      [
        p.id,
        p.recipientName,
        p.senderName,
        p.status,
        p.visitCount,
        p.photos.length,
        p.wishes.length,
        p.templateId,
        p.createdAt,
        p.expiresAt,
      ]
        .map(escapeCsv)
        .join(',')
    );
    downloadBlob([header.join(','), ...rows].join('\n'), `birthday-magic-pages-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    setFeedback({ type: 'ok', text: `Exported ${projects.length} birthday pages to CSV.` });
  };

  const handleExportAuditCsv = () => {
    const header = ['Timestamp', 'Actor', 'Action', 'Target', 'Details'];
    const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = auditLogs.map((l) => [l.createdAt, l.actor, l.action, l.target, l.details].map(escapeCsv).join(','));
    downloadBlob([header.join(','), ...rows].join('\n'), `birthday-magic-audit-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    setFeedback({ type: 'ok', text: `Exported ${auditLogs.length} audit log records to CSV.` });
  };

  const handleDownloadFullBackup = async () => {
    setBusyAction(true);
    try {
      const backup = await fetchAdminExportBackup();
      downloadBlob(
        JSON.stringify(backup, null, 2),
        `birthday-magic-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json'
      );
      setFeedback({ type: 'ok', text: 'Full platform configuration & project backup downloaded.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Backup export failed.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleBulkAction = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (selectedProjectIds.length === 0) return;
    setBusyAction(true);
    try {
      const res = await adminBulkProjects(selectedProjectIds, action);
      setSelectedProjectIds([]);
      await loadAllAdminData();
      setFeedback({
        type: 'ok',
        text:
          action === 'delete'
            ? `Bulk deleted ${res.deleted} birthday pages.`
            : `Bulk updated ${res.updated} birthday pages (${action}).`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Bulk action failed.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleExtendProject = async (id: string, days: number) => {
    setBusyAction(true);
    try {
      const res = await adminExtendProject(id, days);
      setInspectedProject(res.project);
      await loadAllAdminData();
      setFeedback({ type: 'ok', text: `Extended project ${id} expiration by +${days} days.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to extend expiration.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    setBusyAction(true);
    try {
      await adminRevokeProjectToken(id);
      await loadAllAdminData();
      setFeedback({
        type: 'ok',
        text: `Revoked active owner edit token for ${id}. Existing edit links can no longer modify this page.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to revoke edit token.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteMediaFile = async (file: MediaFileEntry) => {
    setBusyAction(true);
    try {
      const res = await adminDeleteMedia(file.url);
      await loadAllAdminData();
      setFeedback({
        type: 'ok',
        text: `Deleted ${file.filename} (${formatBytes(res.reclaimedBytes)} reclaimed).`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Could not delete media file.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetRateLimits = async () => {
    setBusyAction(true);
    try {
      const res = await adminResetRateLimits();
      await loadAllAdminData();
      setFeedback({ type: 'ok', text: `Cleared ${res.clearedBuckets} active rate-limit buckets.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to clear rate limits.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPwd || !newPwd) return;
    setBusyAction(true);
    try {
      await adminChangePassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      await loadAllAdminData();
      setFeedback({ type: 'ok', text: 'Administrator password updated securely.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Could not update password.' });
    } finally {
      setBusyAction(false);
    }
  };

  // ── CRUD Handlers ──────────────────────────────────────────────────────────
  const handleToggleProjectStatus = async (project: BirthdayProject) => {
    const next = project.status === 'published' ? 'unpublished' : 'published';
    try {
      await adminSetProjectStatus(project.id, next);
      await loadAllAdminData();
      setFeedback({
        type: 'ok',
        text: next === 'published' ? `Published "${project.recipientName}".` : `Unpublished "${project.recipientName}".`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Status update failed.' });
    }
  };

  const handleDeleteProject = async (project: BirthdayProject) => {
    try {
      await adminDeleteProject(project.id);
      await loadAllAdminData();
      setFeedback({ type: 'ok', text: `Deleted project ${project.id} and associated uploads.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  const resetTemplateForm = () => {
    setEditingTplId(null);
    setTplName('');
    setTplCategory('Editorial');
    setTplDesc('');
    setTplImage(backgrounds[0]?.imageUrl || '/src/assets/images/template_golden_candlelight_1795407298151.jpg');
    setTplTheme('light');
    setTplAccent('#E11D48');
    setTplFont('editorial');
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    setBusyAction(true);
    try {
      const payload = {
        name: tplName.trim(),
        category: tplCategory.trim() || 'Custom',
        description: tplDesc.trim(),
        previewImage: tplImage.trim(),
        themeMode: tplTheme,
        accentColor: tplAccent,
        fontStyle: tplFont,
        active: true,
      };
      if (editingTplId) {
        await adminUpdateTemplate(editingTplId, payload);
        setFeedback({ type: 'ok', text: `Template "${payload.name}" updated.` });
      } else {
        await adminCreateTemplate(payload);
        setFeedback({ type: 'ok', text: `Template "${payload.name}" added.` });
      }
      resetTemplateForm();
      await loadAllAdminData();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save template.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveAnimation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animName.trim()) return;
    setBusyAction(true);
    try {
      const payload = {
        name: animName.trim(),
        effectType: animEffect,
        intensity: animIntensity,
        description: animDesc.trim(),
        active: true,
      };
      if (editingAnimId) {
        await adminUpdateAnimation(editingAnimId, payload);
        setFeedback({ type: 'ok', text: `Animation preset "${payload.name}" updated.` });
      } else {
        await adminCreateAnimation(payload);
        setFeedback({ type: 'ok', text: `Animation preset "${payload.name}" created.` });
      }
      setEditingAnimId(null);
      setAnimName('');
      setAnimDesc('');
      await loadAllAdminData();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save animation preset.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleAddMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicTitle.trim()) return;
    setBusyAction(true);
    try {
      if (musicMode === 'audio') {
        if (!musicFile) {
          throw new Error('Select an MP3, WAV, OGG, or M4A audio file to upload.');
        }
        const uploaded = await adminUploadAudio(musicFile);
        await adminCreateMusic({
          title: musicTitle.trim(),
          artist: musicArtist.trim() || 'Uploaded Track',
          sourceType: 'audio',
          audioUrl: uploaded.url,
          sizeBytes: uploaded.sizeBytes,
          durationLabel: `${formatBytes(uploaded.sizeBytes)} · Audio`,
          active: true,
        });
      } else {
        await adminCreateMusic({
          title: musicTitle.trim(),
          artist: musicArtist.trim() || 'Birthday Magic Studio',
          sourceType: 'synth',
          synthPreset: musicSynthPreset,
          durationLabel: 'Loop · Studio Synth',
          sizeBytes: 0,
          active: true,
        });
      }
      setMusicTitle('');
      setMusicArtist('');
      setMusicFile(null);
      await loadAllAdminData();
      onCatalogUpdated();
      setFeedback({ type: 'ok', text: 'Background music track added to library.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to add music track.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleAddBackground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgName.trim() || !bgFile) {
      setFeedback({ type: 'err', text: 'Provide a background name and select an image file.' });
      return;
    }
    setBusyAction(true);
    try {
      const uploaded = await adminUploadBackgroundImage(bgFile);
      await adminCreateBackground({
        name: bgName.trim(),
        category: bgCategory.trim() || 'Custom',
        imageUrl: uploaded.url,
        sizeBytes: uploaded.sizeBytes,
        active: true,
      });
      setBgName('');
      setBgFile(null);
      await loadAllAdminData();
      onCatalogUpdated();
      setFeedback({ type: 'ok', text: 'Background image uploaded and published to studio.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to upload background.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'unpublish' | 'delete_project') => {
    setBusyAction(true);
    try {
      await adminResolveReport(reportId, action);
      await loadAllAdminData();
      setFeedback({
        type: 'ok',
        text:
          action === 'dismiss'
            ? 'Report dismissed.'
            : action === 'unpublish'
              ? 'Reported birthday page unpublished and report resolved.'
              : 'Reported birthday page permanently deleted.',
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Moderation action failed.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setBusyAction(true);
    try {
      await adminUpdateSettings(settingsForm);
      await loadAllAdminData();
      onCatalogUpdated();
      setFeedback({ type: 'ok', text: 'Site branding, upload limits, and expiration settings saved.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save settings.' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleRunCleanup = async () => {
    setBusyAction(true);
    try {
      const res = await adminRunStorageCleanup();
      setCleanupSummary(
        `Purged ${res.purgedProjects} expired projects and ${res.deletedOrphanFiles} orphan files (${formatBytes(res.reclaimedBytes)} reclaimed).`
      );
      await loadAllAdminData();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Cleanup failed.' });
    } finally {
      setBusyAction(false);
    }
  };

  // ── Loading / Unauthenticated Login Gate ───────────────────────────────────
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <p className="text-xs text-zinc-500">Verifying administrator session...</p>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              <Lock className="w-3.5 h-3.5 text-zinc-700" />
              <span>Protected Administrator Portal</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
            >
              Back to site
            </button>
          </div>

          <h1 className="font-display text-2xl font-semibold text-zinc-900 mb-2">Administrator Sign In</h1>
          <p className="text-xs text-zinc-600 leading-relaxed mb-6">
            Public birthday creators never need an account. This portal is restricted exclusively to authorized
            administrators.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Administrator Username</label>
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username"
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loggingIn ? 'Verifying Credentials...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Authenticated Admin Dashboard (Sidebar 256px + Top Breadcrumb Bar) ─────
  const navItems: { id: AdminSection; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview & Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'projects', label: 'Birthday Pages', icon: <FolderKanban className="w-4 h-4" />, count: projects.length },
    { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="w-4 h-4" />, count: templates.length },
    { id: 'animations', label: 'Animation Presets', icon: <Sparkles className="w-4 h-4" />, count: animations.length },
    { id: 'music', label: 'Music Library', icon: <Music className="w-4 h-4" />, count: musicTracks.length },
    { id: 'backgrounds', label: 'Backgrounds', icon: <ImageIcon className="w-4 h-4" />, count: backgrounds.length },
    {
      id: 'reports',
      label: 'Reported Content',
      icon: <Flag className="w-4 h-4" />,
      count: reports.filter((r) => r.status === 'open').length,
    },
    { id: 'storage', label: 'Storage & Cleanup', icon: <HardDrive className="w-4 h-4" />, count: mediaFiles.length },
    { id: 'activity', label: 'Activity & Security', icon: <Activity className="w-4 h-4" />, count: auditLogs.length },
    { id: 'settings', label: 'Settings & Branding', icon: <Settings className="w-4 h-4" /> },
  ];

  const currentSectionLabel = navItems.find((n) => n.id === section)?.label || 'Overview';
  const maxDailyVisits = Math.max(1, ...(overview?.dailyMetrics.map((d) => d.visits) || [1]));

  return (
    <div className="min-h-screen flex bg-[#FAF9F7] text-zinc-900">
      {/* Sidebar Navigation (256px) */}
      <aside className="w-64 shrink-0 border-r border-stone-200 bg-white hidden lg:flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="font-display text-lg font-semibold text-zinc-900 whitespace-nowrap cursor-pointer"
          >
            Birthday Magic
          </button>
          <p className="text-[11px] text-zinc-500 mt-0.5">Admin Console · {session.username}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setFeedback(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-stone-100 hover:text-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? 'text-stone-300' : item.id === 'reports' && item.count > 0 ? 'text-rose-600 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-200 space-y-2.5">
          <div className="text-[11px] text-zinc-500">
            Session expires{' '}
            <span className="font-mono tabular-nums">
              {session.expiresAt
                ? new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '8h'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-zinc-800 hover:bg-stone-100 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Breadcrumb Bar */}
        <header className="h-14 border-b border-stone-200 bg-white px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500 truncate">
            <span className="text-zinc-900 font-medium">Admin</span>
            <span>/</span>
            <span className="truncate">{currentSectionLabel}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadAllAdminData()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-zinc-700 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Public Site
            </button>
          </div>
        </header>

        {/* Mobile Section Switcher */}
        <div className="lg:hidden border-b border-stone-200 bg-white px-4 py-2 overflow-x-auto flex items-center gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                section === item.id ? 'bg-zinc-900 text-white' : 'bg-stone-100 text-zinc-700'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-rose-700 bg-rose-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === 'err'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} className="underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full space-y-8 overflow-y-auto">
          {/* ─── 1. OVERVIEW & ANALYTICS ───────────────────────────────────── */}
          {section === 'overview' && overview && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-zinc-900">Platform Overview</h1>
                  <p className="text-xs text-zinc-500 mt-1">
                    Live metrics across all no-login birthday pages, visits, reports, and uploaded assets.
                  </p>
                </div>

                {/* Optional Firebase Auth Link for Direct Firestore Admin Sync */}
                <div className="flex items-center gap-3">
                  {firebaseUser ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <ShieldCheck className="w-4 h-4" />
                      Firestore Admin Synced ({firebaseUser.email})
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectFirebaseAuth}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-zinc-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Connect Firebase Admin Auth
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Column KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Total Projects</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {overview.totalProjects}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
                    {overview.draftProjects} drafts · {overview.unpublishedProjects} unpublished
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Published Pages</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1">
                    {overview.publishedProjects}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">Publicly accessible URLs</p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Total Public Visits</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {overview.totalVisits}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">Cumulative celebration opens</p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Open Reports · Storage</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {overview.openReports}{' '}
                    <span className="text-sm font-normal text-zinc-500">· {formatBytes(overview.storage.totalBytes)}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">
                    {overview.storage.fileCount} uploaded files
                  </p>
                </div>
              </div>

              {/* 7-Day Activity Chart & Top Templates */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">7-Day Visits & Creations</h2>
                      <p className="text-xs text-zinc-500">Daily public page views and new projects</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
                    {overview.dailyMetrics.map((pt) => {
                      const heightPct = Math.max(8, Math.round((pt.visits / maxDailyVisits) * 100));
                      return (
                        <div key={pt.date} className="flex flex-col items-center gap-2 h-full justify-end">
                          <span className="font-mono text-[11px] text-zinc-600 tabular-nums">{pt.visits}</span>
                          <div className="w-full max-w-[34px] bg-stone-100 rounded-md h-28 flex items-end overflow-hidden">
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full bg-zinc-900 rounded-t-md transition-all"
                              title={`${pt.visits} visits · ${pt.projectsCreated} created`}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500 whitespace-nowrap">{pt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-6 space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">Top Templates</h2>
                    <p className="text-xs text-zinc-500">Most used layouts across projects</p>
                  </div>
                  <div className="space-y-3">
                    {overview.topTemplates.length === 0 ? (
                      <p className="text-xs text-zinc-500">No projects created yet.</p>
                    ) : (
                      overview.topTemplates.map((item) => (
                        <div key={item.templateId} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0">
                          <span className="text-zinc-800 font-medium">{item.name}</span>
                          <span className="font-mono tabular-nums text-zinc-600">{item.count} pages</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Most Visited Published Pages */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200">
                  <h2 className="text-sm font-semibold text-zinc-900">Most Visited Pages</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] text-zinc-500 border-b border-stone-200">
                      <tr>
                        <th className="px-6 py-3 font-medium">Recipient</th>
                        <th className="px-6 py-3 font-medium">Headline</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Visits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {overview.topPages.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/70">
                          <td className="px-6 py-3 font-medium text-zinc-900">{p.recipientName}</td>
                          <td className="px-6 py-3 text-zinc-600 truncate max-w-xs">{p.headline}</td>
                          <td className="px-6 py-3 capitalize text-zinc-600">{p.status}</td>
                          <td className="px-6 py-3 text-right font-mono tabular-nums text-zinc-900">{p.visitCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── 2. MANAGE BIRTHDAY PAGES ──────────────────────────────────── */}
          {section === 'projects' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-zinc-900">Birthday Pages</h1>
                  <p className="text-xs text-zinc-500 mt-1">
                    Inspect, bulk-moderate, extend expiration, revoke edit tokens, or export user-created birthday pages.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search recipient, sender, or ID..."
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-zinc-900 w-52"
                  />
                  <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg">
                    {(['all', 'published', 'draft', 'unpublished'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setProjectStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize cursor-pointer ${
                          projectStatusFilter === st ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleExportProjectsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-zinc-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Bulk Selection Toolbar */}
              {selectedProjectIds.length > 0 && (
                <div className="bg-zinc-900 text-white rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium tabular-nums">
                    {selectedProjectIds.length} {selectedProjectIds.length === 1 ? 'page' : 'pages'} selected
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleBulkAction('publish')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                    >
                      Bulk Publish
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleBulkAction('unpublish')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer"
                    >
                      Bulk Unpublish
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleBulkAction('delete')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      Bulk Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectIds([])}
                      className="px-2.5 py-1.5 text-xs text-stone-300 hover:text-white underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] text-zinc-500 border-b border-stone-200">
                      <tr>
                        <th className="pl-5 pr-2 py-3 w-8">
                          <input
                            type="checkbox"
                            aria-label="Select all filtered pages"
                            checked={
                              filteredProjects.length > 0 &&
                              filteredProjects.every((p) => selectedProjectIds.includes(p.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjectIds(filteredProjects.map((p) => p.id));
                              } else {
                                setSelectedProjectIds([]);
                              }
                            }}
                            className="w-3.5 h-3.5 accent-zinc-900 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Page</th>
                        <th className="px-4 py-3 font-medium">ID</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Visits</th>
                        <th className="px-4 py-3 font-medium">Expires</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredProjects.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                            No birthday pages match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredProjects.map((p) => {
                          const checked = selectedProjectIds.includes(p.id);
                          return (
                            <tr key={p.id} className="hover:bg-stone-50/70">
                              <td className="pl-5 pr-2 py-3.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${p.recipientName}`}
                                  checked={checked}
                                  onChange={(e) => {
                                    setSelectedProjectIds((prev) =>
                                      e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                    );
                                  }}
                                  className="w-3.5 h-3.5 accent-zinc-900 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-semibold text-zinc-900">{p.recipientName}</p>
                                <p className="text-[11px] text-zinc-500">
                                  From {p.senderName} · {p.photos.length} photos · {p.wishes.length} wishes
                                </p>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-600">{p.id}</td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`font-medium capitalize ${
                                    p.status === 'published'
                                      ? 'text-emerald-700'
                                      : p.status === 'unpublished'
                                        ? 'text-amber-700'
                                        : 'text-zinc-500'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono tabular-nums text-zinc-900">
                                {p.visitCount}
                              </td>
                              <td className="px-4 py-3.5 font-mono tabular-nums text-[11px] text-zinc-500">
                                {new Date(p.expiresAt).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setInspectedProject(p)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-300 text-zinc-700 hover:bg-stone-100 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Inspect
                                  </button>
                                  {p.status === 'published' && (
                                    <button
                                      type="button"
                                      onClick={() => onNavigate(`/b/${p.id}`)}
                                      className="text-zinc-600 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                                    >
                                      Open
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleProjectStatus(p)}
                                    className="px-2.5 py-1 rounded border border-stone-300 text-zinc-800 hover:bg-stone-100 cursor-pointer"
                                  >
                                    {p.status === 'published' ? 'Unpublish' : 'Publish'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteProject(p)}
                                    className="p-1.5 rounded text-rose-700 hover:bg-rose-50 cursor-pointer"
                                    aria-label={`Delete ${p.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── 3. TEMPLATES CRUD ─────────────────────────────────────────── */}
          {section === 'templates' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Templates</h1>
                <p className="text-xs text-zinc-500 mt-1">Add, edit, or delete birthday page templates available in the public studio.</p>
              </div>

              <form onSubmit={handleSaveTemplate} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {editingTplId ? `Edit Template (${editingTplId})` : 'Add New Template'}
                  </h2>
                  {editingTplId && (
                    <button type="button" onClick={resetTemplateForm} className="text-xs text-zinc-500 underline cursor-pointer">
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="Template Name"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value)}
                    placeholder="Category (e.g., Evening)"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                  <select
                    value={tplImage}
                    onChange={(e) => setTplImage(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    {backgrounds.map((b) => (
                      <option key={b.id} value={b.imageUrl}>
                        Backdrop: {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <select
                    value={tplTheme}
                    onChange={(e) => setTplTheme(e.target.value as 'light' | 'dark')}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="light">Daylight Theme</option>
                    <option value="dark">Evening Dark Theme</option>
                  </select>
                  <select
                    value={tplFont}
                    onChange={(e) => setTplFont(e.target.value as FontStyle)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="editorial">Editorial Serif</option>
                    <option value="classic">Classic Italic</option>
                    <option value="modern">Modern Sans</option>
                  </select>
                  <input
                    type="text"
                    value={tplAccent}
                    onChange={(e) => setTplAccent(e.target.value)}
                    placeholder="Accent Hex (#E11D48)"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <input
                  type="text"
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  placeholder="Short description shown on template cards..."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />

                <button
                  type="submit"
                  disabled={busyAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {editingTplId ? 'Save Template Changes' : 'Add Template'}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="bg-white border border-stone-200 rounded-xl p-4 flex gap-4">
                    <img
                      src={tpl.previewImage}
                      alt={tpl.name}
                      referrerPolicy="no-referrer"
                      className="w-24 h-20 rounded-lg object-cover shrink-0 bg-stone-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{tpl.name}</p>
                      <p className="text-[11px] text-zinc-500">
                        {tpl.category} · {tpl.themeMode} · {tpl.active ? 'Active' : 'Hidden'}
                      </p>
                      <p className="text-xs text-zinc-600 line-clamp-2 mt-1">{tpl.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTplId(tpl.id);
                            setTplName(tpl.name);
                            setTplCategory(tpl.category);
                            setTplDesc(tpl.description);
                            setTplImage(tpl.previewImage);
                            setTplTheme(tpl.themeMode);
                            setTplAccent(tpl.accentColor);
                            setTplFont(tpl.fontStyle);
                          }}
                          className="text-zinc-800 font-medium underline underline-offset-2 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminUpdateTemplate(tpl.id, { active: !tpl.active });
                            await loadAllAdminData();
                            onCatalogUpdated();
                          }}
                          className="text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        >
                          {tpl.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await adminDeleteTemplate(tpl.id);
                            await loadAllAdminData();
                            onCatalogUpdated();
                          }}
                          className="text-rose-700 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 4. ANIMATION PRESETS CRUD ─────────────────────────────────── */}
          {section === 'animations' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Animation Presets</h1>
                <p className="text-xs text-zinc-500 mt-1">Configure celebration motion effects selectable in the builder studio.</p>
              </div>

              <form onSubmit={handleSaveAnimation} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {editingAnimId ? `Edit Preset (${editingAnimId})` : 'Add Animation Preset'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={animName}
                    onChange={(e) => setAnimName(e.target.value)}
                    placeholder="Preset Name"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                  <select
                    value={animEffect}
                    onChange={(e) => setAnimEffect(e.target.value as AnimationEffectType)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="confetti">2D Foil Confetti</option>
                    <option value="fireworks">2D Radial Fireworks</option>
                    <option value="embers">2D Candlelight Embers</option>
                    <option value="petals">2D Botanical Petals</option>
                    <option value="starlight">2D Twinkling Starlight</option>
                    <option value="balloons">2D Floating Silk Balloons</option>
                    <option value="butterflies">2D Fluttering Butterflies</option>
                    <option value="hearts">2D Origami Rising Hearts</option>
                    <option value="ribbons">2D Curling Streamer Ribbons</option>
                    <option value="snowsparkle">2D Champagne Sparkle Bubbles</option>
                  </select>
                  <select
                    value={animIntensity}
                    onChange={(e) => setAnimIntensity(e.target.value as AnimationIntensity)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="gentle">Gentle Intensity</option>
                    <option value="balanced">Balanced Intensity</option>
                    <option value="festive">Festive Intensity</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={animDesc}
                  onChange={(e) => setAnimDesc(e.target.value)}
                  placeholder="Description..."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {editingAnimId ? 'Update Preset' : 'Add Preset'}
                  </button>
                  {editingAnimId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAnimId(null);
                        setAnimName('');
                        setAnimDesc('');
                      }}
                      className="text-xs text-zinc-500 underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {animations.map((preset) => (
                  <div key={preset.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{preset.name}</p>
                      <p className="text-xs text-zinc-500 capitalize">
                        {preset.effectType} · {preset.intensity} · {preset.active ? 'Active' : 'Disabled'}
                      </p>
                      {preset.description && <p className="text-xs text-zinc-600 mt-1">{preset.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnimId(preset.id);
                          setAnimName(preset.name);
                          setAnimEffect(preset.effectType);
                          setAnimIntensity(preset.intensity);
                          setAnimDesc(preset.description);
                        }}
                        className="underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminUpdateAnimation(preset.id, { active: !preset.active });
                          await loadAllAdminData();
                          onCatalogUpdated();
                        }}
                        className="text-zinc-600 cursor-pointer"
                      >
                        {preset.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteAnimation(preset.id);
                          await loadAllAdminData();
                          onCatalogUpdated();
                        }}
                        className="text-rose-700 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 5. MUSIC LIBRARY & UPLOAD ─────────────────────────────────── */}
          {section === 'music' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Background Music Library</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Upload MP3/WAV/OGG audio tracks or register studio melodies for public creators.
                </p>
              </div>

              <form onSubmit={handleAddMusic} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setMusicMode('audio')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                      musicMode === 'audio' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Upload Audio File
                  </button>
                  <button
                    type="button"
                    onClick={() => setMusicMode('synth')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                      musicMode === 'synth' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Studio Synth Melody
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={musicTitle}
                    onChange={(e) => setMusicTitle(e.target.value)}
                    placeholder="Track Title"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={musicArtist}
                    onChange={(e) => setMusicArtist(e.target.value)}
                    placeholder="Artist / Composer"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                {musicMode === 'audio' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
                      onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                      className="text-xs text-zinc-600"
                    />
                    <span className="text-[11px] text-zinc-500">Max {settingsForm?.maxAudioSizeMb || 12} MB</span>
                  </div>
                ) : (
                  <select
                    value={musicSynthPreset}
                    onChange={(e) => setMusicSynthPreset(e.target.value)}
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="happy-birthday">Happy Birthday Chimes</option>
                    <option value="music-box">Candlelight Music Box</option>
                    <option value="waltz">Golden Hour Waltz</option>
                    <option value="piano-lullaby">Midnight Piano Lullaby</option>
                  </select>
                )}

                <button
                  type="submit"
                  disabled={busyAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {busyAction ? 'Saving...' : 'Add Music Track'}
                </button>
              </form>

              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {musicTracks.map((track) => {
                  const playing = playingTrackId === track.id;
                  return (
                    <div key={track.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{track.title}</p>
                        <p className="text-xs text-zinc-500">
                          {track.artist} · {track.sourceType === 'audio' ? 'Uploaded File' : 'Web Audio Synth'} ·{' '}
                          {track.durationLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (playing) {
                              birthdayAudio.stop();
                              setPlayingTrackId(null);
                            } else {
                              birthdayAudio.play(track);
                              setPlayingTrackId(track.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-stone-300 text-xs cursor-pointer"
                        >
                          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {playing ? 'Stop' : 'Play'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (playing) birthdayAudio.stop();
                            await adminDeleteMusic(track.id);
                            await loadAllAdminData();
                            onCatalogUpdated();
                          }}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── 6. BACKGROUNDS LIBRARY & UPLOAD ───────────────────────────── */}
          {section === 'backgrounds' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Backgrounds Library</h1>
                <p className="text-xs text-zinc-500 mt-1">Upload and curate high-resolution celebration backdrops.</p>
              </div>

              <form onSubmit={handleAddBackground} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    value={bgName}
                    onChange={(e) => setBgName(e.target.value)}
                    placeholder="Background Name"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={bgCategory}
                    onChange={(e) => setBgCategory(e.target.value)}
                    placeholder="Category (e.g., Botanical)"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setBgFile(e.target.files?.[0] || null)}
                  className="text-xs text-zinc-600"
                />
                <div>
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {busyAction ? 'Uploading...' : 'Upload Background'}
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {backgrounds.map((bg) => (
                  <div key={bg.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                    <div className="aspect-[4/3] bg-stone-100">
                      <img
                        src={bg.imageUrl}
                        alt={bg.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 truncate">{bg.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {bg.category} {bg.sizeBytes > 0 ? `· ${formatBytes(bg.sizeBytes)}` : '· Bundled'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminDeleteBackground(bg.id);
                          await loadAllAdminData();
                          onCatalogUpdated();
                        }}
                        className="p-1.5 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                        aria-label={`Delete ${bg.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 7. REPORTED CONTENT MODERATION ────────────────────────────── */}
          {section === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-zinc-900">Reported Public Content</h1>
                  <p className="text-xs text-zinc-500 mt-1">Review flagged birthday pages and unpublish or delete violations.</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg">
                  {(['open', 'resolved', 'dismissed', 'all'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReportFilter(st)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize cursor-pointer ${
                        reportFilter === st ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {filteredReports.length === 0 ? (
                  <div className="p-10 text-center text-xs text-zinc-500">
                    No {reportFilter === 'all' ? '' : reportFilter} reports in the moderation queue.
                  </div>
                ) : (
                  filteredReports.map((rep) => (
                    <div key={rep.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-zinc-900 capitalize">{rep.reason}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-zinc-600">{rep.projectId}</span>
                          {rep.projectRecipient && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-600">{rep.projectRecipient}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="capitalize text-zinc-500">{rep.status}</span>
                        </div>
                        <p className="text-xs text-zinc-700">{rep.details || 'No additional details supplied.'}</p>
                        <p className="text-[11px] font-mono text-zinc-400">
                          Reported {new Date(rep.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {rep.status === 'open' && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleResolveReport(rep.id, 'dismiss')}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-zinc-700 hover:bg-stone-100 cursor-pointer"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleResolveReport(rep.id, 'unpublish')}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer"
                          >
                            Unpublish Page
                          </button>
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleResolveReport(rep.id, 'delete_project')}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                          >
                            Delete Page
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── 8. STORAGE USAGE & CLEANUP POLICY ─────────────────────────── */}
          {section === 'storage' && overview && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Storage & Cleanup Policies</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Monitor uploaded media consumption and purge expired projects or orphaned files.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Total Uploaded Media</p>
                  <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatBytes(overview.storage.totalBytes)}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 tabular-nums">{overview.storage.fileCount} files</p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">User Birthday Photos</p>
                  <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatBytes(overview.storage.projectPhotosBytes)}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Admin Backgrounds</p>
                  <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatBytes(overview.storage.backgroundsBytes)}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-zinc-500">Uploaded Music Files</p>
                  <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatBytes(overview.storage.musicBytes)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Automated Expiration & Orphan Media Sweep</h2>
                  <p className="text-xs text-zinc-600 mt-1">
                    Projects automatically expire after{' '}
                    <span className="font-mono font-semibold">{settingsForm?.projectExpirationDays || 90} days</span>.
                    Currently pending expiration: <span className="font-mono">{overview.storage.expiredProjectCount}</span>.
                  </p>
                  {cleanupSummary && <p className="text-xs text-emerald-700 font-medium mt-2">{cleanupSummary}</p>}
                </div>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleRunCleanup}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {busyAction ? 'Cleaning...' : 'Run Storage Cleanup Now'}
                </button>
              </div>

              {/* Live Uploaded Media Browser */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">Uploaded Media Files</h2>
                    <p className="text-xs text-zinc-500">Inspect disk uploads and delete orphaned or unwanted assets.</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-zinc-500">{mediaFiles.length} files</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] text-zinc-500 border-b border-stone-200">
                      <tr>
                        <th className="px-5 py-3 font-medium">File</th>
                        <th className="px-5 py-3 font-medium">Folder</th>
                        <th className="px-5 py-3 font-medium">Reference</th>
                        <th className="px-5 py-3 font-medium text-right">Size</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {mediaFiles.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                            No user-uploaded media files currently on disk.
                          </td>
                        </tr>
                      ) : (
                        mediaFiles.map((file) => (
                          <tr key={file.url} className="hover:bg-stone-50/70">
                            <td className="px-5 py-3 font-mono text-[11px] text-zinc-800 max-w-xs truncate">
                              {file.filename}
                            </td>
                            <td className="px-5 py-3 capitalize text-zinc-600">{file.category}</td>
                            <td className="px-5 py-3">
                              <span className={file.inUse ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                                {file.inUse ? 'In use' : 'Orphaned'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-zinc-700">
                              {formatBytes(file.sizeBytes)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-3">
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
                                >
                                  Preview
                                </a>
                                <button
                                  type="button"
                                  disabled={busyAction}
                                  onClick={() => void handleDeleteMediaFile(file)}
                                  className="text-rose-700 hover:underline cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── 8B. ACTIVITY AUDIT LOG & SECURITY CONTROLS ────────────────── */}
          {section === 'activity' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-zinc-900">Activity Log & Security</h1>
                  <p className="text-xs text-zinc-500 mt-1">
                    Track administrative actions, reset IP rate limits, rotate your admin password, and export backups.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportAuditCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-zinc-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Audit CSV
                  </button>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleDownloadFullBackup()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Backup JSON
                  </button>
                </div>
              </div>

              {/* Security Tools Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleChangeAdminPassword}
                  className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-zinc-700" />
                    <h2 className="text-sm font-semibold text-zinc-900">Update Administrator Password</h2>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Passwords are hashed with scrypt on the backend and are never displayed in this dashboard.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      placeholder="Current password"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="New password (minimum 6 characters)"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                  >
                    {busyAction ? 'Updating...' : 'Save New Password'}
                  </button>
                </form>

                <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-zinc-700" />
                      <h2 className="text-sm font-semibold text-zinc-900">Rate Limit & Abuse Controls</h2>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Public creation and publishing are capped at{' '}
                      <span className="font-mono font-semibold">{settingsForm?.rateLimitPerHour || 30}</span> actions per
                      IP per hour. If a shared school, office, or event venue hits this ceiling legitimately, you can
                      reset all active IP buckets immediately.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleResetRateLimits()}
                      className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-zinc-900 hover:bg-stone-100 cursor-pointer"
                    >
                      Reset Active IP Rate Limits
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit Log Table */}
              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Administrative Audit Trail</h2>
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter action, target, or details..."
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-zinc-900 w-60"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] text-zinc-500 border-b border-stone-200">
                      <tr>
                        <th className="px-5 py-3 font-medium">Timestamp</th>
                        <th className="px-5 py-3 font-medium">Actor</th>
                        <th className="px-5 py-3 font-medium">Action</th>
                        <th className="px-5 py-3 font-medium">Target</th>
                        <th className="px-5 py-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                            No audit log entries recorded yet.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.slice(0, 100).map((log) => (
                          <tr key={log.id} className="hover:bg-stone-50/70">
                            <td className="px-5 py-3 font-mono tabular-nums text-[11px] text-zinc-500 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-3 font-mono text-[11px] text-zinc-800">{log.actor}</td>
                            <td className="px-5 py-3 font-medium text-zinc-900">{log.action}</td>
                            <td className="px-5 py-3 font-mono text-[11px] text-zinc-600">{log.target}</td>
                            <td className="px-5 py-3 text-zinc-600">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── 9. SITE SETTINGS, BRANDING, UPLOAD LIMITS & EXPIRATION ────── */}
          {section === 'settings' && settingsForm && (
            <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
              <div>
                <h1 className="font-display text-2xl font-semibold text-zinc-900">Settings, Branding & Limits</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Configure public website branding, file upload limits, rate limiting, and automatic project expiration.
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">Website Branding</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Website Name</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={settingsForm.siteName}
                      onChange={(e) => setSettingsForm((s) => (s ? { ...s, siteName: e.target.value } : s))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Footer Note</label>
                    <input
                      type="text"
                      maxLength={180}
                      value={settingsForm.footerNote}
                      onChange={(e) => setSettingsForm((s) => (s ? { ...s, footerNote: e.target.value } : s))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Hero Headline</label>
                  <input
                    type="text"
                    maxLength={140}
                    value={settingsForm.heroHeadline}
                    onChange={(e) => setSettingsForm((s) => (s ? { ...s, heroHeadline: e.target.value } : s))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Tagline</label>
                  <textarea
                    rows={2}
                    maxLength={180}
                    value={settingsForm.tagline}
                    onChange={(e) => setSettingsForm((s) => (s ? { ...s, tagline: e.target.value } : s))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">Upload Limits, Rate Limiting & Expiration</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Max Image Size (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settingsForm.maxImageSizeMb}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, maxImageSizeMb: Number(e.target.value) } : s))
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Max Audio Size (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settingsForm.maxAudioSizeMb}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, maxAudioSizeMb: Number(e.target.value) } : s))
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Max Photos / Project</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={settingsForm.maxPhotosPerProject}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, maxPhotosPerProject: Number(e.target.value) } : s))
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Project Expiration (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={settingsForm.projectExpirationDays}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, projectExpirationDays: Number(e.target.value) } : s))
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Create / Publish Rate Limit (per Hour)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={settingsForm.rateLimitPerHour}
                      onChange={(e) =>
                        setSettingsForm((s) => (s ? { ...s, rateLimitPerHour: Number(e.target.value) } : s))
                      }
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs text-zinc-700 cursor-pointer">
                  <span>Allow public no-login publishing of new birthday pages</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.allowPublicPublishing}
                    onChange={(e) =>
                      setSettingsForm((s) => (s ? { ...s, allowPublicPublishing: e.target.checked } : s))
                    }
                    className="w-4 h-4 accent-zinc-900"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs text-zinc-700 cursor-pointer">
                  <span>Maintenance Mode (pause new creations in Builder Studio; live pages remain viewable)</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.maintenanceMode)}
                    onChange={(e) =>
                      setSettingsForm((s) => (s ? { ...s, maintenanceMode: e.target.checked } : s))
                    }
                    className="w-4 h-4 accent-zinc-900"
                  />
                </label>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-900">Global Site Announcement Banner</h2>
                <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                  <span>Display announcement bar across public pages</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm.announcementEnabled)}
                    onChange={(e) =>
                      setSettingsForm((s) => (s ? { ...s, announcementEnabled: e.target.checked } : s))
                    }
                    className="w-4 h-4 accent-zinc-900"
                  />
                </label>
                <input
                  type="text"
                  maxLength={180}
                  value={settingsForm.announcementText || ''}
                  onChange={(e) =>
                    setSettingsForm((s) => (s ? { ...s, announcementText: e.target.value } : s))
                  }
                  placeholder="e.g., New Royal Champagne & Sakura templates are now live in the studio!"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={busyAction}
                className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
              >
                {busyAction ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            </form>
          )}
        </main>
      </div>

      {/* Project Inspector Modal */}
      {inspectedProject && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setInspectedProject(null)}
        >
          <div
            className="max-w-2xl w-full bg-white rounded-2xl border border-stone-200 p-6 sm:p-7 space-y-5 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs font-mono text-zinc-500">
                  {inspectedProject.id} · {inspectedProject.status} · {inspectedProject.visitCount} visits
                </p>
                <h2 className="font-display text-2xl font-semibold text-zinc-900 mt-0.5">
                  {inspectedProject.recipientName}
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">From {inspectedProject.senderName}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedProject(null)}
                aria-label="Close inspector"
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-zinc-900">{inspectedProject.headline}</p>
              <p className="text-zinc-600 whitespace-pre-line leading-relaxed">{inspectedProject.message}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-y border-stone-200 py-4">
              <div>
                <p className="text-zinc-500">Template</p>
                <p className="font-mono text-zinc-900 truncate mt-0.5">{inspectedProject.templateId}</p>
              </div>
              <div>
                <p className="text-zinc-500">Photos · Wishes</p>
                <p className="font-mono tabular-nums text-zinc-900 mt-0.5">
                  {inspectedProject.photos.length} · {inspectedProject.wishes.length}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Storage</p>
                <p className="font-mono tabular-nums text-zinc-900 mt-0.5">
                  {formatBytes(inspectedProject.storageBytes)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Expires</p>
                <p className="font-mono tabular-nums text-zinc-900 mt-0.5">
                  {new Date(inspectedProject.expiresAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {inspectedProject.photos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-700 mb-2">Attached Photos</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {inspectedProject.photos.map((ph) => (
                    <a
                      key={ph.id}
                      href={ph.url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-stone-200 bg-stone-100 block"
                    >
                      <img
                        src={ph.url}
                        alt={ph.caption || 'Attached photo'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleExtendProject(inspectedProject.id, 30)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-800 hover:bg-stone-100 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Extend +30d
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleExtendProject(inspectedProject.id, 90)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-800 hover:bg-stone-100 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Extend +90d
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleRevokeToken(inspectedProject.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Revoke Edit Token
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const target = inspectedProject;
                  setInspectedProject(null);
                  void handleDeleteProject(target);
                }}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
