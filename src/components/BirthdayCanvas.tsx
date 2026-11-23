import confetti from 'canvas-confetti';
import { Flame, Music, Pause, Play, Sparkles, Volume2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnimationPreset,
  BirthdayPhoto,
  BirthdayProject,
  BirthdayTemplate,
  MusicTrack,
} from '../types/birthday';
import { birthdayAudio } from '../utils/audioEngine';

interface BirthdayCanvasProps {
  project: BirthdayProject;
  template?: BirthdayTemplate;
  animationPreset?: AnimationPreset;
  musicTrack?: MusicTrack;
  isPreview?: boolean;
  triggerSignal?: number;
}

const PARTICLE_SEEDS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: ((i * 37 + 11) % 94) + 3,
  top: ((i * 29 + 7) % 86) + 5,
  size: 5 + (i % 5) * 2.5,
  delay: (i * 0.45) % 6,
  duration: 6 + (i % 6) * 1.6,
}));

export const BirthdayCanvas: React.FC<BirthdayCanvasProps> = ({
  project,
  template,
  animationPreset,
  musicTrack,
  isPreview = false,
  triggerSignal = 0,
}) => {
  const [envelopeOpen, setEnvelopeOpen] = useState(isPreview || !project.showEnvelopeIntro);
  const [litCandles, setLitCandles] = useState<boolean[]>([true, true, true, true, true]);
  const [wishGranted, setWishGranted] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<BirthdayPhoto | null>(null);
  const [bgFailed, setBgFailed] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  const isDark = template?.themeMode === 'dark';
  const accent = project.accentColor || template?.accentColor || '#E11D48';
  const effectType = animationPreset?.effectType || 'confetti';
  const intensity = animationPreset?.intensity || 'balanced';

  const particleCount = intensity === 'festive' ? 22 : intensity === 'balanced' ? 14 : 9;

  const headlineFontClass = useMemo(() => {
    if (project.fontStyle === 'modern') return 'font-sans tracking-tight';
    if (project.fontStyle === 'classic') return 'font-display italic';
    return 'font-display';
  }, [project.fontStyle]);

  useEffect(() => {
    setBgFailed(false);
  }, [project.backgroundUrl]);

  useEffect(() => {
    if (isPreview) {
      setEnvelopeOpen(true);
    } else {
      setEnvelopeOpen(!project.showEnvelopeIntro);
    }
  }, [isPreview, project.showEnvelopeIntro, project.id]);

  useEffect(() => {
    return () => {
      if (!isPreview) {
        birthdayAudio.stop();
      }
    };
  }, [isPreview]);

  const fireCelebrationBurst = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const count = intensity === 'festive' ? 90 : intensity === 'balanced' ? 55 : 30;
    const palette = [accent, '#F59E0B', '#FDE68A', '#FB7185', '#FFFFFF'];

    if (effectType === 'fireworks') {
      const originX = 0.25 + Math.random() * 0.5;
      const originY = 0.25 + Math.random() * 0.25;
      void confetti({
        particleCount: count,
        spread: 360,
        startVelocity: 26,
        ticks: 70,
        origin: { x: originX, y: originY },
        colors: palette,
      });
      window.setTimeout(() => {
        void confetti({
          particleCount: Math.round(count * 0.7),
          spread: 360,
          startVelocity: 22,
          origin: { x: 1 - originX, y: 0.3 },
          colors: palette,
        });
      }, 280);
      return;
    }

    void confetti({
      particleCount: count,
      spread: 74,
      origin: { y: 0.62 },
      colors: palette,
    });
  }, [accent, effectType, intensity]);

  useEffect(() => {
    if (triggerSignal > 0) {
      fireCelebrationBurst();
    }
  }, [triggerSignal, fireCelebrationBurst]);

  const toggleMusic = useCallback(() => {
    if (!musicTrack) return;
    if (musicPlaying) {
      birthdayAudio.stop();
      setMusicPlaying(false);
    } else {
      birthdayAudio.play(musicTrack);
      setMusicPlaying(true);
    }
  }, [musicPlaying, musicTrack]);

  const handleOpenEnvelope = () => {
    setEnvelopeOpen(true);
    fireCelebrationBurst();
    if (musicTrack && !musicPlaying) {
      birthdayAudio.play(musicTrack);
      setMusicPlaying(true);
    }
  };

  const blowCandle = (idx: number) => {
    setLitCandles((prev) => {
      const next = prev.map((lit, i) => (i === idx ? false : lit));
      if (next.every((v) => !v)) {
        setWishGranted(true);
        fireCelebrationBurst();
      }
      return next;
    });
  };

  const blowAllCandles = () => {
    setLitCandles([false, false, false, false, false]);
    setWishGranted(true);
    fireCelebrationBurst();
  };

  const relightCandles = () => {
    setLitCandles([true, true, true, true, true]);
    setWishGranted(false);
  };

  const bgImage = project.backgroundUrl || template?.previewImage || '';
  const allCandlesOut = litCandles.every((c) => !c);

  // Envelope Intro Gate (Live Page)
  if (!envelopeOpen) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-zinc-950 text-white p-6">
        {bgImage && !bgFailed && (
          <img
            src={bgImage}
            alt="Celebration backdrop"
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-45 scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/45" />
        <div className="relative z-10 max-w-md w-full bg-[#FAF9F7] text-zinc-900 rounded-xl border border-stone-200 p-10 text-center">
          <p className="text-xs font-medium text-zinc-500 mb-3">
            A Birthday Invitation {project.eventDate ? `· ${project.eventDate}` : ''}
          </p>
          <h1 className={`${headlineFontClass} text-3xl sm:text-4xl font-semibold text-zinc-900 text-balance mb-3`}>
            For {project.recipientName}
          </h1>
          <p className="text-sm text-zinc-600 mb-8 leading-relaxed">
            Prepared with love by {project.senderName}. Open to reveal your interactive card, memories, and music.
          </p>
          <button
            type="button"
            onClick={handleOpenEnvelope}
            style={{ backgroundColor: accent }}
            className="w-full py-3.5 px-6 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-92 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 cursor-pointer"
          >
            Open Birthday Card
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasHostRef}
      className={`relative w-full overflow-hidden ${isPreview ? 'min-h-[680px]' : 'min-h-screen'} ${
        isDark ? 'bg-[#121318] text-stone-100' : 'bg-[#FAF9F7] text-zinc-900'
      }`}
    >
      {/* Ambient Animated Particles Layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10" aria-hidden="true">
        {effectType === 'embers' &&
          PARTICLE_SEEDS.slice(0, particleCount).map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full animate-float-up"
              style={{
                left: `${p.left}%`,
                bottom: '-12px',
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.id % 2 === 0 ? '#F59E0B' : '#FDE68A',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                boxShadow: '0 0 12px rgba(245, 158, 11, 0.75)',
              }}
            />
          ))}

        {effectType === 'petals' &&
          PARTICLE_SEEDS.slice(0, particleCount).map((p) => (
            <span
              key={p.id}
              className="absolute animate-drift-down"
              style={{
                left: `${p.left}%`,
                top: '-18px',
                width: `${p.size + 4}px`,
                height: `${p.size}px`,
                borderRadius: '60% 40% 60% 40%',
                backgroundColor: p.id % 3 === 0 ? accent : p.id % 2 === 0 ? '#FBCFE8' : '#FDE68A',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration + 1.5}s`,
              }}
            />
          ))}

        {effectType === 'starlight' &&
          PARTICLE_SEEDS.slice(0, particleCount).map((p) => (
            <span
              key={p.id}
              className="absolute rounded-full animate-twinkle"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${Math.max(3, p.size * 0.55)}px`,
                height: `${Math.max(3, p.size * 0.55)}px`,
                backgroundColor: p.id % 2 === 0 ? '#FEF3C7' : accent,
                animationDelay: `${p.delay * 0.7}s`,
                animationDuration: `${2.2 + (p.id % 4)}s`,
              }}
            />
          ))}
      </div>

      {/* Hero Cover Section */}
      <section className="relative min-h-[460px] sm:min-h-[540px] flex items-end overflow-hidden">
        {bgImage && !bgFailed ? (
          <img
            src={bgImage}
            alt={`${project.recipientName} birthday cover`}
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'radial-gradient(circle at 30% 25%, #2B2438 0%, #111318 75%)'
                : 'radial-gradient(circle at 30% 25%, #F3ECE2 0%, #E7DDD0 75%)',
            }}
          />
        )}
        {/* Measured contrast scrim (4.5:1+ guarantee over photography) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />

        {/* Floating Music & Burst Controls */}
        <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={fireCelebrationBurst}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/55 backdrop-blur-sm text-white text-xs font-medium border border-white/15 hover:bg-black/75 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Celebrate
          </button>
          {musicTrack && (
            <button
              type="button"
              onClick={toggleMusic}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/55 backdrop-blur-sm text-white text-xs font-medium border border-white/15 hover:bg-black/75 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {musicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="max-w-[130px] truncate">{musicTrack.title}</span>
            </button>
          )}
        </div>

        <div className="relative z-20 w-full max-w-4xl mx-auto px-6 sm:px-10 py-12 sm:py-16 text-white">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-200 mb-3">
            <span>Celebrating {project.recipientName}</span>
            {project.age ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Turning {project.age}</span>
              </>
            ) : null}
            {project.eventDate ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{project.eventDate}</span>
              </>
            ) : null}
          </div>
          <h1
            className={`${headlineFontClass} text-3xl sm:text-5xl font-semibold tracking-tight text-white text-balance leading-[1.12] max-w-2xl`}
          >
            {project.headline || `Happy Birthday, ${project.recipientName}`}
          </h1>
          <p className="mt-4 text-sm sm:text-base text-stone-200 max-w-xl leading-relaxed">
            With warm wishes from {project.senderName}
          </p>
        </div>
      </section>

      {/* Main Letter + Interactive Candle Cake */}
      <div className="relative z-20 max-w-4xl mx-auto px-6 sm:px-10 py-12 sm:py-16 space-y-16">
        {/* Heartfelt Message */}
        <section className="max-w-2xl">
          <p className={`text-xs font-medium mb-3 ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
            Personal Note
          </p>
          <p
            className={`text-lg sm:text-xl leading-relaxed whitespace-pre-line ${
              isDark ? 'text-stone-100' : 'text-zinc-800'
            }`}
          >
            {project.message}
          </p>
          <p
            className={`${headlineFontClass} mt-6 text-lg font-medium ${
              isDark ? 'text-amber-300' : 'text-zinc-900'
            }`}
          >
            — {project.senderName}
          </p>
        </section>

        {/* Interactive Birthday Cake with Blow-Out Candles */}
        {project.showCake && (
          <section
            className={`rounded-xl border p-8 sm:p-10 ${
              isDark ? 'bg-[#191B22] border-white/10' : 'bg-white border-stone-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
                  Interactive Tradition
                </p>
                <h2 className={`${headlineFontClass} text-2xl font-semibold`}>
                  {wishGranted ? `Wish made for ${project.recipientName}` : 'Tap each flame or blow out the candles'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {!allCandlesOut ? (
                  <button
                    type="button"
                    onClick={blowAllCandles}
                    style={{ backgroundColor: accent }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Blow Out All Candles
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={relightCandles}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isDark
                        ? 'border-white/20 text-stone-100 hover:bg-white/10'
                        : 'border-stone-300 text-zinc-900 hover:bg-stone-100'
                    }`}
                  >
                    Relight Candles
                  </button>
                )}
              </div>
            </div>

            {/* Minimalist Editorial Cake Illustration */}
            <div className="flex flex-col items-center py-4">
              <div className="flex items-end justify-center gap-5 sm:gap-7 mb-1">
                {litCandles.map((lit, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => blowCandle(idx)}
                    aria-label={lit ? `Blow out candle ${idx + 1}` : `Candle ${idx + 1} blown out`}
                    className="group flex flex-col items-center focus-visible:outline-2 focus-visible:outline-amber-500 rounded cursor-pointer"
                  >
                    <div className="h-9 flex items-end justify-center mb-1">
                      {lit ? (
                        <div className="relative flex items-center justify-center animate-candle-flicker">
                          <span className="w-4 h-6 rounded-full bg-amber-400/35 blur-[3px] absolute" />
                          <Flame className="w-5 h-6 text-amber-400 fill-amber-300 relative z-10" />
                        </div>
                      ) : (
                        <span className="w-1.5 h-5 rounded-full bg-stone-400/50 animate-smoke-rise" />
                      )}
                    </div>
                    <div
                      className="w-3 h-14 rounded-t-sm transition-transform group-hover:-translate-y-0.5"
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#F3E8D2' : accent,
                        opacity: lit ? 1 : 0.72,
                      }}
                    />
                  </button>
                ))}
              </div>
              {/* Cake Frosting & Tier */}
              <div className="w-64 sm:w-80 h-6 rounded-t-xl bg-[#F5EFE6] border-b border-stone-200/80" />
              <div
                className="w-64 sm:w-80 h-20 rounded-b-lg flex items-center justify-center border-x border-b"
                style={{
                  backgroundColor: isDark ? '#262936' : '#F3EDE3',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5DDD0',
                }}
              >
                <span
                  className={`${headlineFontClass} text-sm tracking-wide ${
                    isDark ? 'text-stone-300' : 'text-zinc-700'
                  }`}
                >
                  {project.age ? `Happy ${project.age}th, ${project.recipientName}` : `Happy Birthday, ${project.recipientName}`}
                </span>
              </div>
              <div className={`w-72 sm:w-96 h-2.5 rounded-full mt-1 ${isDark ? 'bg-stone-700' : 'bg-stone-300'}`} />
            </div>
          </section>
        )}

        {/* Photo Memories Gallery */}
        {project.photos.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
                  Photo Keepsakes
                </p>
                <h2 className={`${headlineFontClass} text-2xl font-semibold`}>Shared Memories</h2>
              </div>
              <span className={`text-xs tabular-nums ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
                {project.photos.length} {project.photos.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {project.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxPhoto(photo)}
                  className={`group text-left rounded-xl overflow-hidden border transition-transform hover:-translate-y-0.5 cursor-pointer ${
                    isDark ? 'bg-[#191B22] border-white/10' : 'bg-white border-stone-200'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-stone-800/10">
                    <img
                      src={photo.url}
                      alt={photo.caption || `Memory with ${project.recipientName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                    />
                  </div>
                  {photo.caption && (
                    <p className={`px-4 py-3 text-xs leading-relaxed ${isDark ? 'text-stone-300' : 'text-zinc-600'}`}>
                      {photo.caption}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Wishes from Friends & Family */}
        {project.wishes.length > 0 && (
          <section>
            <div className="mb-6">
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
                Guestbook Notes
              </p>
              <h2 className={`${headlineFontClass} text-2xl font-semibold`}>Messages & Wishes</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.wishes.map((wish) => (
                <article
                  key={wish.id}
                  className={`rounded-xl border p-6 ${
                    isDark ? 'bg-[#191B22] border-white/10' : 'bg-white border-stone-200'
                  }`}
                >
                  <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-stone-200' : 'text-zinc-700'}`}>
                    “{wish.text}”
                  </p>
                  <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-stone-400' : 'text-zinc-500'}`}>
                    <span className={`font-medium ${isDark ? 'text-stone-200' : 'text-zinc-900'}`}>{wish.author}</span>
                    {wish.relationship && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{wish.relationship}</span>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Quiet Music Status Line */}
        {musicTrack && (
          <div
            className={`pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs ${
              isDark ? 'border-white/10 text-stone-400' : 'border-stone-200 text-zinc-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {musicPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
              <span>
                Soundtrack: {musicTrack.title} · {musicTrack.artist}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleMusic}
              className="underline underline-offset-4 hover:opacity-80 cursor-pointer"
            >
              {musicPlaying ? 'Pause music' : 'Play music'}
            </button>
          </div>
        )}
      </div>

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full bg-zinc-950 rounded-xl overflow-hidden border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 text-stone-200">
              <span className="text-xs truncate">{lightboxPhoto.caption || 'Photo Memory'}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close photo"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || 'Memory'}
              referrerPolicy="no-referrer"
              className="w-full max-h-[75vh] object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
