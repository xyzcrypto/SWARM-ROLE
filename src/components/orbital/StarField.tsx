"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GOLD_LIGHT, MINT_LIGHT } from "./constants";

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vColor = aColor;
    vTw = 0.5 + 0.5 * sin(uTime * 0.9 + aPhase);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (0.55 + 0.75 * vTw) * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vTw;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r) * (0.35 + 0.65 * vTw);
    gl_FragColor = vec4(vColor, a);
  }
`;

// Layer 1: distant stars on a deep spherical shell. Instanced points, per-point
// twinkle in the shader, whole field drifts extremely slowly. Deterministic per
// mount (ssr:false, so no hydration concern).
export function StarField({ count = 900, pixelRatio = 1.5 }: { count?: number; pixelRatio?: number }) {
  const group = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, phases, sizes, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const gold = new THREE.Color(GOLD_LIGHT);
    const mint = new THREE.Color(MINT_LIGHT);
    const white = new THREE.Color("#ffffff");
    for (let i = 0; i < count; i++) {
      // spherical shell behind the scene
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 16 + Math.random() * 26;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 4; // keep behind camera focus
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.6 + Math.random() * 2.1;
      const pick = Math.random();
      const col = pick > 0.9 ? gold : pick > 0.82 ? mint : white;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, phases, sizes, colors };
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } }),
    [pixelRatio]
  );

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
    if (group.current) group.current.rotation.y += dt * 0.006;
  });

  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
