import React, { useEffect, useRef } from 'react';

const SolarSystemAnimation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the universe container
    const universe = document.createElement('div');
    universe.className = 'universe';
    containerRef.current.appendChild(universe);

    // Create the sun
    const sun = document.createElement('div');
    sun.className = 'sun';
    universe.appendChild(sun);

    // Create planets
    const planets = [
      { name: 'mercury', size: 3, distance: 50, speed: 2.4, color: '#A0522D' },
      { name: 'venus', size: 5, distance: 70, speed: 1.8, color: '#DEB887' },
      { name: 'earth', size: 5, distance: 90, speed: 1.5, color: '#4169E1' },
      { name: 'mars', size: 4, distance: 110, speed: 1.2, color: '#CD5C5C' },
      { name: 'jupiter', size: 12, distance: 140, speed: 0.8, color: '#F4A460' },
      { name: 'saturn', size: 10, distance: 170, speed: 0.6, color: '#DAA520' },
      { name: 'uranus', size: 7, distance: 200, speed: 0.4, color: '#87CEEB' },
      { name: 'neptune', size: 7, distance: 230, speed: 0.3, color: '#1E90FF' }
    ];

    planets.forEach(planet => {
      const orbit = document.createElement('div');
      orbit.className = 'orbit';
      orbit.style.width = `${planet.distance * 2}px`;
      orbit.style.height = `${planet.distance * 2}px`;
      orbit.style.animationDuration = `${planet.speed}s`;
      universe.appendChild(orbit);

      const planetElement = document.createElement('div');
      planetElement.className = `planet ${planet.name}`;
      planetElement.style.width = `${planet.size}px`;
      planetElement.style.height = `${planet.size}px`;
      planetElement.style.backgroundColor = planet.color;
      orbit.appendChild(planetElement);
    });

    // Add Saturn's rings
    const saturn = document.querySelector('.saturn');
    if (saturn) {
      const rings = document.createElement('div');
      rings.className = 'rings';
      saturn.appendChild(rings);
    }

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="solar-system-container" ref={containerRef}>
      <style>
        {`
          .solar-system-container {
            width: 100%;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #000;
            overflow: hidden;
          }

          .universe {
            position: relative;
            width: 500px;
            height: 500px;
            transform-style: preserve-3d;
            transform: rotateX(60deg);
          }

          .sun {
            position: absolute;
            width: 20px;
            height: 20px;
            background: #FDB813;
            border-radius: 50%;
            box-shadow: 0 0 50px #FDB813;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }

          .orbit {
            position: absolute;
            top: 50%;
            left: 50%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: rotate linear infinite;
          }

          .planet {
            position: absolute;
            top: 0;
            left: 50%;
            border-radius: 50%;
            transform: translate(-50%, -50%);
          }

          .rings {
            position: absolute;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: translate(-50%, -50%) rotateX(75deg);
          }

          @keyframes rotate {
            from {
              transform: translate(-50%, -50%) rotate(0deg);
            }
            to {
              transform: translate(-50%, -50%) rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default SolarSystemAnimation; 