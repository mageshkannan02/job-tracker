import React, { useEffect, useState } from 'react';

interface Leaf {
  id: number;
  left: number; // percentage across screen 0-100
  size: number; // px size 18-36
  duration: number; // fall duration in seconds 9-18
  delay: number; // animation delay in seconds 0-10
  swayDuration: number; // sway duration 3-6s
  type: 'maple' | 'oak' | 'birch';
  color: string;
  opacity: number;
  rotate: number;
}

const AUTUMN_COLORS = [
  '#ea580c', // Burnt Orange
  '#d97706', // Warm Amber
  '#b45309', // Russet Brown
  '#dc2626', // Maple Crimson
  '#e11d48', // Autumn Rose
  '#f59e0b', // Harvest Gold
  '#c2410c', // Deep Cinnamon
];

export const AutumnLeaves: React.FC = () => {
  const [leavesEnabled, setLeavesEnabled] = useState<boolean>(() => {
    return localStorage.getItem('autumn-leaves') !== 'false';
  });

  const [leaves, setLeaves] = useState<Leaf[]>([]);

  useEffect(() => {
    // Calibrate leaf count for mobile vs desktop for optimal 60fps smoothness
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const leafCount = isMobile ? 6 : 18;

    // Generate stable set of randomized falling leaves
    const generated: Leaf[] = Array.from({ length: leafCount }).map((_, i) => ({
      id: i,
      left: Math.random() * 94 + 3,
      size: Math.floor(Math.random() * (isMobile ? 12 : 16)) + (isMobile ? 14 : 16),
      duration: Math.floor(Math.random() * 10) + (isMobile ? 14 : 12),
      delay: Math.random() * 10,
      swayDuration: Math.floor(Math.random() * 3) + 3,
      type: (['maple', 'oak', 'birch'] as const)[i % 3],
      color: AUTUMN_COLORS[i % AUTUMN_COLORS.length],
      opacity: Math.random() * 0.35 + 0.45,
      rotate: Math.floor(Math.random() * 360),
    }));
    setLeaves(generated);

    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => {
      setLeavesEnabled(e.detail.enabled);
    };

    window.addEventListener('autumn-leaves-toggle' as any, handleToggle);
    return () => {
      window.removeEventListener('autumn-leaves-toggle' as any, handleToggle);
    };
  }, []);

  if (!leavesEnabled) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none"
      aria-hidden="true"
    >
      {leaves.map((leaf) => (
        <div
          key={leaf.id}
          className="absolute will-change-transform"
          style={{
            left: `${leaf.left}%`,
            top: 0,
            animation: `autumn-fall ${leaf.duration}s linear infinite`,
            animationDelay: `${leaf.delay}s`,
          }}
        >
          <div
            className="will-change-transform"
            style={{
              animation: `autumn-sway ${leaf.swayDuration}s ease-in-out infinite alternate`,
              transform: `rotate(${leaf.rotate}deg)`,
              opacity: leaf.opacity,
            }}
          >
            {leaf.type === 'maple' && (
              /* Stylized Maple Leaf SVG */
              <svg
                width={leaf.size}
                height={leaf.size}
                viewBox="0 0 24 24"
                fill={leaf.color}
                className="drop-shadow-xs"
              >
                <path d="M12 2L13.5 6.5L16 5.5L15 8.5L18.5 8L17 11L21 12L17.5 14L19 17L15 16L14.5 19.5L12 17.5L9.5 19.5L9 16L5 17L6.5 14L3 12L7 11L5.5 8L9 8.5L8 5.5L10.5 6.5L12 2Z" />
                <path d="M12 17V22" stroke={leaf.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}

            {leaf.type === 'oak' && (
              /* Stylized Oak Leaf SVG */
              <svg
                width={leaf.size * 0.9}
                height={leaf.size * 1.1}
                viewBox="0 0 24 28"
                fill={leaf.color}
                className="drop-shadow-xs"
              >
                <path d="M12 2C9 4 7 7 8 10C6 11 5 13 6 15C4 16 5 19 8 20C7 22 9 24 12 24C15 24 17 22 16 20C19 19 20 16 18 15C19 13 18 11 16 10C17 7 15 4 12 2Z" />
                <path d="M12 10V26" stroke={leaf.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}

            {leaf.type === 'birch' && (
              /* Stylized Birch Leaf SVG */
              <svg
                width={leaf.size * 0.85}
                height={leaf.size * 1.15}
                viewBox="0 0 20 26"
                fill={leaf.color}
                className="drop-shadow-xs"
              >
                <path d="M10 2C5 7 3 13 5 18C7 21 10 22 10 22C10 22 13 21 15 18C17 13 15 7 10 2Z" />
                <path d="M10 12V24" stroke={leaf.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

