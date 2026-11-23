import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Monitor,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createBirthdayProject,
  deleteBirthdayProjectByToken,
  publishBirthdayProject,
  rotateProjectEditToken,
  updateBirthdayProject,
  uploadPublicPhoto,
} from '../services/api';
import type {
  BirthdayPhoto,
  BirthdayProject,
  BirthdayWish,
  FontStyle,
  PublicCatalog,
} from '../types/birthday';
import { birthdayAudio } from '../utils/audioEngine';
import { BirthdayCanvas } from './BirthdayCanvas';

interface BuilderStudioProps {
  catalog: PublicCatalog;
  initialTemplateId?: string;
  editingProject?: BirthdayProject | null;
  editingToken?: string | null;
  onNavigate: (path: string) => void;
  onProjectDeleted?: () => void;
}

type EditorTab = 'details' | 'template' | 'photos' | 'wishes' | 'motion';

const ACCENT_SWATCHES = ['#E11D48', '#D97706', '#15803D', '#1D4ED8', '#7C3AED', '#18181B'];

function buildInitialDraft(catalog: PublicCatalog, templateId?: string): BirthdayProject {
  const tpl =
    catalog.templates.find((t) => t.id === templateId) ||
    catalog.templates[0] || {
      id: 'golden-candlelight',
      accentColor: '#D97706',
      fontStyle: 'editorial' as FontStyle,
      previewImage: '/src/assets/images/template_golden_candlelight_1795407298151.jpg',
      defaultAnimationId: 'amber-embers',
      defaultMusicId: 'candlelight-music-box',
    };

  const defaultBg =
    catalog.backgrounds.find((b) => b.imageUrl === tpl.previewImage) || catalog.backgrounds[0];

  const now = new Date().toISOString();
  const expires = new Date(Date.now() + catalog.settings.projectExpirationDays * 86400000).toISOString();

  return {
    id: '',
    recipientName: 'Elena',
    senderName: 'Your Favorite Crew',
    age: 28,
    headline: 'Happy 28th Birthday, Elena',
    message:
      'Wishing you a year filled with warm mornings, brave new chapters, and laughter around every table. Blow out the candles below and make your wish.',
    eventDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    templateId: tpl.id,
    backgroundId: defaultBg?.id || '',
    backgroundUrl: tpl.previewImage || defaultBg?.imageUrl || '',
    musicId: tpl.defaultMusicId || catalog.musicTracks[0]?.id || '',
    musicUrl: '',
    animationPresetId: tpl.defaultAnimationId || catalog.animationPresets[0]?.id || '',
    accentColor: tpl.accentColor || '#E11D48',
    fontStyle: tpl.fontStyle || 'editorial',
    showCake: true,
    showEnvelopeIntro: true,
    status: 'draft',
    visitCount: 0,
    storageBytes: 0,
    wishes: [
      {
        id: 'w-init-1',
        author: 'Maya',
        relationship: 'Best Friend',
        text: 'So grateful for another year of late-night talks and spontaneous coffee runs!',
      },
    ],
    photos: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: expires,
  };
}

export const BuilderStudio: React.FC<BuilderStudioProps> = ({
  catalog,
  initialTemplateId,
  editingProject,
  editingToken,
  onNavigate,
  onProjectDeleted,
}) => {
  const [draft, setDraft] = useState<BirthdayProject>(() =>
    editingProject ? { ...editingProject } : buildInitialDraft(catalog, initialTemplateId)
  );
  const [savedProjectId, setSavedProjectId] = useState<string>(editingProject?.id || '');
  const [editToken, setEditToken] = useState<string>(editingToken || '');

  const [activeTab, setActiveTab] = useState<EditorTab>('details');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [triggerSignal, setTriggerSignal] = useState(0);
  const [auditionTrackId, setAuditionTrackId] = useState<string | null>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Share & Private Edit Key Modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'public' | 'edit' | null>(null);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // New Wish Inputs
  const [newWishAuthor, setNewWishAuthor] = useState('');
  const [newWishRelation, setNewWishRelation] = useState('');
  const [newWishText, setNewWishText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingProject) {
      setDraft({ ...editingProject });
      setSavedProjectId(editingProject.id);
    }
    if (editingToken) {
      setEditToken(editingToken);
    }
  }, [editingProject, editingToken]);

  useEffect(() => {
    return () => {
      birthdayAudio.stop();
    };
  }, []);

  const activeTemplate = useMemo(
    () => catalog.templates.find((t) => t.id === draft.templateId) || catalog.templates[0],
    [catalog.templates, draft.templateId]
  );
  const activeAnimation = useMemo(
    () => catalog.animationPresets.find((a) => a.id === draft.animationPresetId) || catalog.animationPresets[0],
    [catalog.animationPresets, draft.animationPresetId]
  );
  const activeMusic = useMemo(
    () => catalog.musicTracks.find((m) => m.id === draft.musicId),
    [catalog.musicTracks, draft.musicId]
  );

  const publicUrl = savedProjectId ? `${window.location.origin}/b/${savedProjectId}` : '';
  const privateEditUrl =
    savedProjectId && editToken ? `${window.location.origin}/edit/${savedProjectId}#token=${editToken}` : '';

  const applyTemplate = (templateId: string) => {
    const tpl = catalog.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraft((prev) => ({
      ...prev,
      templateId: tpl.id,
      backgroundUrl: tpl.previewImage,
      accentColor: tpl.accentColor,
      fontStyle: tpl.fontStyle,
      animationPresetId: tpl.defaultAnimationId || prev.animationPresetId,
      musicId: tpl.defaultMusicId || prev.musicId,
    }));
  };

  const handlePhotoUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const maxPhotos = catalog.settings.maxPhotosPerProject;
    if (draft.photos.length >= maxPhotos) {
      setErrorMessage(`You can attach up to ${maxPhotos} photos per birthday page.`);
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setUploadingPhoto(true);
    try {
      const remainingSlots = maxPhotos - draft.photos.length;
      const toUpload = Array.from(files).slice(0, remainingSlots);
      const uploaded: BirthdayPhoto[] = [];
      let optimizedCount = 0;

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        setUploadProgress(`Uploading ${i + 1} of ${toUpload.length}...`);
        const res = await uploadPublicPhoto(file, catalog.settings.maxImageSizeMb);
        if (res.optimized) optimizedCount += 1;
        uploaded.push({
          id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url: res.url,
          caption: '',
          sizeBytes: res.sizeBytes,
          storageSource: res.storageSource,
        });
      }

      setDraft((prev) => ({
        ...prev,
        photos: [...prev.photos, ...uploaded],
      }));
      const optNote = optimizedCount > 0 ? ' (auto-optimized for fast loading)' : '';
      setStatusMessage(`${uploaded.length} ${uploaded.length === 1 ? 'photo' : 'photos'} uploaded${optNote}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCoverPhotoUpload = async (file: File | null | undefined) => {
    if (!file) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setUploadingCover(true);
    try {
      const res = await uploadPublicPhoto(file, catalog.settings.maxImageSizeMb);
      setDraft((prev) => ({
        ...prev,
        backgroundId: 'custom-upload',
        backgroundUrl: res.url,
      }));
      setStatusMessage('Custom cover photo uploaded and applied to hero backdrop.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Cover photo upload failed.');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.photos.length) return prev;
      const next = [...prev.photos];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, photos: next };
    });
  };

  const handleAddWish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWishText.trim()) return;
    if (draft.wishes.length >= 20) {
      setErrorMessage('Maximum of 20 wishes per page reached.');
      return;
    }
    const wish: BirthdayWish = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: newWishAuthor.trim() || 'A Friend',
      relationship: newWishRelation.trim() || 'Friend',
      text: newWishText.trim(),
    };
    setDraft((prev) => ({ ...prev, wishes: [...prev.wishes, wish] }));
    setNewWishAuthor('');
    setNewWishRelation('');
    setNewWishText('');
  };

  const handleSaveOrPublish = async (publishNow: boolean) => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (!draft.recipientName.trim() || !draft.senderName.trim() || !draft.headline.trim() || !draft.message.trim()) {
      setErrorMessage('Please fill in Recipient Name, From Name, Headline, and Birthday Message.');
      setActiveTab('details');
      return;
    }

    setSaving(true);
    try {
      if (!savedProjectId || !editToken) {
        const res = await createBirthdayProject({
          ...draft,
          status: publishNow ? 'published' : 'draft',
        });
        setDraft(res.project);
        setSavedProjectId(res.project.id);
        setEditToken(res.editToken);
        setStatusMessage(publishNow ? 'Birthday website published.' : 'Draft saved with private edit key.');
        setShareModalOpen(true);
        window.history.replaceState(null, '', `/edit/${res.project.id}#token=${res.editToken}`);
      } else {
        const updated = await updateBirthdayProject(savedProjectId, editToken, draft);
        let finalProj = updated.project;
        if (publishNow && finalProj.status !== 'published') {
          const pub = await publishBirthdayProject(savedProjectId, editToken, 'published');
          finalProj = pub.project;
        }
        setDraft(finalProj);
        setStatusMessage(publishNow ? 'Changes saved and published live.' : 'Draft updated.');
        if (publishNow) {
          setShareModalOpen(true);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublishInModal = async () => {
    if (!savedProjectId || !editToken) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const nextStatus = draft.status === 'published' ? 'draft' : 'published';
      const res = await publishBirthdayProject(savedProjectId, editToken, nextStatus);
      setDraft(res.project);
      setStatusMessage(nextStatus === 'published' ? 'Page is now live.' : 'Page switched to private draft.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update publish status.');
    } finally {
      setSaving(false);
    }
  };

  const handleRotateToken = async () => {
    if (!savedProjectId || !editToken) return;
    setRotatingToken(true);
    setErrorMessage(null);
    try {
      const res = await rotateProjectEditToken(savedProjectId, editToken);
      setEditToken(res.editToken);
      setDraft(res.project);
      window.history.replaceState(null, '', `/edit/${savedProjectId}#token=${res.editToken}`);
      setStatusMessage('Edit token rotated. Previous edit links are now revoked.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not rotate edit token.');
    } finally {
      setRotatingToken(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!savedProjectId || !editToken) return;
    setDeletingProject(true);
    setErrorMessage(null);
    try {
      await deleteBirthdayProjectByToken(savedProjectId, editToken);
      setShareModalOpen(false);
      setSavedProjectId('');
      setEditToken('');
      if (onProjectDeleted) {
        onProjectDeleted();
      } else {
        onNavigate('/');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not delete project.');
    } finally {
      setDeletingProject(false);
    }
  };

  const copyToClipboard = async (value: string, which: 'public' | 'edit') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(which);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setErrorMessage('Clipboard access blocked. Please select and copy the URL manually.');
    }
  };

  const downloadRecoveryKey = () => {
    if (!savedProjectId || !editToken) return;
    const content = [
      `BIRTHDAY MAGIC — PRIVATE EDIT RECOVERY KEY`,
      `==========================================`,
      `Recipient: ${draft.recipientName}`,
      `Project ID: ${savedProjectId}`,
      `Edit Token: ${editToken}`,
      ``,
      `Public Celebration URL (Safe to Share):`,
      publicUrl,
      ``,
      `Private Edit Link (KEEP SECRET — Anyone with this link can edit or delete):`,
      privateEditUrl,
      ``,
      `Expires On: ${new Date(draft.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `birthday-magic-edit-key-${savedProjectId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleAuditionTrack = (trackId: string) => {
    const track = catalog.musicTracks.find((m) => m.id === trackId);
    if (!track) return;
    if (auditionTrackId === trackId) {
      birthdayAudio.stop();
      setAuditionTrackId(null);
    } else {
      birthdayAudio.play(track);
      setAuditionTrackId(trackId);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col bg-[#FAF9F7]">
      {/* Studio Action Toolbar */}
      <div className="border-b border-stone-200 bg-white px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">Birthday Studio</span>
          <span aria-hidden="true">·</span>
          <span>{savedProjectId ? `Project ${savedProjectId}` : 'Unsaved session'}</span>
          {savedProjectId && (
            <>
              <span aria-hidden="true">·</span>
              <span className={draft.status === 'published' ? 'text-emerald-700 font-medium' : 'text-zinc-500'}>
                {draft.status === 'published' ? 'Published' : 'Private Draft'}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 p-1 bg-stone-100 rounded-lg mr-2">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
          </div>

          {savedProjectId && editToken && (
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-800 hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Share & Edit Key
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveOrPublish(false)}
            className="px-3.5 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-zinc-800 hover:bg-stone-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveOrPublish(true)}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {saving ? 'Publishing...' : savedProjectId && draft.status === 'published' ? 'Update Live Page' : 'Publish & Get URL'}
          </button>
        </div>
      </div>

      {/* Inline Feedback Bar */}
      {(errorMessage || statusMessage) && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
            errorMessage
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span>{errorMessage || statusMessage}</span>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setStatusMessage(null);
            }}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Studio Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Control Column */}
        <aside className="lg:col-span-5 xl:col-span-4 border-r border-stone-200 bg-white flex flex-col">
          {/* Segmented Editor Tabs */}
          <div className="p-3 border-b border-stone-200 overflow-x-auto">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg min-w-max">
              {(
                [
                  ['details', 'Details'],
                  ['template', 'Template'],
                  ['photos', `Photos (${draft.photos.length})`],
                  ['wishes', `Wishes (${draft.wishes.length})`],
                  ['motion', 'Music & Motion'],
                ] as [EditorTab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === key ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* TAB 1: DETAILS */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Birthday Person</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={draft.recipientName}
                      onChange={(e) => setDraft((p) => ({ ...p, recipientName: e.target.value }))}
                      placeholder="e.g., Clara Vance"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">From (Sender)</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={draft.senderName}
                      onChange={(e) => setDraft((p) => ({ ...p, senderName: e.target.value }))}
                      placeholder="e.g., Alex & Family"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Turning Age (optional)</label>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={draft.age ?? ''}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          age: e.target.value === '' ? null : Math.max(0, Math.min(150, Number(e.target.value))),
                        }))
                      }
                      placeholder="e.g., 30"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono tabular-nums text-zinc-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Celebration Date</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={draft.eventDate || ''}
                      onChange={(e) => setDraft((p) => ({ ...p, eventDate: e.target.value }))}
                      placeholder="e.g., November 24"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Hero Headline</label>
                  <input
                    type="text"
                    maxLength={140}
                    value={draft.headline}
                    onChange={(e) => setDraft((p) => ({ ...p, headline: e.target.value }))}
                    placeholder="Happy Birthday!"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-rose-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-700">Heartfelt Message</label>
                    <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                      {draft.message.length}/2000
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    maxLength={2000}
                    value={draft.message}
                    onChange={(e) => setDraft((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Write your personal birthday letter..."
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 leading-relaxed focus:outline-none focus:border-rose-600"
                  />
                </div>

                <div className="pt-2 border-t border-stone-200 space-y-3">
                  <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                    <span>Include interactive blow-out candle cake</span>
                    <input
                      type="checkbox"
                      checked={draft.showCake}
                      onChange={(e) => setDraft((p) => ({ ...p, showCake: e.target.checked }))}
                      className="w-4 h-4 accent-rose-600"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-zinc-700 cursor-pointer">
                    <span>Show envelope reveal screen on public link</span>
                    <input
                      type="checkbox"
                      checked={draft.showEnvelopeIntro}
                      onChange={(e) => setDraft((p) => ({ ...p, showEnvelopeIntro: e.target.checked }))}
                      className="w-4 h-4 accent-rose-600"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: TEMPLATE & BACKDROP */}
            {activeTab === 'template' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-zinc-700 mb-2.5">Birthday Template</p>
                  <div className="grid grid-cols-2 gap-3">
                    {catalog.templates.map((tpl) => {
                      const active = draft.templateId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl.id)}
                          className={`text-left rounded-xl overflow-hidden border transition-all cursor-pointer ${
                            active ? 'border-rose-600 ring-2 ring-rose-600/20' : 'border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                            <img
                              src={tpl.previewImage}
                              alt={tpl.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-semibold text-zinc-900 truncate">{tpl.name}</p>
                            <p className="text-[11px] text-zinc-500">{tpl.category}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <p className="text-xs font-medium text-zinc-700">Cover Backdrop</p>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleCoverPhotoUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      {uploadingCover ? 'Uploading...' : 'Upload Custom Cover'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {catalog.backgrounds.map((bg) => {
                      const active = draft.backgroundUrl === bg.imageUrl;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({ ...p, backgroundId: bg.id, backgroundUrl: bg.imageUrl }))
                          }
                          className={`rounded-lg overflow-hidden border text-left cursor-pointer ${
                            active ? 'border-rose-600 ring-2 ring-rose-600/20' : 'border-stone-200'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-stone-100">
                            <img
                              src={bg.imageUrl}
                              alt={bg.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="px-2 py-1 text-[11px] text-zinc-700 truncate">{bg.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-zinc-700 mb-2">Accent Color</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENT_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`Select accent color ${hex}`}
                          onClick={() => setDraft((p) => ({ ...p, accentColor: hex }))}
                          style={{ backgroundColor: hex }}
                          className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                            draft.accentColor === hex ? 'border-zinc-900 scale-110' : 'border-white shadow-xs'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700 mb-2">Typography Style</p>
                    <select
                      value={draft.fontStyle}
                      onChange={(e) => setDraft((p) => ({ ...p, fontStyle: e.target.value as FontStyle }))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-zinc-900 bg-white"
                    >
                      <option value="editorial">Editorial Serif</option>
                      <option value="classic">Classic Italic Serif</option>
                      <option value="modern">Modern Geometric</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PHOTOS */}
            {activeTab === 'photos' && (
              <div className="space-y-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(true);
                  }}
                  onDragLeave={() => setIsDraggingPhoto(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(false);
                    void handlePhotoUpload(e.dataTransfer.files);
                  }}
                  className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
                    isDraggingPhoto
                      ? 'border-rose-600 bg-rose-50/50'
                      : 'border-stone-300 bg-[#FAF9F7]'
                  }`}
                >
                  <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-zinc-900 mb-1">
                    {isDraggingPhoto ? 'Drop photos to upload' : 'Drop photos here or browse'}
                  </p>
                  <p className="text-xs text-zinc-500 mb-4">
                    JPG, PNG, WEBP, AVIF, or GIF · Large phone photos auto-optimized · Up to{' '}
                    {catalog.settings.maxPhotosPerProject} photos
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handlePhotoUpload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingPhoto || draft.photos.length >= catalog.settings.maxPhotosPerProject}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    {uploadingPhoto ? uploadProgress || 'Uploading...' : 'Select Photos'}
                  </button>
                </div>

                {draft.photos.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    No photos attached yet. Uploaded photos appear in the gallery below the cake.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {draft.photos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 bg-[#FAF9F7]"
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || `Photo ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-lg object-cover shrink-0 bg-stone-200"
                        />
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            maxLength={140}
                            value={photo.caption}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraft((prev) => ({
                                ...prev,
                                photos: prev.photos.map((item) =>
                                  item.id === photo.id ? { ...item, caption: val } : item
                                ),
                              }));
                            }}
                            placeholder="Write a photo caption..."
                            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:border-rose-600"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
                            <p className="text-[11px] text-zinc-400 tabular-nums">
                              Photo {idx + 1}
                              {photo.sizeBytes ? ` · ${(photo.sizeBytes / 1024).toFixed(0)} KB` : ''}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setDraft((prev) => ({
                                    ...prev,
                                    backgroundId: 'custom-photo',
                                    backgroundUrl: photo.url,
                                  }));
                                  setStatusMessage(`Photo ${idx + 1} set as hero cover backdrop.`);
                                }}
                                className="text-[11px] text-zinc-600 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                              >
                                Use as Cover
                              </button>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => movePhoto(idx, -1)}
                                aria-label="Move photo up"
                                className="p-0.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === draft.photos.length - 1}
                                onClick={() => movePhoto(idx, 1)}
                                aria-label="Move photo down"
                                className="p-0.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              photos: prev.photos.filter((item) => item.id !== photo.id),
                            }))
                          }
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: WISHES */}
            {activeTab === 'wishes' && (
              <div className="space-y-5">
                <form onSubmit={handleAddWish} className="space-y-3 p-4 rounded-xl border border-stone-200 bg-[#FAF9F7]">
                  <p className="text-xs font-semibold text-zinc-900">Add a Guestbook Wish</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      maxLength={60}
                      value={newWishAuthor}
                      onChange={(e) => setNewWishAuthor(e.target.value)}
                      placeholder="Name (e.g., Maya)"
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-zinc-900"
                    />
                    <input
                      type="text"
                      maxLength={40}
                      value={newWishRelation}
                      onChange={(e) => setNewWishRelation(e.target.value)}
                      placeholder="Relation (e.g., Sister)"
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-zinc-900"
                    />
                  </div>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={newWishText}
                    onChange={(e) => setNewWishText(e.target.value)}
                    placeholder="Write a birthday note from friends or family..."
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-zinc-900"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Wish
                  </button>
                </form>

                <div className="space-y-2.5">
                  {draft.wishes.map((w) => (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-700 leading-relaxed mb-1.5">“{w.text}”</p>
                        <p className="text-[11px] text-zinc-500">
                          {w.author} · {w.relationship}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove wish"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            wishes: prev.wishes.filter((item) => item.id !== w.id),
                          }))
                        }
                        className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: MUSIC & MOTION */}
            {activeTab === 'motion' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-medium text-zinc-700">
                      2D Greeting Card Animation ({catalog.animationPresets.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setTriggerSignal((n) => n + 1)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Test 2D Effect
                    </button>
                  </div>
                  <div className="space-y-2">
                    {catalog.animationPresets.map((preset) => {
                      const active = draft.animationPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setDraft((p) => ({ ...p, animationPresetId: preset.id }));
                            setTriggerSignal((n) => n + 1);
                          }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                            active
                              ? 'border-rose-600 bg-rose-50/40'
                              : 'border-stone-200 bg-white hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-semibold text-zinc-900">{preset.name}</span>
                            <span className="text-zinc-500 capitalize">
                              {preset.effectType} · {preset.intensity}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-600">{preset.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-700 mb-2.5">Background Music</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        birthdayAudio.stop();
                        setAuditionTrackId(null);
                        setDraft((p) => ({ ...p, musicId: '', musicUrl: '' }));
                      }}
                      className={`w-full text-left p-3 rounded-xl border text-xs cursor-pointer ${
                        !draft.musicId ? 'border-rose-600 bg-rose-50/40 font-semibold' : 'border-stone-200'
                      }`}
                    >
                      No background music
                    </button>

                    {catalog.musicTracks.map((track) => {
                      const selected = draft.musicId === track.id;
                      const playing = auditionTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                            selected ? 'border-rose-600 bg-rose-50/40' : 'border-stone-200 bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                musicId: track.id,
                                musicUrl: track.audioUrl || '',
                              }))
                            }
                            className="flex-1 text-left min-w-0 cursor-pointer"
                          >
                            <p className="text-xs font-semibold text-zinc-900 truncate">{track.title}</p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {track.artist} · {track.durationLabel}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAuditionTrack(track.id)}
                            aria-label={playing ? 'Pause preview' : 'Play preview'}
                            className="p-2 rounded-lg border border-stone-200 bg-white text-zinc-800 hover:bg-stone-100 shrink-0 cursor-pointer"
                          >
                            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Live Interactive Preview Stage */}
        <section className="lg:col-span-7 xl:col-span-8 bg-stone-100 p-4 sm:p-6 overflow-y-auto flex justify-center">
          <div
            className={`w-full transition-all duration-200 ${
              previewDevice === 'mobile'
                ? 'max-w-[400px] rounded-2xl overflow-hidden border border-stone-300 shadow-sm bg-white self-start'
                : 'max-w-5xl rounded-2xl overflow-hidden border border-stone-300 bg-white self-start'
            }`}
          >
            <BirthdayCanvas
              project={draft}
              template={activeTemplate}
              animationPreset={activeAnimation}
              musicTrack={activeMusic}
              isPreview
              triggerSignal={triggerSignal}
            />
          </div>
        </section>
      </div>

      {/* Share Public URL & Private Edit Key Modal */}
      {shareModalOpen && savedProjectId && editToken && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="max-w-xl w-full bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">
                  {draft.status === 'published' ? 'Live Birthday Page' : 'Saved Draft'} · Expires{' '}
                  {new Date(draft.expiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <h2 className="font-display text-2xl font-semibold text-zinc-900">
                  Share & Private Edit Access
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                aria-label="Close share dialog"
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Public Share Link (NEVER contains Edit Token) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900">
                  Public Celebration URL (Safe to share with guests)
                </label>
                <span className="text-[11px] text-zinc-500">
                  {draft.status === 'published' ? 'Publicly accessible' : 'Currently unpublished draft'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-mono text-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicUrl, 'public')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'public' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'public' ? 'Copied' : 'Copy'}
                </button>
                {draft.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShareModalOpen(false);
                      onNavigate(`/b/${savedProjectId}`);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </button>
                )}
              </div>
            </div>

            {/* Private Edit Link (Secret!) */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3">
              <div>
                <p className="text-xs font-semibold text-amber-950">
                  Private Edit Link (Keep secret — never share with guests)
                </p>
                <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">
                  Because Birthday Magic requires no login, this private edit token is your only key to edit, rotate
                  access, or delete this page later.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={privateEditUrl}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono text-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(privateEditUrl, 'edit')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-950 text-xs font-semibold hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'edit' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'edit' ? 'Copied' : 'Copy Key'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadRecoveryKey}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Edit-Link File (.txt)
                </button>
                <button
                  type="button"
                  disabled={rotatingToken}
                  onClick={handleRotateToken}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-white text-zinc-800 text-xs font-medium hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotatingToken ? 'animate-spin' : ''}`} />
                  Revoke & Rotate Token
                </button>
              </div>
            </div>

            {/* Publish Toggle & Permanent Delete */}
            <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleTogglePublishInModal}
                className="px-3.5 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-800 hover:bg-stone-100 cursor-pointer"
              >
                {draft.status === 'published' ? 'Unpublish to Draft' : 'Publish Live Now'}
              </button>

              <button
                type="button"
                disabled={deletingProject}
                onClick={handleDeleteProject}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingProject ? 'Deleting...' : 'Delete Page Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
