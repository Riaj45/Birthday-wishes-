import { AlertTriangle, CheckCircle2, Flag, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { fetchPublicBirthdayPage, submitContentReport } from '../services/api';
import type { BirthdayProject, PublicCatalog, ReportReason } from '../types/birthday';
import { BirthdayCanvas } from './BirthdayCanvas';

interface PublicBirthdayPageProps {
  projectId: string;
  catalog: PublicCatalog;
  onNavigate: (path: string) => void;
}

export const PublicBirthdayPage: React.FC<PublicBirthdayPageProps> = ({ projectId, catalog, onNavigate }) => {
  const [project, setProject] = useState<BirthdayProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPublicBirthdayPage(projectId)
      .then((res) => {
        if (active) setProject(res.project);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load this birthday page.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setReportSubmitting(true);
    setReportErr(null);
    try {
      await submitContentReport(project.id, reportReason, reportDetails);
      setReportDone(true);
      setReportDetails('');
    } catch (err) {
      setReportErr(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-rose-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-600">Opening celebration page...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <h1 className="font-display text-2xl font-semibold text-zinc-900 mb-2">
            Birthday Page Unavailable
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            {error || 'This birthday page may have expired, been unpublished, or removed by its creator.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Visit {catalog.settings.siteName}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/studio')}
              className="px-4 py-2.5 rounded-lg border border-stone-300 text-zinc-800 text-xs font-semibold hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Create New Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const template = catalog.templates.find((t) => t.id === project.templateId) || catalog.templates[0];
  const animationPreset =
    catalog.animationPresets.find((a) => a.id === project.animationPresetId) || catalog.animationPresets[0];
  const musicTrack = catalog.musicTracks.find((m) => m.id === project.musicId);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <BirthdayCanvas
          project={project}
          template={template}
          animationPreset={animationPreset}
          musicTrack={musicTrack}
        />
      </div>

      {/* Quiet Public Footer Bar with Report Content Action */}
      <footer className="border-t border-stone-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Made with {catalog.settings.siteName}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('/studio')}
              className="text-zinc-900 font-medium underline underline-offset-4 hover:text-rose-600 cursor-pointer"
            >
              Create your own free page
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setReportDone(false);
              setReportErr(null);
              setReportOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            Report content
          </button>
        </div>
      </footer>

      {/* Report Inappropriate Content Modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          onClick={() => setReportOpen(false)}
        >
          <div
            className="max-w-md w-full bg-white rounded-xl border border-stone-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-zinc-900">Report Birthday Page</h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Close report dialog"
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportDone ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-zinc-900 mb-1">Report submitted for review</p>
                <p className="text-xs text-zinc-600 mb-5">
                  Thank you. Our administrator will inspect this page and take action if needed.
                </p>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value as ReportReason)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
                  >
                    <option value="inappropriate">Inappropriate or explicit content</option>
                    <option value="harassment">Harassment or abusive language</option>
                    <option value="spam">Spam or misleading links</option>
                    <option value="copyright">Copyright or unauthorized photo</option>
                    <option value="other">Other safety concern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Additional details (optional)</label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe what should be reviewed..."
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
                  />
                </div>
                {reportErr && <p className="text-xs text-rose-600">{reportErr}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-medium text-zinc-700 hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
