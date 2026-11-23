import React, { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { BuilderStudio } from './components/BuilderStudio';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingView } from './components/LandingView';
import { PublicBirthdayPage } from './components/PublicBirthdayPage';
import { RecoverProjectView } from './components/RecoverProjectView';
import { fetchPublicCatalog, verifyEditToken } from './services/api';
import type { BirthdayProject, PublicCatalog } from './types/birthday';

type RouteMatch =
  | { kind: 'home' }
  | { kind: 'studio' }
  | { kind: 'recover' }
  | { kind: 'admin' }
  | { kind: 'public'; projectId: string }
  | { kind: 'edit'; projectId: string; token: string };

function parseLocation(): RouteMatch {
  const pathname = window.location.pathname || '/';
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  if (pathname.startsWith('/admin')) {
    return { kind: 'admin' };
  }
  if (pathname.startsWith('/recover')) {
    return { kind: 'recover' };
  }
  if (pathname.startsWith('/studio')) {
    return { kind: 'studio' };
  }

  const publicMatch = pathname.match(/^\/b\/([a-zA-Z0-9_-]+)/);
  if (publicMatch?.[1]) {
    return { kind: 'public', projectId: publicMatch[1] };
  }

  const editMatch = pathname.match(/^\/edit\/([a-zA-Z0-9_-]+)/);
  if (editMatch?.[1]) {
    const token = (hashParams.get('token') || queryParams.get('token') || '').trim();
    return { kind: 'edit', projectId: editMatch[1], token };
  }

  return { kind: 'home' };
}

function AppContent() {
  const [route, setRoute] = useState<RouteMatch>(() => parseLocation());
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [editingProject, setEditingProject] = useState<BirthdayProject | null>(null);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchPublicCatalog();
      setCatalog(data);
      setCatalogError(null);
      if (data.settings.siteName) {
        document.title = `${data.settings.siteName} — Public Birthday Website Builder`;
      }
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Unable to reach Birthday Magic server.');
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const handlePop = () => {
      setRoute(parseLocation());
    };
    window.addEventListener('popstate', handlePop);
    window.addEventListener('hashchange', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('hashchange', handlePop);
    };
  }, []);

  // Load project automatically when opening a /edit/:projectId#token=... link
  useEffect(() => {
    if (route.kind !== 'edit') return;
    if (editingProject?.id === route.projectId && editingToken === route.token) return;

    if (!route.token) {
      setEditLoadError('Missing private edit token in this link. Use Recover Link to enter your token.');
      return;
    }

    let active = true;
    setLoadingEdit(true);
    setEditLoadError(null);
    verifyEditToken(route.projectId, route.token)
      .then((res) => {
        if (active) {
          setEditingProject(res.project);
          setEditingToken(route.token);
        }
      })
      .catch((err) => {
        if (active) {
          setEditLoadError(err instanceof Error ? err.message : 'Invalid or revoked edit link.');
        }
      })
      .finally(() => {
        if (active) setLoadingEdit(false);
      });

    return () => {
      active = false;
    };
  }, [route, editingProject?.id, editingToken]);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseLocation());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const handleStartBuilding = (templateId?: string) => {
    setSelectedTemplateId(templateId);
    setEditingProject(null);
    setEditingToken(null);
    setEditLoadError(null);
    navigate('/studio');
  };

  if (route.kind === 'admin') {
    return <AdminDashboard onNavigate={navigate} onCatalogUpdated={() => void loadCatalog()} />;
  }

  if (!catalog) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          {catalogError ? (
            <>
              <p className="text-sm font-medium text-rose-700 mb-3">{catalogError}</p>
              <button
                type="button"
                onClick={() => void loadCatalog()}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Loading Birthday Magic Studio...</p>
          )}
        </div>
      </div>
    );
  }

  if (route.kind === 'public') {
    return <PublicBirthdayPage projectId={route.projectId} catalog={catalog} onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-zinc-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-display text-xl font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {catalog.settings.siteName || 'Birthday Magic'}
          </button>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => {
                if (route.kind !== 'home') {
                  navigate('/');
                }
                window.setTimeout(() => {
                  document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' });
                }, 60);
              }}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => handleStartBuilding()}
              className={`hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.kind === 'studio' || route.kind === 'edit' ? 'text-zinc-900 underline underline-offset-8' : ''
              }`}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => navigate('/recover')}
              className={`hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route.kind === 'recover' ? 'text-zinc-900 underline underline-offset-8' : ''
              }`}
            >
              Recover Link
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin
            </button>
          </nav>

          {/* Zone 3: 1 Primary CTA Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => handleStartBuilding()}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Page
            </button>
          </div>
        </div>
      </header>

      {/* Routed Public Views */}
      <div className="flex-1">
        {route.kind === 'home' && (
          <LandingView catalog={catalog} onStartBuilding={handleStartBuilding} onNavigate={navigate} />
        )}

        {route.kind === 'studio' && (
          <BuilderStudio
            catalog={catalog}
            initialTemplateId={selectedTemplateId}
            onNavigate={navigate}
            onProjectDeleted={() => navigate('/')}
          />
        )}

        {route.kind === 'edit' && (
          <>
            {loadingEdit ? (
              <div className="py-24 text-center text-xs text-zinc-500">Verifying private edit token...</div>
            ) : editLoadError ? (
              <div className="max-w-md mx-auto my-20 bg-white border border-stone-200 rounded-xl p-8 text-center">
                <h1 className="font-display text-2xl font-semibold text-zinc-900 mb-2">Edit Link Invalid</h1>
                <p className="text-xs text-zinc-600 mb-6">{editLoadError}</p>
                <button
                  type="button"
                  onClick={() => navigate('/recover')}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Open Recovery Page
                </button>
              </div>
            ) : (
              <BuilderStudio
                catalog={catalog}
                editingProject={editingProject}
                editingToken={editingToken}
                onNavigate={navigate}
                onProjectDeleted={() => {
                  setEditingProject(null);
                  setEditingToken(null);
                  navigate('/');
                }}
              />
            )}
          </>
        )}

        {route.kind === 'recover' && (
          <RecoverProjectView
            onRecovered={(proj, token) => {
              setEditingProject(proj);
              setEditingToken(token);
              setEditLoadError(null);
              navigate(`/edit/${proj.id}#token=${token}`);
            }}
            onNavigate={navigate}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
