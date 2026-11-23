import { ArrowRight, ExternalLink } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { PublicCatalog } from '../types/birthday';

interface LandingViewProps {
  catalog: PublicCatalog;
  onStartBuilding: (templateId?: string) => void;
  onNavigate: (path: string) => void;
}

const HERO_IMAGE = '/src/assets/images/hero_birthday_editorial_1795407298468.jpg';

export const LandingView: React.FC<LandingViewProps> = ({ catalog, onStartBuilding, onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const tpl of catalog.templates) {
      if (tpl.category) set.add(tpl.category);
    }
    return Array.from(set);
  }, [catalog.templates]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'All') return catalog.templates;
    return catalog.templates.filter((t) => t.category === selectedCategory);
  }, [catalog.templates, selectedCategory]);

  return (
    <main>
      {/* Editorial Hero Split */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-4">
              <span>No account required</span>
              <span aria-hidden="true">·</span>
              <span>Private edit key</span>
              <span aria-hidden="true">·</span>
              <span>Instant shareable URL</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight text-zinc-900 leading-[1.08] text-balance">
              {catalog.settings.heroHeadline || 'Craft a memorable birthday website without creating an account.'}
            </h1>

            <p className="mt-5 text-base text-zinc-600 leading-relaxed max-w-xl">
              {catalog.settings.tagline ||
                'Choose an editorial template, upload favorite photos, compose wishes with music and interactive candles, then share one private link with everyone celebrating.'}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onStartBuilding()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Create Birthday Page
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/b/showcase-clara-30')}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-lg border border-stone-300 text-zinc-800 text-sm font-medium hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                View Live Example
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-10 pt-6 border-t border-stone-200 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums">0</p>
                <p className="text-xs text-zinc-500 mt-0.5">Sign-up steps</p>
              </div>
              <div>
                <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums">
                  {catalog.settings.projectExpirationDays}d
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Link retention</p>
              </div>
              <div>
                <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums">
                  {catalog.settings.maxPhotosPerProject}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Photos per page</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[340px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
              {!heroImgFailed ? (
                <img
                  src={HERO_IMAGE}
                  alt="Artisan birthday table with lit beeswax candles and garden roses"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-200 text-zinc-600 text-sm">
                  Birthday Magic Editorial Studio
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                <div>
                  <p className="text-xs text-stone-200">Featured Celebration · 30th Milestone</p>
                  <p className="font-display text-xl font-semibold">Clara Vance — Candlelight Edition</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/b/showcase-clara-30')}
                  className="px-3.5 py-2 rounded-lg bg-white/95 text-zinc-900 text-xs font-semibold hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Card
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Templates Catalog */}
      <section id="templates" className="border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-2">Curated Templates</p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-900 text-balance">
                Start with a thoughtfully composed canvas
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg self-start max-w-full overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredTemplates.map((tpl) => (
              <article
                key={tpl.id}
                className="group flex flex-col rounded-xl border border-stone-200 bg-[#FAF9F7] overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
                  <img
                    src={tpl.previewImage}
                    alt={`${tpl.name} birthday template`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                    <span>{tpl.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tpl.themeMode === 'dark' ? 'Evening palette' : 'Daylight palette'}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-zinc-900 mb-2">{tpl.name}</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed flex-1 mb-5">{tpl.description}</p>
                  <button
                    type="button"
                    onClick={() => onStartBuilding(tpl.id)}
                    className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Use Template
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Editorial 3-Step Architecture */}
      <section className="border-t border-stone-200 bg-[#FAF9F7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-medium text-zinc-500 mb-2">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-900 text-balance">
              Private edit control without accounts or passwords
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-stone-200 pt-10">
            <div>
              <h3 className="font-display text-xl font-semibold text-zinc-900 mb-2">
                01. Compose & Animate
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Pick a template, upload photos, write wishes from friends, choose candlelight music, and preview every
                interactive candle blow-out in real time.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-zinc-900 mb-2">
                02. Publish One Clean Link
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Publish immediately to receive a randomly generated public celebration URL. Guests open it directly—no
                login walls and no exposed edit credentials.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-zinc-900 mb-2">
                03. Keep Your Edit Key
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Download your private recovery key file to edit photos later, rotate your token if needed, or remove
                your page at any time before automatic expiration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <p>{catalog.settings.footerNote || `${catalog.settings.siteName} · Public no-login birthday studio.`}</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onStartBuilding()}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Builder Studio
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/recover')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Recover Edit Link
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Administrator
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
};
