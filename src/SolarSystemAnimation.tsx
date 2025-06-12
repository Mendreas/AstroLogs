import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';

const PLANETS = [
  { name: 'Mercury', color: '#b1b1b1', r: 6, orbit: 60, duration: 4000, velocity: 47.4 },
  { name: 'Venus', color: '#e6c200', r: 10, orbit: 90, duration: 7000, velocity: 35.0 },
  { name: 'Earth', color: '#3fa7d6', r: 12, orbit: 120, duration: 10000, velocity: 29.8 },
  { name: 'Mars', color: '#c1440e', r: 9, orbit: 150, duration: 15000, velocity: 24.1 },
  { name: 'Jupiter', color: '#e3c07b', r: 22, orbit: 190, duration: 20000, velocity: 13.1 },
  { name: 'Saturn', color: '#e7d3a1', r: 18, orbit: 230, duration: 25000, velocity: 9.7, rings: true },
  { name: 'Uranus', color: '#b5e3e3', r: 14, orbit: 270, duration: 30000, velocity: 6.8 },
  { name: 'Neptune', color: '#4062bb', r: 14, orbit: 310, duration: 35000, velocity: 5.4 },
];

const STAR_COUNT = 200;

function randomStars(width: number, height: number, count: number) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.2 + 0.2,
    o: Math.random() * 0.5 + 0.5,
  }));
}

const SolarSystemAnimation = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState('Earth');
  const [stars, setStars] = useState<any[]>([]);

  // Draw starfield background
  useEffect(() => {
    const width = 700, height = 700;
    setStars(randomStars(width, height, STAR_COUNT));
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        stars.forEach(star => {
          ctx.globalAlpha = star.o;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI);
          ctx.fillStyle = '#fff';
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
    }
  }, [stars]);

  // Animate orbits
  useEffect(() => {
    PLANETS.forEach(planet => {
      const selector = `.planet-group-${planet.name}`;
      animate(
        selector,
        {
          rotate: [0, 360],
          easing: 'linear',
          duration: planet.duration,
          loop: true,
        }
      );
    });
  }, []);

  // Info for selected planet
  const planetInfo = PLANETS.find(p => p.name === selected);

  return (
    <div style={{ position: 'relative', width: 700, height: 700, margin: '0 auto', background: 'transparent' }}>
      {/* Starfield background */}
      <canvas ref={canvasRef} width={700} height={700} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
      {/* Solar system SVG */}
      <svg ref={svgRef} viewBox="0 0 700 700" width={700} height={700} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        {/* Orbits */}
        {PLANETS.map(p => (
          <ellipse
            key={p.name}
            cx={350}
            cy={350}
            rx={p.orbit}
            ry={p.orbit * 0.6}
            fill="none"
            stroke="#fff"
            strokeDasharray="2 6"
            strokeOpacity={0.18}
          />
        ))}
        {/* Sun */}
        <radialGradient id="sun-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="80%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#ffb300" />
        </radialGradient>
        <circle cx={350} cy={350} r={38} fill="url(#sun-gradient)" filter="url(#sun-glow)" />
        <filter id="sun-glow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Planets */}
        {PLANETS.map((p, i) => {
          // Angle for label
          const angle = -Math.PI / 2;
          const px = 350 + p.orbit * Math.cos(angle);
          const py = 350 + p.orbit * 0.6 * Math.sin(angle);
          return (
            <g
              key={p.name}
              className={`planet-group planet-group-${p.name}`}
              style={{ transformOrigin: '350px 350px' }}
              onClick={() => setSelected(p.name)}
              tabIndex={0}
              role="button"
              aria-label={p.name}
            >
              {/* Planet */}
              <circle
                cx={350}
                cy={350 - p.orbit}
                r={p.r}
                fill={p.color}
                stroke={selected === p.name ? '#fff' : 'none'}
                strokeWidth={selected === p.name ? 3 : 0}
                style={{ filter: selected === p.name ? 'drop-shadow(0 0 8px #fff)' : undefined, cursor: 'pointer' }}
              />
              {/* Saturn's rings */}
              {p.rings && (
                <ellipse
                  cx={350}
                  cy={350 - p.orbit}
                  rx={p.r * 2.2}
                  ry={p.r * 0.7}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                  opacity={0.5}
                />
              )}
              {/* Label below planet */}
              <text
                x={px}
                y={py + p.r + 18}
                textAnchor="middle"
                fontSize={selected === p.name ? 18 : 13}
                fill={selected === p.name ? '#fff' : '#aaa'}
                style={{ pointerEvents: 'none', fontWeight: selected === p.name ? 700 : 400 }}
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Info overlay */}
      {planetInfo && (
        <div style={{
          position: 'absolute',
          left: 30,
          top: 30,
          background: 'rgba(20,24,32,0.85)',
          color: '#fff',
          borderRadius: 12,
          padding: '18px 28px',
          zIndex: 10,
          minWidth: 180,
          boxShadow: '0 2px 16px #0008',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{planetInfo.name}</div>
          <div style={{ fontSize: 15, marginBottom: 2 }}>Orbit Velocity: <b>{planetInfo.velocity.toLocaleString()} km/h</b></div>
          <div style={{ fontSize: 15 }}>Distance from Sun: <b>{planetInfo.orbit * 2}M km</b></div>
        </div>
      )}
      {/* Attribution */}
      <div style={{ position: 'absolute', right: 24, bottom: 12, color: '#fff8', fontSize: 13, zIndex: 20 }}>
        Inspired by <a href="https://codepen.io/juliangarnier/pen/krNqZO" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>Julian Garnier</a>
      </div>
    </div>
  );
};

export default SolarSystemAnimation; 