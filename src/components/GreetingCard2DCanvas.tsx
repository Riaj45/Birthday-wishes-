import React, { useEffect, useRef } from 'react';
import type { AnimationEffectType, AnimationIntensity } from '../types/birthday';

interface GreetingCard2DCanvasProps {
  effectType: AnimationEffectType;
  intensity: AnimationIntensity;
  accentColor: string;
  burstKey?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  alpha: number;
  phase: number;
  color: string;
  life: number;
  maxLife: number;
}

export const GreetingCard2DCanvas: React.FC<GreetingCard2DCanvasProps> = ({
  effectType,
  intensity,
  accentColor,
  burstKey = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;

    const palette = [accentColor || '#E11D48', '#F59E0B', '#FDE68A', '#FB7185', '#F9A8D4', '#E2E8F0'];
    const baseCount = intensity === 'festive' ? 42 : intensity === 'balanced' ? 28 : 16;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(300, rect.width);
      height = Math.max(300, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const spawnParticle = (initialScatter: boolean): Particle => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const randX = Math.random() * width;
      const randY = initialScatter ? Math.random() * height : effectType === 'balloons' || effectType === 'embers' || effectType === 'hearts' || effectType === 'snowsparkle' ? height + 30 : -30;

      switch (effectType) {
        case 'balloons':
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : height + 40 + Math.random() * 80,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -(0.55 + Math.random() * 0.75),
            size: 16 + Math.random() * 14,
            angle: (Math.random() - 0.5) * 0.18,
            spin: (Math.random() - 0.5) * 0.012,
            alpha: 0.72 + Math.random() * 0.22,
            phase: Math.random() * Math.PI * 2,
            color,
            life: 0,
            maxLife: 1000,
          };
        case 'butterflies':
          return {
            x: initialScatter ? randX : Math.random() < 0.5 ? -20 : width + 20,
            y: 40 + Math.random() * (height - 80),
            vx: (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.9),
            vy: (Math.random() - 0.5) * 0.6,
            size: 8 + Math.random() * 6,
            angle: 0,
            spin: 0.14 + Math.random() * 0.08,
            alpha: 0.85,
            phase: Math.random() * Math.PI * 2,
            color,
            life: 0,
            maxLife: 1000,
          };
        case 'hearts':
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : height + 24,
            vx: (Math.random() - 0.5) * 0.45,
            vy: -(0.5 + Math.random() * 0.7),
            size: 7 + Math.random() * 8,
            angle: (Math.random() - 0.5) * 0.35,
            spin: (Math.random() - 0.5) * 0.015,
            alpha: 0.55 + Math.random() * 0.35,
            phase: Math.random() * Math.PI * 2,
            color,
            life: 0,
            maxLife: 1000,
          };
        case 'ribbons':
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : -30,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.95 + Math.random() * 1.15,
            size: 14 + Math.random() * 12,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.07,
            alpha: 0.78,
            phase: Math.random() * Math.PI * 2,
            color,
            life: 0,
            maxLife: 1000,
          };
        case 'snowsparkle':
          return {
            x: randX,
            y: randY,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -(0.4 + Math.random() * 0.65),
            size: 3 + Math.random() * 5,
            angle: 0,
            spin: 0.04,
            alpha: 0.4 + Math.random() * 0.45,
            phase: Math.random() * Math.PI * 2,
            color: Math.random() < 0.6 ? '#FDE68A' : '#FFFFFF',
            life: 0,
            maxLife: 1000,
          };
        case 'petals':
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : -20,
            vx: -0.3 + Math.random() * 0.6,
            vy: 0.65 + Math.random() * 0.8,
            size: 6 + Math.random() * 6,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.04,
            alpha: 0.72 + Math.random() * 0.2,
            phase: Math.random() * Math.PI * 2,
            color: Math.random() < 0.5 ? '#FBCFE8' : Math.random() < 0.7 ? '#FDE68A' : color,
            life: 0,
            maxLife: 1000,
          };
        case 'embers':
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : height + 16,
            vx: (Math.random() - 0.5) * 0.35,
            vy: -(0.45 + Math.random() * 0.7),
            size: 2.5 + Math.random() * 4.5,
            angle: 0,
            spin: 0.03,
            alpha: 0.5 + Math.random() * 0.45,
            phase: Math.random() * Math.PI * 2,
            color: Math.random() < 0.5 ? '#F59E0B' : '#FDE68A',
            life: 0,
            maxLife: 1000,
          };
        case 'starlight':
          return {
            x: randX,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.14,
            vy: (Math.random() - 0.5) * 0.14,
            size: 4 + Math.random() * 5,
            angle: Math.random() * Math.PI,
            spin: 0.02 + Math.random() * 0.03,
            alpha: 0.35 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
            color: Math.random() < 0.7 ? '#FEF3C7' : color,
            life: 0,
            maxLife: 1000,
          };
        case 'fireworks': {
          const cx = width * (0.2 + Math.random() * 0.6);
          const cy = height * (0.14 + Math.random() * 0.36);
          const dir = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 3.1;
          return {
            x: cx,
            y: cy,
            vx: Math.cos(dir) * speed,
            vy: Math.sin(dir) * speed,
            size: 2.2 + Math.random() * 2.4,
            angle: dir,
            spin: 0,
            alpha: 1,
            phase: 0,
            color,
            life: 0,
            maxLife: 55 + Math.random() * 45,
          };
        }
        case 'confetti':
        default:
          return {
            x: randX,
            y: initialScatter ? Math.random() * height : -18,
            vx: (Math.random() - 0.5) * 0.9,
            vy: 0.9 + Math.random() * 1.3,
            size: 5 + Math.random() * 6,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.1,
            alpha: 0.82,
            phase: Math.random() * Math.PI * 2,
            color,
            life: 0,
            maxLife: 1000,
          };
      }
    };

    const particles: Particle[] = [];
    const targetCount = effectType === 'balloons' ? Math.max(10, Math.round(baseCount * 0.45)) : baseCount;
    for (let i = 0; i < targetCount; i += 1) {
      particles.push(spawnParticle(true));
    }

    const spawnFireworkCluster = () => {
      const cx = width * (0.18 + Math.random() * 0.64);
      const cy = height * (0.12 + Math.random() * 0.36);
      const clusterColor = palette[Math.floor(Math.random() * palette.length)];
      const sparks = intensity === 'festive' ? 28 : 18;
      for (let i = 0; i < sparks; i += 1) {
        const dir = (i / sparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const spd = 1.1 + Math.random() * 2.8;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(dir) * spd,
          vy: Math.sin(dir) * spd,
          size: 2.2 + Math.random() * 2,
          angle: dir,
          spin: 0,
          alpha: 1,
          phase: 0,
          color: i % 3 === 0 ? '#FEF3C7' : clusterColor,
          life: 0,
          maxLife: 50 + Math.random() * 35,
        });
      }
      if (particles.length > 140) {
        particles.splice(0, particles.length - 140);
      }
    };

    let frameTick = 0;

    const drawHeart = (size: number) => {
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.bezierCurveTo(-size, -size * 0.4, -size * 0.55, -size * 1.1, 0, -size * 0.35);
      ctx.bezierCurveTo(size * 0.55, -size * 1.1, size, -size * 0.4, 0, size * 0.35);
      ctx.closePath();
      ctx.fill();
    };

    const drawStar4 = (size: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? size : size * 0.28;
        const a = (i * Math.PI) / 4;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    };

    const render = () => {
      frameTick += 1;
      ctx.clearRect(0, 0, width, height);

      if (effectType === 'fireworks' && frameTick % (intensity === 'festive' ? 52 : 85) === 0) {
        spawnFireworkCluster();
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += 1;
        p.phase += 0.035;

        if (effectType === 'fireworks') {
          p.vx *= 0.975;
          p.vy = p.vy * 0.975 + 0.04;
          p.x += p.vx;
          p.y += p.vy;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'butterflies') {
          p.x += p.vx;
          p.y += Math.sin(p.phase * 1.4) * 0.75 + p.vy * 0.25;
          if (p.x < -40 || p.x > width + 40) {
            particles[i] = spawnParticle(false);
            continue;
          }
          const flap = Math.abs(Math.sin(p.life * p.spin));
          ctx.save();
          ctx.translate(p.x, p.y);
          if (p.vx < 0) ctx.scale(-1, 1);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          // Left & right 2D wing pair
          ctx.beginPath();
          ctx.ellipse(-p.size * 0.3, -p.size * 0.25, p.size * 0.75, p.size * (0.28 + flap * 0.55), -0.35, 0, Math.PI * 2);
          ctx.ellipse(-p.size * 0.2, p.size * 0.3, p.size * 0.55, p.size * (0.2 + flap * 0.4), 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FEF3C7';
          ctx.beginPath();
          ctx.ellipse(-p.size * 0.32, -p.size * 0.25, p.size * 0.32, p.size * (0.12 + flap * 0.2), -0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'balloons') {
          p.x += p.vx + Math.sin(p.phase) * 0.35;
          p.y += p.vy;
          p.angle = Math.sin(p.phase) * 0.08;
          if (p.y < -p.size * 4) {
            particles[i] = spawnParticle(false);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          // Curved string
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, p.size * 1.15);
          ctx.quadraticCurveTo(Math.sin(p.phase * 2) * 8, p.size * 2.1, 0, p.size * 3.1);
          ctx.stroke();
          // Matte silk balloon body
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.82, p.size * 1.05, 0, 0, Math.PI * 2);
          ctx.fill();
          // Knot
          ctx.beginPath();
          ctx.moveTo(-3, p.size * 1.04);
          ctx.lineTo(3, p.size * 1.04);
          ctx.lineTo(0, p.size * 1.18);
          ctx.closePath();
          ctx.fill();
          // Soft highlight crescent
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.beginPath();
          ctx.ellipse(-p.size * 0.28, -p.size * 0.34, p.size * 0.16, p.size * 0.35, -0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'hearts') {
          p.x += p.vx + Math.sin(p.phase) * 0.45;
          p.y += p.vy;
          p.angle += p.spin;
          if (p.y < -30) {
            particles[i] = spawnParticle(false);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          drawHeart(p.size);
          ctx.restore();
          continue;
        }

        if (effectType === 'ribbons') {
          p.x += p.vx + Math.sin(p.phase * 1.3) * 0.7;
          p.y += p.vy;
          p.angle += p.spin;
          if (p.y > height + 40) {
            particles[i] = spawnParticle(false);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-p.size * 0.5, 0);
          ctx.bezierCurveTo(-p.size * 0.2, -p.size * 0.5, p.size * 0.2, p.size * 0.5, p.size * 0.5, 0);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (effectType === 'snowsparkle') {
          p.x += p.vx + Math.sin(p.phase) * 0.25;
          p.y += p.vy;
          if (p.y < -20) {
            particles[i] = spawnParticle(false);
            continue;
          }
          const pulse = 0.55 + 0.45 * Math.sin(p.phase * 2);
          ctx.save();
          ctx.globalAlpha = p.alpha * pulse;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.28, p.y - p.size * 0.28, p.size * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'petals') {
          p.x += p.vx + Math.sin(p.phase) * 0.55;
          p.y += p.vy;
          p.angle += p.spin;
          if (p.y > height + 30) {
            particles[i] = spawnParticle(false);
            continue;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'embers') {
          p.x += p.vx + Math.sin(p.phase) * 0.3;
          p.y += p.vy;
          if (p.y < -20) {
            particles[i] = spawnParticle(false);
            continue;
          }
          const glow = 0.5 + 0.5 * Math.sin(p.phase * 2.2);
          ctx.save();
          ctx.globalAlpha = p.alpha * glow;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        if (effectType === 'starlight') {
          p.x = (p.x + p.vx + width) % width;
          p.y = (p.y + p.vy + height) % height;
          p.angle += p.spin * 0.5;
          const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(p.phase * 1.4));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha * twinkle;
          ctx.fillStyle = p.color;
          drawStar4(p.size);
          ctx.restore();
          continue;
        }

        // Default: tumbling 2D metallic confetti
        p.x += p.vx + Math.sin(p.phase) * 0.5;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y > height + 25) {
          particles[i] = spawnParticle(false);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(1, Math.cos(p.phase * 2));
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }

      rafId = window.requestAnimationFrame(render);
    };

    if (effectType === 'fireworks') {
      spawnFireworkCluster();
    }
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [effectType, intensity, accentColor, burstKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 w-full h-full"
    />
  );
};
