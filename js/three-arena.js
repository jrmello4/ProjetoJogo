import * as THREE from 'three';

// Definições de estado visual (F13) — cada estado define valores-alvo
// para luzes, emissão e partículas. O animate() faz lerp suave entre eles.
const STATE_DEFS = {
  idle: {
    redIntensity: 2, warmIntensity: 0.5, rimIntensity: 0.3,
    floorEmissive: 0x000000, floorEmissiveIntensity: 0,
    centerEmissiveIntensity: 0.15, centerColor: 0xc8202f,
    edgeOpacity: 0.6, beamOpacity: 0.02,
    particleSpeed: 0.002, rotateSpeed: 0.003,
  },
  champion: {
    redIntensity: 2.5, warmIntensity: 1.2, rimIntensity: 0.8,
    floorEmissive: 0xc9a227, floorEmissiveIntensity: 0.3,
    centerEmissiveIntensity: 0.5, centerColor: 0xc9a227,
    edgeOpacity: 0.9, beamOpacity: 0.06,
    particleSpeed: 0.004, rotateSpeed: 0.005,
  },
  streak: {
    redIntensity: 3, warmIntensity: 0.8, rimIntensity: 0.4,
    floorEmissive: 0xc8202f, floorEmissiveIntensity: 0.2,
    centerEmissiveIntensity: 0.4, centerColor: 0xff4444,
    edgeOpacity: 0.8, beamOpacity: 0.05,
    particleSpeed: 0.005, rotateSpeed: 0.004,
  },
  danger: {
    redIntensity: 1, warmIntensity: 0.2, rimIntensity: 0.5,
    floorEmissive: 0x880000, floorEmissiveIntensity: 0.15,
    centerEmissiveIntensity: 0.3, centerColor: 0xcc0000,
    edgeOpacity: 0.4, beamOpacity: 0.01,
    particleSpeed: 0.001, rotateSpeed: 0.001,
  },
  tranquil: {
    redIntensity: 1.2, warmIntensity: 0.3, rimIntensity: 0.6,
    floorEmissive: 0x2f6bbf, floorEmissiveIntensity: 0.15,
    centerEmissiveIntensity: 0.2, centerColor: 0x2f6bbf,
    edgeOpacity: 0.5, beamOpacity: 0.02,
    particleSpeed: 0.001, rotateSpeed: 0.002,
  },
};

/**
 * MMA Manager — 3D Octagon Arena
 * Renders an interactive 3D octagon cage on a canvas element.
 * Uses the existing dark theme colors for seamless integration.
 */
export class ThreeArena {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('ThreeArena: container not found');
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.octagon = null;
    this.cageMesh = null;
    this.particles = null;
    this.spotLights = [];
    this.arenaLights = { red: null, warm: null, rim: null };
    this.feedbackState = { dominance: 0, fatigue: 0, danger: 0, critical: false };
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotY = 0;
    this.isDragging = false;
    this.prevMouseX = 0;
    this.rotationVelocity = 0;
    this.autoRotate = true;
    this.clock = new THREE.Clock();
    this.disposed = false;
    this._rafId = null;
    this._lastFrame = 0;
    this._windowListeners = [];

    // F13 — estado reativo da arena
    this._state = { current: 'idle', target: 'idle' };
    this._stateLerp = 1; // 1 = fully at target
    this._dynMaterials = {};

    this.init();
  }

  _onWindow(type, handler, opts) {
    window.addEventListener(type, handler, opts);
    this._windowListeners.push([type, handler]);
  }

  init() {
    const { width, height } = this.container.getBoundingClientRect();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x14110f, 0.035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 6, 10);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Build scene
    this.createLights();
    this.createOctagon();
    this.createCage();
    this.createFloor();
    this.createParticles();
    this.createSpotlightBeams();

    // Events
    this.container.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      this.mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    this.container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouseX = e.clientX;
      this.autoRotate = false;
    });

    this._onWindow('mouseup', () => {
      this.isDragging = false;
    });

    this._onWindow('mousemove', (e) => {
      if (this.isDragging) {
        const delta = e.clientX - this.prevMouseX;
        this.targetRotY += delta * 0.005;
        this.rotationVelocity = delta * 0.005;
        this.prevMouseX = e.clientX;
      }
    });

    this.container.addEventListener('mouseleave', () => {
      this.isDragging = false;
      setTimeout(() => { this.autoRotate = true; }, 3000);
    });

    // Touch support
    this.container.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      this.prevMouseX = e.touches[0].clientX;
      this.autoRotate = false;
    });

    this._onWindow('touchend', () => {
      this.isDragging = false;
    });

    this._onWindow('touchmove', (e) => {
      if (this.isDragging) {
        const delta = e.touches[0].clientX - this.prevMouseX;
        this.targetRotY += delta * 0.005;
        this.rotationVelocity = delta * 0.005;
        this.prevMouseX = e.touches[0].clientX;
      }
    });

    // Resize
    this._onWindow('resize', () => this.onResize());

    // Start animation loop
    this.animate();
  }

  createLights() {
    // Ambient — very dim, cage is dark
    const ambient = new THREE.AmbientLight(0x1a1a1a, 0.3);
    this.scene.add(ambient);

    // Main red spotlight from above
    const spotRed = new THREE.SpotLight(0xc8202f, 2, 30, Math.PI / 6, 0.5, 1);
    spotRed.position.set(0, 12, 0);
    spotRed.target.position.set(0, 0, 0);
    spotRed.castShadow = true;
    spotRed.shadow.mapSize.set(512, 512);
    this.scene.add(spotRed);
    this.scene.add(spotRed.target);
    this._redSpot = spotRed;

    // Warm fill from side
    const spotWarm = new THREE.SpotLight(0xc9a227, 0.5, 20, Math.PI / 8, 0.8, 1);
    spotWarm.position.set(5, 8, 5);
    spotWarm.target.position.set(0, 0, 0);
    this.scene.add(spotWarm);
    this.scene.add(spotWarm.target);
    this._warmSpot = spotWarm;

    // Cool rim light
    const rim = new THREE.PointLight(0x2f6bbf, 0.3, 15);
    rim.position.set(-5, 4, -5);
    this.scene.add(rim);
    this.arenaLights = { red: spotRed, warm: spotWarm, rim };
  }

  createOctagon() {
    const group = new THREE.Group();

    // Octagon canvas (floor mat)
    const radius = 3;
    const shape = this.createOctagonShape(radius);
    const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.y = 0.05;
    group.add(mesh);

    // Inner octagon — red mat area
    const innerShape = this.createOctagonShape(radius * 0.85);
    const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.02, bevelEnabled: false });
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x24120f,
      roughness: 0.6,
      metalness: 0.05,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.receiveShadow = true;
    innerMesh.position.y = 0.1;
    group.add(innerMesh);
    this._floorMat = innerMat;

    // Center circle — logo area
    const circleGeo = new THREE.CircleGeometry(0.8, 32);
    const circleMat = new THREE.MeshStandardMaterial({
      color: 0xc8202f,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xc8202f,
      emissiveIntensity: 0.15,
    });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.12;
    group.add(circle);
    this._centerMat = circleMat;

    // Octagon edge lines (glowing)
    const edgePoints = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 8;
      edgePoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius));
    }
    edgePoints.push(edgePoints[0]);
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xc8202f,
      transparent: true,
      opacity: 0.6,
    });
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    group.add(edgeLine);
    this._edgeMat = edgeMat;

    this.octagon = group;
    this.scene.add(group);
  }

  createCage() {
    const group = new THREE.Group();
    const radius = 3.05;
    const height = 2.5;
    const postCount = 8;

    // Corner posts
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, height, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.3,
      metalness: 0.8,
    });

    for (let i = 0; i < postCount; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 8;
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      post.castShadow = true;
      group.add(post);

      // Horizontal ring at top
      const nextAngle = ((i + 1) * Math.PI) / 4 - Math.PI / 8;
      const startX = Math.cos(angle) * radius;
      const startZ = Math.sin(angle) * radius;
      const endX = Math.cos(nextAngle) * radius;
      const endZ = Math.sin(nextAngle) * radius;

      // Top rail
      const railPoints = [
        new THREE.Vector3(startX, height, startZ),
        new THREE.Vector3(endX, height, endZ),
      ];
      const railGeo = new THREE.BufferGeometry().setFromPoints(railPoints);
      const railMat = new THREE.LineBasicMaterial({ color: 0x5a5a5a });
      group.add(new THREE.Line(railGeo, railMat));

      // Mid rail
      const midRailPoints = [
        new THREE.Vector3(startX, height * 0.5, startZ),
        new THREE.Vector3(endX, height * 0.5, endZ),
      ];
      const midRailGeo = new THREE.BufferGeometry().setFromPoints(midRailPoints);
      group.add(new THREE.Line(midRailGeo, railMat));

      // Vertical wires between posts
      for (let w = 1; w <= 4; w++) {
        const wireY = (w / 5) * height;
        const wirePoints = [];
        for (let j = 0; j < postCount; j++) {
          const a = (j * Math.PI) / 4 - Math.PI / 8;
          wirePoints.push(new THREE.Vector3(Math.cos(a) * radius, wireY, Math.sin(a) * radius));
        }
        wirePoints.push(wirePoints[0]);
        const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePoints);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0x3a3a3a,
          transparent: true,
          opacity: 0.4,
        });
        group.add(new THREE.Line(wireGeo, wireMat));
      }
    }

    this.cageMesh = group;
    this.scene.add(group);
  }

  createFloor() {
    // Arena floor (dark, reflective)
    const floorGeo = new THREE.CircleGeometry(12, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x14110f,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  createParticles() {
    // Arena dust particles
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = 1 + Math.random() * 5;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.random() * 4;
      positions[i3 + 2] = Math.sin(angle) * radius;

      // Mix of red and gold particles
      if (Math.random() > 0.5) {
        colors[i3] = 0.77;     // red R
        colors[i3 + 1] = 0.12; // red G
        colors[i3 + 2] = 0.23; // red B
      } else {
        colors[i3] = 0.83;     // gold R
        colors[i3 + 1] = 0.66; // gold G
        colors[i3 + 2] = 0.26; // gold B
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  createSpotlightBeams() {
    // Volumetric-like light cones (fake with transparent cones)
    const beamGeo = new THREE.ConeGeometry(1.5, 8, 32, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xc8202f,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4;
    beam.rotation.x = Math.PI;
    this.scene.add(beam);
    this._beamMat = beamMat;
  }

  /** F13: define o estado visual da arena (idle|champion|streak|danger|tranquil) */
  setState(id) {
    if (STATE_DEFS[id]) {
      this._state.target = id;
      this._stateLerp = 0;
    }
  }

  _applyState(delta) {
    if (this._stateLerp >= 1) return;
    this._stateLerp = Math.min(1, this._stateLerp + delta * 2);
    const t = this._stateLerp;
    const from = STATE_DEFS[this._state.current];
    const to = STATE_DEFS[this._state.target];
    if (!from || !to) return;

    const lerp = (a, b) => a + (b - a) * t;
    const lerpColor = (ca, cb) => {
      const ra = (ca >> 16) & 0xff, ga = (ca >> 8) & 0xff, ba = ca & 0xff;
      const rb = (cb >> 16) & 0xff, gb = (cb >> 8) & 0xff, bb = cb & 0xff;
      return (Math.round(lerp(ra, rb)) << 16) | (Math.round(lerp(ga, gb)) << 8) | Math.round(lerp(ba, bb));
    };

    if (this._redSpot) this._redSpot.intensity = lerp(from.redIntensity, to.redIntensity);
    if (this._warmSpot) this._warmSpot.intensity = lerp(from.warmIntensity, to.warmIntensity);

    if (this._floorMat) {
      this._floorMat.emissive.setHex(lerpColor(from.floorEmissive, to.floorEmissive));
      this._floorMat.emissiveIntensity = lerp(from.floorEmissiveIntensity, to.floorEmissiveIntensity);
    }
    if (this._centerMat) {
      this._centerMat.color.setHex(lerpColor(from.centerColor, to.centerColor));
      this._centerMat.emissiveIntensity = lerp(from.centerEmissiveIntensity, to.centerEmissiveIntensity);
    }
    if (this._edgeMat) this._edgeMat.opacity = lerp(from.edgeOpacity, to.edgeOpacity);
    if (this._beamMat) this._beamMat.opacity = lerp(from.beamOpacity, to.beamOpacity);

    if (this.autoRotate) {
      this.targetRotY += lerp(from.rotateSpeed, to.rotateSpeed);
    }

    if (this.particles) this._particleVelocity = lerp(from.particleSpeed, to.particleSpeed);

    if (this._stateLerp >= 1) {
      this._state.current = this._state.target;
    }
  }

  createOctagonShape(radius) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 8;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();
    return shape;
  }

  // API comum com o face-off: o cenário reage a estado já decidido pelo
  // simulador, sem jamais influenciar placar, fadiga ou resultado.
  setFightState(state = {}) {
    const bounded = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    this.feedbackState = {
      ...this.feedbackState,
      dominance: bounded(state.dominance ?? this.feedbackState.dominance, -1, 1),
      fatigue: bounded(state.fatigue ?? this.feedbackState.fatigue, 0, 1),
      danger: bounded(state.danger ?? this.feedbackState.danger, 0, 1),
      critical: state.critical ?? this.feedbackState.critical,
    };
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

    // Navegação troca o innerHTML do mainContent sem avisar a cena;
    // quando o canvas sai do DOM, o loop precisa morrer junto.
    if (!this.renderer.domElement.isConnected) {
      this.dispose();
      return;
    }

    this._rafId = requestAnimationFrame(() => this.animate());

    // Cena decorativa: 30fps é suficiente e corta o custo de GPU pela metade
    const nowMs = performance.now();
    if (nowMs - this._lastFrame < 33) return;
    this._lastFrame = nowMs;

    // Auto rotation
    if (this.autoRotate) {
      this.targetRotY += 0.003;
    }

    // Drag inertia
    if (!this.isDragging && !this.autoRotate) {
      this.targetRotY += this.rotationVelocity;
      this.rotationVelocity *= 0.95;
      if (Math.abs(this.rotationVelocity) < 0.001) {
        this.autoRotate = true;
      }
    }

    // Smooth octagon rotation
    if (this.octagon) {
      this.octagon.rotation.y += (this.targetRotY - this.octagon.rotation.y) * 0.05;
    }

    if (this.cageMesh) {
      this.cageMesh.rotation.y += (this.targetRotY - this.cageMesh.rotation.y) * 0.05;
    }

    // Subtle camera sway from mouse
    if (this.camera) {
      this.camera.position.x += (this.mouseX * 2 - this.camera.position.x) * 0.02;
      this.camera.position.y += (6 + this.mouseY * -1 - this.camera.position.y) * 0.02;
      this.camera.lookAt(0, 0, 0);
    }

    this._applyState(0.016);

    const feedback = this.feedbackState;
    const redControl = Math.max(0, feedback.dominance);
    const blueControl = Math.max(0, -feedback.dominance);
    if (this.arenaLights.red) {
      const target = 2 + redControl * 1.3 + feedback.danger * 0.7;
      this.arenaLights.red.intensity += (target - this.arenaLights.red.intensity) * 0.05;
    }
    if (this.arenaLights.warm) {
      const target = 0.5 + feedback.danger * 0.55 + (feedback.critical ? 0.3 : 0);
      this.arenaLights.warm.intensity += (target - this.arenaLights.warm.intensity) * 0.05;
    }
    if (this.arenaLights.rim) {
      const target = 0.3 + blueControl * 0.9 + feedback.fatigue * 0.2;
      this.arenaLights.rim.intensity += (target - this.arenaLights.rim.intensity) * 0.05;
    }

    // Animate particles — velocidade dinâmica (F13)
    if (this.particles) {
      const speed = this._particleVelocity ?? 0.002;
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += speed;
        if (positions[i + 1] > 4) {
          positions[i + 1] = 0;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.rotation.y += 0.001;
      const particleMaterial = this.particles.material;
      particleMaterial.size += (0.03 + feedback.danger * 0.02 - particleMaterial.size) * 0.05;
      particleMaterial.opacity += (0.6 + (feedback.critical ? 0.15 : 0) - particleMaterial.opacity) * 0.05;
    }

    // F13: transição suave de estado visual
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._windowListeners.forEach(([type, handler]) => {
      window.removeEventListener(type, handler);
    });
    this._windowListeners = [];

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
