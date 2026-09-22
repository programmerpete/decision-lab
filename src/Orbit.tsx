import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Decorative only.
 *
 * This illustration receives no results, probabilities, costs, or timings, and it
 * never represents model internals or measured throughput. It is hidden from
 * assistive technology, pauses offscreen and when the document is hidden, renders a
 * single static frame under `prefers-reduced-motion`, and falls back to a CSS
 * illustration when WebGL is unavailable.
 */
export default function Orbit() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      // WebGL is unavailable. The CSS illustration underneath stays visible.
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.1);

    const accent = new THREE.Color('#c9e8a8');
    const disposables: Array<{ dispose: () => void }> = [];

    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.62, 2),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      }),
    );
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.62, 2)),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.22 }),
    );
    const shell = new THREE.Group();
    shell.add(globe, wireframe);
    scene.add(shell);

    for (const geometry of [globe.geometry, wireframe.geometry]) {
      disposables.push(geometry);
    }
    disposables.push(globe.material, wireframe.material);

    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.set(0.62, 0, 0.34);
    scene.add(orbitGroup);

    const ringGeometry = new THREE.TorusGeometry(2.4, 0.004, 6, 180);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.34,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    orbitGroup.add(ring);
    disposables.push(ringGeometry, ringMaterial);

    const nodeGeometry = new THREE.SphereGeometry(0.055, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: accent });
    disposables.push(nodeGeometry, nodeMaterial);

    const nodes = [
      { angle: 0.4, radius: 2.4, size: 1 },
      { angle: 3.1, radius: 2.4, size: 0.8 },
      { angle: 5.2, radius: 1.95, size: 0.65 },
    ].map(({ angle, radius, size }) => {
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.scale.setScalar(size);
      node.userData = { angle, radius };
      orbitGroup.add(node);
      return node;
    });

    host.append(renderer.domElement);
    host.dataset.state = 'ready';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    let clock = 0;
    let last = performance.now();

    const draw = () => {
      renderer.render(scene, camera);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (clientWidth === 0 || clientHeight === 0) {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      draw();
    };

    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += delta;

      shell.rotation.y += delta * 0.16;
      shell.rotation.x = Math.sin(clock * 0.24) * 0.08;
      orbitGroup.rotation.z += delta * 0.05;

      for (const node of nodes) {
        const { angle, radius } = node.userData as { angle: number; radius: number };
        const theta = angle + clock * 0.22;
        node.position.set(Math.cos(theta) * radius, Math.sin(theta) * radius, 0);
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame !== 0 || reduceMotion.matches) {
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const applyMotionPreference = () => {
      stop();
      if (reduceMotion.matches) {
        // A single static frame keeps the illustration honest without motion.
        for (const node of nodes) {
          const { angle, radius } = node.userData as { angle: number; radius: number };
          node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        }
        draw();
      } else {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !document.hidden) {
        start();
      } else {
        stop();
      }
    });
    intersectionObserver.observe(host);

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else if (visible) {
        start();
      }
    };

    resize();
    applyMotionPreference();
    reduceMotion.addEventListener('change', applyMotionPreference);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      reduceMotion.removeEventListener('change', applyMotionPreference);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      for (const disposable of disposables) {
        disposable.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.state;
    };
  }, []);

  return (
    <div className="orbit" ref={hostRef} aria-hidden="true">
      <div className="orbit__fallback" />
    </div>
  );
}
