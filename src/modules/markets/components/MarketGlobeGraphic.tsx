"use client";

import React from "react";

/**
 * Realistic illuminated Earth globe with atmospheric golden rim and glowing network nodes,
 * matching the visual in Image 2.
 */
export function MarketGlobeGraphic({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute right-0 top-0 w-[420px] h-[320px] sm:w-[540px] sm:h-[380px] lg:w-[680px] lg:h-[420px] overflow-hidden select-none ${className}`}
    >
      <svg
        viewBox="0 0 680 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Atmospheric outer glow */}
          <radialGradient id="earthAtmosphere" cx="65%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#faecc4" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#e2a72f" stopOpacity="0.25" />
            <stop offset="65%" stopColor="#ad6f10" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#08080a" stopOpacity="0" />
          </radialGradient>

          {/* Planet sphere surface gradient */}
          <radialGradient id="planetSurface" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#1a1813" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#0f0e0c" stopOpacity="0.95" />
            <stop offset="85%" stopColor="#08080a" stopOpacity="1" />
          </radialGradient>

          {/* Horizon sunburst edge */}
          <linearGradient id="horizonGlow" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#fff8e7" stopOpacity="0.9" />
            <stop offset="25%" stopColor="#f3d488" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#d18f1b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#08080a" stopOpacity="0" />
          </linearGradient>

          <filter id="limbBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="cityGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient atmospheric haze */}
        <circle cx="480" cy="180" r="260" fill="url(#earthAtmosphere)" />

        {/* Main Earth Sphere (partially masked off screen right) */}
        <ellipse cx="500" cy="190" rx="230" ry="210" fill="url(#planetSurface)" />

        {/* Illuminated atmospheric limb (curved edge with intense gold light) */}
        <path
          d="M 285 240 C 330 110, 430 40, 580 20"
          stroke="url(#horizonGlow)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#limbBlur)"
          opacity="0.85"
        />
        <path
          d="M 290 235 C 335 115, 432 45, 580 22"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Continental wireframe lat/long arcs on dark side */}
        <ellipse cx="500" cy="190" rx="210" ry="190" stroke="rgba(226, 167, 47, 0.12)" strokeWidth="0.8" />
        <ellipse cx="500" cy="190" rx="210" ry="130" stroke="rgba(226, 167, 47, 0.1)" strokeWidth="0.7" transform="rotate(-15 500 190)" />
        <ellipse cx="500" cy="190" rx="140" ry="200" stroke="rgba(226, 167, 47, 0.1)" strokeWidth="0.7" transform="rotate(-15 500 190)" />
        <ellipse cx="500" cy="190" rx="70" ry="200" stroke="rgba(226, 167, 47, 0.12)" strokeWidth="0.8" transform="rotate(-15 500 190)" />

        {/* Golden city light nodes & interconnected web */}
        <g filter="url(#cityGlow)">
          {/* Node links */}
          <line x1="390" y1="140" x2="430" y2="120" stroke="#f3d488" strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="430" y1="120" x2="480" y2="105" stroke="#f3d488" strokeWidth="1" strokeOpacity="0.7" />
          <line x1="480" y1="105" x2="520" y2="135" stroke="#f3d488" strokeWidth="0.9" strokeOpacity="0.6" />
          <line x1="430" y1="120" x2="445" y2="170" stroke="#e2a72f" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="445" y1="170" x2="495" y2="190" stroke="#e2a72f" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="495" y1="190" x2="550" y2="175" stroke="#e2a72f" strokeWidth="0.8" strokeOpacity="0.5" />
          <line x1="520" y1="135" x2="550" y2="175" stroke="#f3d488" strokeWidth="0.8" strokeOpacity="0.6" />
          <line x1="360" y1="195" x2="390" y2="140" stroke="#e2a72f" strokeWidth="0.7" strokeOpacity="0.4" />
          <line x1="360" y1="195" x2="410" y2="230" stroke="#e2a72f" strokeWidth="0.7" strokeOpacity="0.4" />
          <line x1="410" y1="230" x2="470" y2="250" stroke="#e2a72f" strokeWidth="0.7" strokeOpacity="0.4" />

          {/* Node city clusters */}
          <circle cx="390" cy="140" r="2.5" fill="#ffffff" />
          <circle cx="430" cy="120" r="3.2" fill="#fff8e7" stroke="#e2a72f" strokeWidth="1" />
          <circle cx="480" cy="105" r="3.5" fill="#ffffff" stroke="#e2a72f" strokeWidth="1.2" />
          <circle cx="520" cy="135" r="2.8" fill="#fff8e7" />
          <circle cx="445" cy="170" r="2.2" fill="#f3d488" />
          <circle cx="495" cy="190" r="2.6" fill="#ffffff" />
          <circle cx="550" cy="175" r="2.8" fill="#fff8e7" stroke="#e2a72f" strokeWidth="0.8" />
          <circle cx="360" cy="195" r="2" fill="#f3d488" />
          <circle cx="410" cy="230" r="2.2" fill="#f3d488" />
          <circle cx="470" cy="250" r="2" fill="#e2a72f" />

          {/* Golden floating micro particles */}
          <circle cx="340" cy="100" r="1.2" fill="#faecc4" opacity="0.8" />
          <circle cx="415" cy="70" r="1.5" fill="#faecc4" opacity="0.9" />
          <circle cx="460" cy="50" r="1.8" fill="#ffffff" opacity="0.95" />
          <circle cx="510" cy="40" r="1.5" fill="#faecc4" opacity="0.9" />
          <circle cx="560" cy="65" r="1.2" fill="#faecc4" opacity="0.7" />
          <circle cx="300" cy="160" r="1" fill="#e2a72f" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}
