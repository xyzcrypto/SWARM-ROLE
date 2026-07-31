"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { glowTexture } from "./textures";

// Additive radial-glow billboard. We fake bloom with these (the site has no
// postprocessing dep) - a couple of tinted, additive sprites read as a soft
// halo without an EffectComposer pass. Tint via `color`, scale via `scale`.
export function GlowSprite({
  color,
  scale,
  opacity = 1,
  position = [0, 0, 0],
}: {
  color: string;
  scale: number;
  opacity?: number;
  position?: [number, number, number];
}) {
  const tex = useMemo(() => glowTexture(), []);
  return (
    <sprite position={position} scale={[scale, scale, scale]}>
      <spriteMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
      />
    </sprite>
  );
}

const fresnelVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fresnelFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower);
    gl_FragColor = vec4(uColor, f * uIntensity);
  }
`;

// Thin atmospheric rim: a slightly larger front-side shell that only lights at
// grazing angles (fresnel), giving Saturn/Moon a glowing edge. Additive.
export function FresnelShell({
  color,
  scale = 1.08,
  power = 3.0,
  intensity = 0.9,
}: {
  color: string;
  scale?: number;
  power?: number;
  intensity?: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    }),
    [color, power, intensity]
  );
  return (
    <mesh scale={[scale, scale, scale]}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={fresnelVert}
        fragmentShader={fresnelFrag}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
