import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';

const PLANETS = [
  { name: 'mercury', color: '#b1b1b1', r: 5, orbit: 50, duration: 4000 },
  { name: 'venus', color: '#e6c200', r: 8, orbit: 80, duration: 7000 },
  { name: 'earth', color: '#3fa7d6', r: 9, orbit: 110, duration: 10000 },
  { name: 'mars', color: '#c1440e', r: 7, orbit: 140, duration: 15000 },
  { name: 'jupiter', color: '#e3c07b', r: 15, orbit: 180, duration: 20000 },
  { name: 'saturn', color: '#e7d3a1', r: 13, orbit: 220, duration: 25000 },
  { name: 'uranus', color: '#b5e3e3', r: 11, orbit: 260, duration: 30000 },
  { name: 'neptune', color: '#4062bb', r: 11, orbit: 290, duration: 35000 },
];

const SolarSystemAnimation = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [speed, setSpeed] = useState(1);
  const [planetSize, setPlanetSize] = useState(1);

  useEffect(() => {
    // Para cada planeta, anime a rotação do grupo
    PLANETS.forEach(planet => {
      const selector = `.planet-${planet.name}`;
      animate(
        {
          targets: selector,
          rotate: [0, 360],
          easing: 'linear',
          duration: planet.duration / speed,
          loop: true,
        },
        { autoplay: true }
      );
    });
    // Cleanup: anime.js não precisa de pause pois é loop infinito
  }, [speed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 500 }}>
      <div style={{ marginBottom: 24, display: 'flex', gap: 24 }}>
        <label>
          <span style={{ marginRight: 8 }}>Velocidade:</span>
          <input type="range" min={0.1} max={5} step={0.1} value={speed} onChange={e => setSpeed(Number(e.target.value))} />
          <span style={{ marginLeft: 8 }}>{speed.toFixed(1)}x</span>
        </label>
        <label>
          <span style={{ marginRight: 8 }}>Tamanho:</span>
          <input type="range" min={0.5} max={2} step={0.1} value={planetSize} onChange={e => setPlanetSize(Number(e.target.value))} />
          <span style={{ marginLeft: 8 }}>{planetSize.toFixed(1)}x</span>
        </label>
      </div>
      <svg ref={svgRef} viewBox="0 0 600 600" width="500" height="500" style={{ background: 'transparent' }}>
        {/* Sol */}
        <circle cx="300" cy="300" r="30" fill="#FFD700" />
        {/* Órbitas */}
        <g>
          {PLANETS.map(p => (
            <circle key={p.name} cx="300" cy="300" r={p.orbit} fill="none" stroke="#888" strokeDasharray="2 4" />
          ))}
        </g>
        {/* Planetas animados */}
        {PLANETS.map((p, i) => (
          <g
            key={p.name}
            className={`planet planet-${p.name}`}
            data-planet={p.name}
            style={{ transformOrigin: '300px 300px' }}
          >
            <circle
              cx="300"
              cy={300 - p.orbit}
              r={p.r * planetSize}
              fill={p.color}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

export default SolarSystemAnimation; 