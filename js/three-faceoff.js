import * as THREE from 'three';

/**
 * MMA Manager — 3D Face-off Scene
 * Two fighter silhouettes facing each other with dramatic lighting.
 */
export class ThreeFaceOff {
  constructor(containerId, fighterA, fighterB) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('ThreeFaceOff: container not found');
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.disposed = false;
    this._rafId = null;
    this._lastFrame = 0;
    this._onResizeBound = () => this.onResize();
    this.init();
  }

  init() {
    const { width, height } = this.container.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c0c0c, 0.06);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.createLights();
    this.createFighterSilhouette(-1.5, 0xc41e3a); // Red side
    this.createFighterSilhouette(1.5, 0x3a5a8a);  // Blue side
    this.createGround();
    this.createParticles();

    window.addEventListener('resize', this._onResizeBound);
    this.animate();
  }

  createLights() {
    const ambient = new THREE.AmbientLight(0x1a1a1a, 0.2);
    this.scene.add(ambient);

    // Red spotlight (left fighter)
    const redSpot = new THREE.SpotLight(0xc41e3a, 3, 15, Math.PI / 6, 0.6, 1);
    redSpot.position.set(-3, 5, 2);
    redSpot.target.position.set(-1.5, 1, 0);
    this.scene.add(redSpot);
    this.scene.add(redSpot.target);

    // Blue spotlight (right fighter)
    const blueSpot = new THREE.SpotLight(0x3a5a8a, 3, 15, Math.PI / 6, 0.6, 1);
    blueSpot.position.set(3, 5, 2);
    blueSpot.target.position.set(1.5, 1, 0);
    this.scene.add(blueSpot);
    this.scene.add(blueSpot.target);

    // Center fill
    const fill = new THREE.PointLight(0x333333, 0.3, 8);
    fill.position.set(0, 3, 0);
    this.scene.add(fill);
  }

  createFighterSilhouette(xPos, color) {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.4,
      metalness: 0.3,
      emissive: color,
      emissiveIntensity: 0.1,
    });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), mat);
    head.position.y = 2.2;
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.8, 12), mat);
    torso.position.y = 1.5;
    group.add(torso);

    // Shoulders
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.2), mat);
    shoulder.position.y = 1.9;
    group.add(shoulder);

    // Arms (fighting stance)
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(xPos > 0 ? -0.4 : 0.4, 1.7, 0.2);
    leftArm.rotation.z = xPos > 0 ? 0.5 : -0.5;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set(xPos > 0 ? -0.3 : 0.3, 1.8, 0.35);
    rightArm.rotation.z = xPos > 0 ? 0.3 : -0.3;
    rightArm.rotation.x = -0.3;
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 8);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-0.15, 0.6, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(0.15, 0.6, 0);
    group.add(rightLeg);

    // Glow aura
    const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.05,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 1.5;
    group.add(glow);

    group.position.x = xPos;
    this.scene.add(group);
  }

  createGround() {
    const floorGeo = new THREE.PlaneGeometry(20, 10);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c0c,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Center line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, -3),
      new THREE.Vector3(0, 0.01, 3),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.3,
    });
    this.scene.add(new THREE.Line(lineGeo, lineMat));
  }

  createParticles() {
    const count = 80;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 8;
      positions[i3 + 1] = Math.random() * 3;
      positions[i3 + 2] = (Math.random() - 0.5) * 4;

      if (Math.random() > 0.5) {
        colors[i3] = 0.77;
        colors[i3 + 1] = 0.12;
        colors[i3 + 2] = 0.23;
      } else {
        colors[i3] = 0.23;
        colors[i3 + 1] = 0.35;
        colors[i3 + 2] = 0.54;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
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

    // Se a navegação removeu o canvas do DOM, encerra o loop junto
    if (!this.renderer.domElement.isConnected) {
      this.dispose();
      return;
    }

    this._rafId = requestAnimationFrame(() => this.animate());

    // Cena decorativa: 30fps é suficiente
    const nowMs = performance.now();
    if (nowMs - this._lastFrame < 33) return;
    this._lastFrame = nowMs;

    const elapsed = this.clock.getElapsedTime();

    // Subtle camera sway
    this.camera.position.x = Math.sin(elapsed * 0.3) * 0.5;
    this.camera.lookAt(0, 1.2, 0);

    // Animate particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += 0.003;
        if (positions[i + 1] > 3) positions[i + 1] = 0;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
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
    window.removeEventListener('resize', this._onResizeBound);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
  }
}
