import { ArrowRight, FileKey2, KeyRound, Trash2, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { deleteBirthdayProjectByToken, verifyEditToken } from '../services/api';
import type { BirthdayProject } from '../types/birthday';

interface RecoverProjectViewProps {
  onRecovered: (project: BirthdayProject, editToken: string) => void;
  onNavigate: (path: string) => void;
}

function parseEditInput(raw: string): { projectId: string; editToken: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try parsing full URL like https://.../edit/<id>#token=<tok> or ?token=<tok>
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/edit\/([a-zA-Z0-9_-]+)/);
    const hashToken = new URLSearchParams(url.hash.replace(/^#/, '')).get('token');
    const queryToken = url.searchParams.get('token');
    if (match?.[1] && (hashToken || queryToken)) {
      return { projectId: match[1], editToken: (hashToken || queryToken || '').trim() };
    }
  } catch {
    // Not a URL; try key-file text parsing
  }

  const idMatch = trimmed.match(/Project ID:\s*([a-zA-Z0-9_-]+)/i);
  const tokMatch = trimmed.match(/Edit Token:\s*([a-zA-Z0-9_-]+)/i);
  if (idMatch?.[1] && tokMatch?.[1]) {
    return { projectId: idMatch[1].trim(), editToken: tokMatch[1].trim() };
  }

  return null;
}

export const RecoverProjectView: React.FC<RecoverProjectViewProps> = ({ onRecovered, onNavigate }) => {
  const [editLinkText, setEditLinkText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [editToken, setEditToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedSuccess, setDeletedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolveCredentials = (): { id: string; token: string } | null => {
    if (projectId.trim() && editToken.trim()) {
      return { id: projectId.trim(), token: editToken.trim() };
    }
    const parsed = parseEditInput(editLinkText);
    if (parsed) {
      return { id: parsed.projectId, token: parsed.editToken };
    }
    return null;
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseEditInput(text);
    if (parsed) {
      setProjectId(parsed.projectId);
      setEditToken(parsed.editToken);
      setEditLinkText(`${window.location.origin}/edit/${parsed.projectId}#token=${parsed.editToken}`);
      setError(null);
    } else {
      setError('Could not find a valid Project ID and Edit Token in that file.');
    }
  };

  const handleOpenEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeletedSuccess(false);
    const creds = resolveCredentials();
    if (!creds) {
      setError('Paste your full Private Edit Link, upload your .txt key file, or enter both Project ID and Edit Token.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEditToken(creds.id, creds.token);
      onRecovered(res.project, creds.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify edit key.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDirectly = async () => {
    setError(null);
    const creds = resolveCredentials();
    if (!creds) {
      setError('Provide your Private Edit Link or Project ID + Edit Token first.');
      return;
    }
    setLoading(true);
    try {
      await deleteBirthdayProjectByToken(creds.id, creds.token);
      setDeletedSuccess(true);
      setEditLinkText('');
      setProjectId('');
      setEditToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24">
      <div className="mb-8">
        <p className="text-xs font-medium text-zinc-500 mb-2">No-Login Access Recovery</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-900 text-balance mb-3">
          Recover or delete your birthday page
        </h1>
        <p className="text-sm text-zinc-600 leading-relaxed">
          Paste the Private Edit Link you saved when creating your page, or upload your downloaded recovery key file to
          reopen the studio or permanently remove the page.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
        {/* Upload .txt key file */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FAF9F7] border border-stone-200">
          <div className="flex items-center gap-3">
            <FileKey2 className="w-5 h-5 text-zinc-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-zinc-900">Have your downloaded edit-key file?</p>
              <p className="text-[11px] text-zinc-500">Load your `.txt` recovery file automatically.</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-zinc-800 hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Load Key File
          </button>
        </div>

        <form onSubmit={handleOpenEditor} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Paste Private Edit Link</label>
            <input
              type="text"
              value={editLinkText}
              onChange={(e) => {
                setEditLinkText(e.target.value);
                const parsed = parseEditInput(e.target.value);
                if (parsed) {
                  setProjectId(parsed.projectId);
                  setEditToken(parsed.editToken);
                }
              }}
              placeholder="https://.../edit/projectId#token=..."
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-xs font-mono text-zinc-900 focus:outline-none focus:border-rose-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Project ID</label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g., x8K2pL9q"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:border-rose-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Private Edit Token</label>
              <input
                type="password"
                value={editToken}
                onChange={(e) => setEditToken(e.target.value)}
                placeholder="Paste secret token"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:border-rose-600"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          {deletedSuccess && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Project and its uploaded media have been permanently deleted.
            </p>
          )}

          <div className="pt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleDeleteDirectly}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Project
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {loading ? 'Verifying...' : 'Unlock & Edit Page'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onNavigate('/studio')}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4 cursor-pointer"
        >
          Or start a brand-new birthday page
        </button>
      </div>
    </main>
  );
};
