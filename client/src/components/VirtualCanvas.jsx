import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function VirtualCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    scene.fog = new THREE.FogExp2(0x0f0e0d, 0.04);

    const createParticleLayer = ({ count, size, opacity, spread, palette }) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      const drift = new Float32Array(count);

      for (let i = 0; i < count; i += 1) {
        const ix = i * 3;
        positions[ix] = (Math.random() - 0.5) * spread.x;
        positions[ix + 1] = (Math.random() - 0.5) * spread.y;
        positions[ix + 2] = (Math.random() - 0.5) * spread.z;

        const c = new THREE.Color(palette[i % palette.length]);
        colors[ix] = c.r;
        colors[ix + 1] = c.g;
        colors[ix + 2] = c.b;

        phases[i] = Math.random() * Math.PI * 2;
        drift[i] = 0.001 + Math.random() * 0.0018;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      return { points, geometry, material, positions, phases, drift, spread };
    };

    const layers = [
      createParticleLayer({
        count: 700,
        size: 0.05,
        opacity: 0.3,
        spread: { x: 20, y: 12, z: 8 },
        palette: [0xf4c87a, 0xeab36c, 0xffe2b0],
      }),
      createParticleLayer({
        count: 350,
        size: 0.09,
        opacity: 0.16,
        spread: { x: 18, y: 10, z: 7 },
        palette: [0x9dcfff, 0xbddfff, 0xe4f1ff],
      }),
    ];

    let frameId;
    const animate = () => {
      for (let l = 0; l < layers.length; l += 1) {
        const layer = layers[l];
        for (let i = 0; i < layer.phases.length; i += 1) {
          const ix = i * 3;
          layer.phases[i] += layer.drift[i];
          layer.positions[ix] += Math.sin(layer.phases[i]) * 0.0012;
          layer.positions[ix + 1] += layer.drift[i] * 0.9;

          if (layer.positions[ix + 1] > layer.spread.y / 2) {
            layer.positions[ix + 1] = -layer.spread.y / 2;
          }
          if (layer.positions[ix] > layer.spread.x / 2) {
            layer.positions[ix] = -layer.spread.x / 2;
          }
          if (layer.positions[ix] < -layer.spread.x / 2) {
            layer.positions[ix] = layer.spread.x / 2;
          }
        }
        layer.geometry.attributes.position.needsUpdate = true;
      }

      scene.rotation.y += 0.0002;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      layers.forEach((layer) => {
        layer.geometry.dispose();
        layer.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', filter: 'blur(0.6px) saturate(110%)' }} />;
}
