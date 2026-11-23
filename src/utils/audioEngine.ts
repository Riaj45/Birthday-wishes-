import type { MusicTrack } from '../types/birthday';

type NoteStep = { freq: number; dur: number; harmony?: number };

const MELODIES: Record<string, { tempo: number; wave: OscillatorType; steps: NoteStep[] }> = {
  'happy-birthday': {
    tempo: 0.42,
    wave: 'triangle',
    steps: [
      { freq: 392.0, dur: 0.75 }, // G4
      { freq: 392.0, dur: 0.25 },
      { freq: 440.0, dur: 1.0, harmony: 261.63 }, // A4
      { freq: 392.0, dur: 1.0, harmony: 293.66 }, // G4
      { freq: 523.25, dur: 1.0, harmony: 329.63 }, // C5
      { freq: 493.88, dur: 2.0, harmony: 293.66 }, // B4
      { freq: 392.0, dur: 0.75 },
      { freq: 392.0, dur: 0.25 },
      { freq: 440.0, dur: 1.0, harmony: 293.66 },
      { freq: 392.0, dur: 1.0, harmony: 329.63 },
      { freq: 587.33, dur: 1.0, harmony: 349.23 }, // D5
      { freq: 523.25, dur: 2.0, harmony: 329.63 }, // C5
      { freq: 392.0, dur: 0.75 },
      { freq: 392.0, dur: 0.25 },
      { freq: 783.99, dur: 1.0, harmony: 392.0 }, // G5
      { freq: 659.25, dur: 1.0, harmony: 329.63 }, // E5
      { freq: 523.25, dur: 1.0, harmony: 261.63 }, // C5
      { freq: 493.88, dur: 1.0, harmony: 293.66 }, // B4
      { freq: 440.0, dur: 1.5, harmony: 261.63 }, // A4
      { freq: 698.46, dur: 0.75 }, // F5
      { freq: 698.46, dur: 0.25 },
      { freq: 659.25, dur: 1.0, harmony: 329.63 }, // E5
      { freq: 523.25, dur: 1.0, harmony: 261.63 }, // C5
      { freq: 587.33, dur: 1.0, harmony: 293.66 }, // D5
      { freq: 523.25, dur: 2.2, harmony: 261.63 }, // C5
    ],
  },
  'music-box': {
    tempo: 0.48,
    wave: 'sine',
    steps: [
      { freq: 523.25, dur: 1.0, harmony: 261.63 },
      { freq: 659.25, dur: 1.0 },
      { freq: 783.99, dur: 1.0, harmony: 392.0 },
      { freq: 1046.5, dur: 1.5, harmony: 523.25 },
      { freq: 987.77, dur: 1.0 },
      { freq: 783.99, dur: 1.5, harmony: 329.63 },
      { freq: 659.25, dur: 1.0 },
      { freq: 587.33, dur: 1.0, harmony: 293.66 },
      { freq: 659.25, dur: 1.0 },
      { freq: 783.99, dur: 1.5, harmony: 392.0 },
      { freq: 659.25, dur: 1.0 },
      { freq: 523.25, dur: 2.0, harmony: 261.63 },
    ],
  },
  waltz: {
    tempo: 0.45,
    wave: 'triangle',
    steps: [
      { freq: 440.0, dur: 1.0, harmony: 220.0 },
      { freq: 523.25, dur: 1.0 },
      { freq: 659.25, dur: 1.0 },
      { freq: 587.33, dur: 1.0, harmony: 293.66 },
      { freq: 698.46, dur: 1.0 },
      { freq: 880.0, dur: 1.0 },
      { freq: 783.99, dur: 1.5, harmony: 392.0 },
      { freq: 659.25, dur: 1.5 },
      { freq: 523.25, dur: 1.0, harmony: 261.63 },
      { freq: 659.25, dur: 1.0 },
      { freq: 783.99, dur: 1.0 },
      { freq: 659.25, dur: 2.0, harmony: 329.63 },
    ],
  },
  'piano-lullaby': {
    tempo: 0.56,
    wave: 'sine',
    steps: [
      { freq: 329.63, dur: 1.2, harmony: 196.0 },
      { freq: 392.0, dur: 1.2 },
      { freq: 493.88, dur: 1.4, harmony: 246.94 },
      { freq: 440.0, dur: 1.4, harmony: 220.0 },
      { freq: 392.0, dur: 1.2 },
      { freq: 329.63, dur: 1.6, harmony: 164.81 },
      { freq: 293.66, dur: 1.2, harmony: 146.83 },
      { freq: 392.0, dur: 1.2 },
      { freq: 440.0, dur: 1.4, harmony: 220.0 },
      { freq: 392.0, dur: 2.2, harmony: 196.0 },
    ],
  },
};

class BirthdayAudioPlayer {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private stepIdx = 0;
  private activeId: string | null = null;

  public stop(): void {
    this.activeId = null;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
      this.htmlAudio = null;
    }
  }

  public isPlayingId(trackId: string): boolean {
    return this.activeId === trackId;
  }

  public play(track: MusicTrack): void {
    this.stop();
    this.activeId = track.id;

    if (track.sourceType === 'audio' && track.audioUrl) {
      const audio = new Audio(track.audioUrl);
      audio.loop = true;
      audio.volume = 0.55;
      this.htmlAudio = audio;
      void audio.play().catch(() => {
        this.activeId = null;
      });
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const preset = MELODIES[track.synthPreset || 'happy-birthday'] || MELODIES['happy-birthday'];
    this.stepIdx = 0;

    const scheduleNext = () => {
      if (this.activeId !== track.id || !this.ctx) return;
      const step = preset.steps[this.stepIdx % preset.steps.length];
      this.stepIdx += 1;

      const now = this.ctx.currentTime;
      const noteSec = step.dur * preset.tempo;

      this.playTone(step.freq, preset.wave, now, noteSec, 0.14);
      if (step.harmony) {
        this.playTone(step.harmony, 'sine', now, noteSec * 1.15, 0.08);
      }

      this.timer = window.setTimeout(scheduleNext, Math.max(120, noteSec * 1000));
    };

    scheduleNext();
  }

  private playTone(freq: number, wave: OscillatorType, startTime: number, duration: number, peakGain: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.22);
  }
}

export const birthdayAudio = new BirthdayAudioPlayer();
