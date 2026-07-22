import * as THREE from 'three';

/**
 * MMA Manager — Ambient 3D Background Particles
 * Subtle floating particles behind the main content area.
 */
export class ThreeBackground {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('ThreeBackground: container not found');
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.clock = new THREE.Clock();
    this.disposed = false;
    this._rafId = null;
    this._lastFrame = 0;
    this.init();
  }

  init() {
    const { width, height } = this.container.getBoundingClientRect();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 50);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setSize(width, height);
    // Deliberately chunky background pixels; CSS performs the final upscale.
    this.renderer.setPixelRatio(0.6);
    this.renderer.setClearColor(0x000000, 0);

    // Insert canvas behind everything
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '0';
    this.container.style.position = 'relative';
    this.container.insertBefore(canvas, this.container.firstChild);

    this.createParticles();

    this._onResizeBound = () => this.onResize();
    window.addEventListener('resize', this._onResizeBound);
    this.animate();
  }

  createParticles() {
    const count = 100;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;

      // Subtle red/gold tint
      const isRed = Math.random() > 0.7;
      colors[i3] = isRed ? 0.15 : 0.05;
      colors[i3 + 1] = isRed ? 0.02 : 0.02;
      colors[i3 + 2] = isRed ? 0.04 : 0.03;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  onResize() {
    if (!this.container || !this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    if (this.disposed) return;
    this._rafId = requestAnimationFrame(() => this.animate());

    // Fundo decorativo: 30fps basta
    const nowMs = performance.now();
    if (nowMs - this._lastFrame < 33) return;
    this._lastFrame = nowMs;

    // Cada troca de tela apaga o innerHTML do container e leva o canvas
    // junto — religa em vez de renderizar num canvas desconectado.
    const canvas = this.renderer.domElement;
    if (!canvas.isConnected) {
      if (!this.container.isConnected) return; // container sumiu: não renderiza
      this.container.insertBefore(canvas, this.container.firstChild);
    }

    const elapsed = this.clock.getElapsedTime();

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(elapsed * 0.1 + i) * 0.001;
        positions[i + 1] += Math.cos(elapsed * 0.08 + i) * 0.001;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.rotation.y += 0.0002;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._onResizeBound) {
      window.removeEventListener('resize', this._onResizeBound);
      this._onResizeBound = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
