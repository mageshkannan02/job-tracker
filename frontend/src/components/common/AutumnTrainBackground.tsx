import React, { useEffect, useState } from 'react';

type BackgroundIntensity = 'subtle' | 'cozy' | 'vivid' | 'cinematic' | 'off';

export const AutumnTrainBackground: React.FC = () => {
  const [intensity, setIntensity] = useState<BackgroundIntensity>(() => {
    return (localStorage.getItem('autumn-bg-intensity') as BackgroundIntensity) || 'cozy';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    return (
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    );
  });

  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Synchronize document attribute for CSS high-contrast legibility rules
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-bg-intensity', intensity);
    }
  }, [intensity]);

  useEffect(() => {
    const handleIntensityChange = (e: CustomEvent<{ intensity: BackgroundIntensity }>) => {
      setIntensity(e.detail.intensity);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-bg-intensity', e.detail.intensity);
      }
    };

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('autumn-bg-intensity-toggle' as any, handleIntensityChange);

    // Preload image
    const img = new Image();
    img.src = '/autumn-dense-forest-train.jpg';
    img.onload = () => setImageLoaded(true);

    return () => {
      observer.disconnect();
      window.removeEventListener('autumn-bg-intensity-toggle' as any, handleIntensityChange);
    };
  }, []);

  if (intensity === 'off') return null;

  // Calibrate opacity based on user setting
  const opacityMap: Record<BackgroundIntensity, number> = {
    subtle: 0.22,
    cozy: 0.45,
    vivid: 0.72,
    cinematic: 0.96,
    off: 0,
  };

  const containerOpacity = opacityMap[intensity];

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-opacity duration-700 ease-in-out"
      style={{ opacity: containerOpacity }}
      aria-hidden="true"
    >
      <style>{`
        /* Cinematic Living Wallpaper: Slow continuous camera pan & gentle breathing zoom */
        @keyframes cinematic-forest-pan {
          0% {
            transform: scale(1.02) translate(0%, 0%);
          }
          33% {
            transform: scale(1.06) translate(-1.2%, -0.8%);
          }
          66% {
            transform: scale(1.04) translate(-0.4%, -1.4%);
          }
          100% {
            transform: scale(1.02) translate(0%, 0%);
          }
        }

        /* Volumetric Sunbeams & Light Shafts filtering through dense canopy */
        @keyframes sunbeam-shimmer {
          0%, 100% {
            opacity: 0.35;
            transform: rotate(-12deg) scaleY(1);
          }
          50% {
            opacity: 0.65;
            transform: rotate(-11deg) scaleY(1.05);
          }
        }

        /* Morning Forest Mist rolling across tracks */
        @keyframes mist-drift-left {
          0% {
            transform: translateX(-15%);
          }
          100% {
            transform: translateX(20%);
          }
        }

        @keyframes mist-drift-right {
          0% {
            transform: translateX(20%);
          }
          100% {
            transform: translateX(-15%);
          }
        }

        /* Billowing Locomotive Steam Smoke Puffs */
        @keyframes steam-drift-1 {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0.75;
          }
          40% {
            opacity: 0.6;
          }
          100% {
            transform: translate(-140px, -110px) scale(3.6);
            opacity: 0;
          }
        }

        @keyframes steam-drift-2 {
          0% {
            transform: translate(0, 0) scale(0.5);
            opacity: 0.8;
          }
          40% {
            opacity: 0.65;
          }
          100% {
            transform: translate(-170px, -135px) scale(4.2);
            opacity: 0;
          }
        }

        @keyframes steam-drift-3 {
          0% {
            transform: translate(0, 0) scale(0.7);
            opacity: 0.85;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            transform: translate(-130px, -95px) scale(3.2);
            opacity: 0;
          }
        }

        /* Wind Gust Blowing Autumn Leaves */
        @keyframes blowing-leaf-gust {
          0% {
            transform: translate(-100px, -40px) rotate3d(1, 1, 0, 0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.95;
          }
          45% {
            transform: translate(45vw, calc(20px + sin(1rad) * 60px)) rotate3d(1, 2, 1, 380deg);
            opacity: 0.9;
          }
          85% {
            opacity: 0.85;
          }
          100% {
            transform: translate(110vw, 85px) rotate3d(2, 1, 1, 760deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* 1. Real Photorealistic Dense Autumn Forest & Train Image Layer */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <img
          src="/autumn-dense-forest-train.jpg"
          alt="Vintage steam train traveling through dense autumn forest"
          className="w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.04]"
          style={{
            animation: 'cinematic-forest-pan 45s ease-in-out infinite',
            transformOrigin: 'center center',
          }}
        />

        {/* Ambient Warm Color Grade Overlay */}
        <div
          className={`absolute inset-0 mix-blend-multiply transition-colors duration-700 ${
            isDark
              ? 'bg-gradient-to-t from-[#1c0d0a]/80 via-[#2a130e]/40 to-[#0e0712]/70'
              : 'bg-gradient-to-t from-amber-950/20 via-transparent to-amber-700/10'
          }`}
        />

        {/* Soft Vignette framing the edges */}
        <div className="absolute inset-0 bg-radial-vignette opacity-50" />

        {/* Adaptive Contrast Scrim for Vivid and Cinematic Modes to ensure 100% text legibility */}
        {(intensity === 'vivid' || intensity === 'cinematic') && (
          <div
            className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
              isDark
                ? intensity === 'cinematic'
                  ? 'bg-black/40 backdrop-contrast-[1.06]'
                  : 'bg-black/28 backdrop-contrast-[1.03]'
                : intensity === 'cinematic'
                  ? 'bg-amber-50/45 backdrop-contrast-[1.04]'
                  : 'bg-amber-50/30 backdrop-contrast-[1.02]'
            }`}
          />
        )}
      </div>

      {/* 2. Volumetric Sunbeams / God Rays filtering through tree canopy */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
        <div
          className="absolute -top-[20%] left-[25%] w-[45vw] h-[130vh] bg-gradient-to-b from-amber-200/25 via-yellow-100/15 to-transparent blur-2xl transform -rotate-12 origin-top"
          style={{ animation: 'sunbeam-shimmer 9s ease-in-out infinite' }}
        />
        <div
          className="absolute -top-[10%] left-[45%] w-[30vw] h-[120vh] bg-gradient-to-b from-amber-100/20 via-orange-100/10 to-transparent blur-xl transform -rotate-15 origin-top"
          style={{ animation: 'sunbeam-shimmer 12s ease-in-out infinite alternate', animationDelay: '-4s' }}
        />
      </div>

      {/* 3. Rolling Autumn Morning Mist & Atmospheric Fog */}
      <div className="absolute bottom-0 inset-x-0 h-[45vh] overflow-hidden pointer-events-none">
        {/* Lower ground mist layer */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-amber-100/15 via-orange-50/10 to-transparent blur-2xl"
          style={{ animation: 'mist-drift-left 32s ease-in-out infinite alternate' }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-white/10 via-amber-100/5 to-transparent blur-xl"
          style={{ animation: 'mist-drift-right 40s ease-in-out infinite alternate', animationDelay: '-12s' }}
        />
      </div>

      {/* 4. Animated Steam Clouds Billowing from Train Chimney */}
      {/* Positioned over the locomotive smokestack area in the center-left composition */}
      <div
        className="absolute left-[38%] top-[48%] pointer-events-none overflow-visible"
        aria-hidden="true"
      >
        {/* Steam Cloud 1 */}
        <div
          className="absolute w-12 h-12 rounded-full bg-white/70 blur-md"
          style={{
            animation: 'steam-drift-1 3.2s ease-out infinite',
          }}
        />
        {/* Steam Cloud 2 (Offset) */}
        <div
          className="absolute w-14 h-14 rounded-full bg-amber-50/75 blur-md"
          style={{
            animation: 'steam-drift-2 3.8s ease-out infinite',
            animationDelay: '1.1s',
          }}
        />
        {/* Steam Cloud 3 (Offset) */}
        <div
          className="absolute w-10 h-10 rounded-full bg-white/80 blur-md"
          style={{
            animation: 'steam-drift-3 3.5s ease-out infinite',
            animationDelay: '2.2s',
          }}
        />
      </div>

      {/* 5. Autumn Twilight Headlight Glow & Ember Particles (Active in Dark Mode) */}
      {isDark && (
        <>
          {/* Headlight Atmospheric Glow cone cutting through mist */}
          <div
            className="absolute left-[44%] top-[56%] w-[28vw] h-[22vh] bg-gradient-to-r from-amber-300/40 via-yellow-200/15 to-transparent blur-lg transform rotate-6 origin-left pointer-events-none"
          />
          {/* Golden Passenger Windows Warm Radiance */}
          <div className="absolute left-[20%] top-[55%] w-[18vw] h-[6vh] bg-amber-400/20 blur-md pointer-events-none" />
        </>
      )}

      {/* 6. Dynamic Blowing Autumn Leaves Swirling in Wind Gusts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 32 }).map((_, i) => {
          const colors = [
            '#ea580c', // Fiery orange
            '#d97706', // Warm amber
            '#dc2626', // Maple crimson
            '#f59e0b', // Golden yellow
            '#b45309', // Russet copper
            '#c2410c', // Deep cinnamon
            '#78350f', // Rich chestnut
          ];
          const color = colors[i % colors.length];
          const startY = 80 + (i * 28) % 650;
          const duration = 6 + (i % 7) * 1.4; // 6s to 15s
          const delay = (i * 0.45) % 8.5;
          const scale = 0.65 + (i % 6) * 0.18; // varying sizes

          return (
            <div
              key={`blowing-leaf-${i}`}
              className="absolute left-0"
              style={{
                top: `${startY}px`,
                animation: `blowing-leaf-gust ${duration}s cubic-bezier(0.25, 0.1, 0.25, 1) infinite`,
                animationDelay: `${delay}s`,
                transform: `scale(${scale})`,
              }}
            >
              {i % 3 === 0 ? (
                /* Vibrant Maple Leaf SVG */
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill={color}
                  className="filter drop-shadow-sm opacity-90"
                >
                  <path d="M12 2L13.5 6.5L16 5.5L15 8.5L18.5 8L17 11L21 12L17.5 14L19 17L15 16L14.5 19.5L12 17.5L9.5 19.5L9 16L5 17L6.5 14L3 12L7 11L5.5 8L9 8.5L8 5.5L10.5 6.5L12 2Z" />
                  <path d="M12 17V22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : i % 3 === 1 ? (
                /* Golden Oak Leaf SVG */
                <svg
                  width="24"
                  height="30"
                  viewBox="0 0 24 28"
                  fill={color}
                  className="filter drop-shadow-sm opacity-85"
                >
                  <path d="M12 2C9 4 7 7 8 10C6 11 5 13 6 15C4 16 5 19 8 20C7 22 9 24 12 24C15 24 17 22 16 20C19 19 20 16 18 15C19 13 18 11 16 10C17 7 15 4 12 2Z" />
                  <path d="M12 10V26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                /* Beech / Birch Leaf SVG */
                <svg
                  width="22"
                  height="28"
                  viewBox="0 0 20 26"
                  fill={color}
                  className="filter drop-shadow-sm opacity-85"
                >
                  <path d="M10 2C5 7 3 13 5 18C7 21 10 22 10 22C10 22 13 21 15 18C17 13 15 7 10 2Z" />
                  <path d="M10 12V24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
