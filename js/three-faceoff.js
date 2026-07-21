import * as THREE from 'three';

/**
 * MMA Manager — 3D Face-off Scene
 * Two fighter silhouettes facing each other with dramatic lighting.
 * Responde a eventos de luta (knockdown, KO, vitória) com reações visuais.
 */
export class ThreeFaceOff {
  // Cor estável por lutador. Sem lutador → cor base do corner (vermelho/azul).
  // Com lutador, varia levemente o tom a partir de um hash do id/nome, mantendo
  // a família de cor do corner para não quebrar a leitura "vermelho vs azul".
  static _fighterColor(fighter, baseHex) {
    if (!fighter) return baseHex;
    const key = String(fighter.id ?? fighter.name ?? '');
    if (!key) return baseHex;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff;
    const base = new THREE.Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    // desloca o matiz em ±0.04 e a luminosidade em ±0.06 — variação sutil
    const hue = (hsl.h + ((h % 100) / 100 - 0.5) * 0.08 + 1) % 1;
    const light = Math.min(0.7, Math.max(0.3, hsl.l + (((h >> 8) % 100) / 100 - 0.5) * 0.12));
    return new THREE.Color().setHSL(hue, hsl.s, light).getHex();
  }

  constructor(containerId, fighterA = null, fighterB = null) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('ThreeFaceOff: container not found');
      return;
    }

    // Corner vermelho (esquerda) = fighterA (atleta do jogador, por convenção
    // do WorldService); azul (direita) = fighterB. Sem lutadores, cai nas cores
    // genéricas de sempre. Cor da nacionalidade tem prioridade se existir.
    this.fighterA = fighterA;
    this.fighterB = fighterB;
    this.redColor = ThreeFaceOff._fighterColor(fighterA, 0xc41e3a);
    this.blueColor = ThreeFaceOff._fighterColor(fighterB, 0x3a5a8a);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.redSpot = null;
    this.blueSpot = null;
    this.fighterGroups = { A: null, B: null };
    this.feedbackState = {
      dominance: 0, fatigue: 0, danger: 0, critical: false, turnaround: false,
      finish: false, winnerSide: null,
    };
    this._isShaking = false;
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
    this.createFighterSilhouette(-1.5, this.redColor, 'A');  // Red corner = fighterA
    this.createFighterSilhouette(1.5, this.blueColor, 'B');  // Blue corner = fighterB
    this.createGround();
    this.createParticles();

    window.addEventListener('resize', this._onResizeBound);
    this.animate();
  }

  createLights() {
    const ambient = new THREE.AmbientLight(0x1a1a1a, 0.2);
    this.scene.add(ambient);

    // Red spotlight (left fighter)
    this.redSpot = new THREE.SpotLight(this.redColor, 3, 15, Math.PI / 6, 0.6, 1);
    this.redSpot.position.set(-3, 5, 2);
    this.redSpot.target.position.set(-1.5, 1, 0);
    this.scene.add(this.redSpot);
    this.scene.add(this.redSpot.target);

    // Blue spotlight (right fighter)
    this.blueSpot = new THREE.SpotLight(this.blueColor, 3, 15, Math.PI / 6, 0.6, 1);
    this.blueSpot.position.set(3, 5, 2);
    this.blueSpot.target.position.set(1.5, 1, 0);
    this.scene.add(this.blueSpot);
    this.scene.add(this.blueSpot.target);

    // Center fill
    const fill = new THREE.PointLight(0x333333, 0.3, 8);
    fill.position.set(0, 3, 0);
    this.scene.add(fill);
  }

  createFighterSilhouette(xPos, color, side) {
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
    this.fighterGroups[side] = group;
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
        colors[i3] = 0.77; colors[i3 + 1] = 0.12; colors[i3 + 2] = 0.23;
      } else {
        colors[i3] = 0.23; colors[i3 + 1] = 0.35; colors[i3 + 2] = 0.54;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.02, vertexColors: true, transparent: true,
      opacity: 0.5, sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  // === Reações a eventos da luta ===

  // Estado descritivo da luta. Nunca recebe decis\u00f5es do motor de combate:
  // s\u00f3 resultados j\u00e1 acontecidos, para tornar transmiss\u00e3o leg\u00edvel.
  setFightState(state = {}) {
    const bounded = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    this.feedbackState = {
      ...this.feedbackState,
      dominance: bounded(state.dominance ?? this.feedbackState.dominance, -1, 1),
      fatigue: bounded(state.fatigue ?? this.feedbackState.fatigue, 0, 1),
      danger: bounded(state.danger ?? this.feedbackState.danger, 0, 1),
      critical: state.critical ?? this.feedbackState.critical,
      turnaround: state.turnaround ?? this.feedbackState.turnaround,
      finish: state.finish ?? this.feedbackState.finish,
      winnerSide: state.winnerSide ?? this.feedbackState.winnerSide,
    };
  }

  onKnockdown() {
    if (this.disposed || !this.redSpot || !this.blueSpot) return;
    this.setFightState({ danger: 1, critical: true });
    this._isShaking = true;
    // Flash momentâneo — intensifica os spots
    this.redSpot.intensity = 8;
    this.blueSpot.intensity = 8;
    // Camera shake sutil
    if (this.camera) {
      let shakeCount = 0;
      const shake = () => {
        if (shakeCount++ > 6 || this.disposed) {
          this.camera.position.x = 0;
          this.camera.position.y = 2;
          this._isShaking = false;
          return;
        }
        this.camera.position.x = (Math.random() - 0.5) * 0.3;
        this.camera.position.y = 2 + (Math.random() - 0.5) * 0.1;
        setTimeout(shake, 40);
      };
      shake();
    }
  }

  onFinish() {
    if (this.disposed) return;
    this.setFightState({ danger: 1, critical: true, finish: true });
    this._isShaking = true;
    // Flash mais intenso
    if (this.redSpot) this.redSpot.intensity = 10;
    if (this.blueSpot) this.blueSpot.intensity = 10;
    if (this.camera) {
      const shake = () => {
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            if (this.disposed || !this.camera) return;
            this.camera.position.x = (Math.random() - 0.5) * 0.5;
            this.camera.position.y = 2 + (Math.random() - 0.5) * 0.2;
          }, i * 50);
        }
        setTimeout(() => {
          if (!this.disposed && this.camera) {
            this.camera.position.x = 0;
            this.camera.position.y = 2;
          }
          this._isShaking = false;
        }, 500);
      };
      shake();
    }
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
    if (!this.renderer.domElement.isConnected) {
      this.dispose();
      return;
    }

    this._rafId = requestAnimationFrame(() => this.animate());

    const nowMs = performance.now();
    if (nowMs - this._lastFrame < 33) return;
    this._lastFrame = nowMs;

    const elapsed = this.clock.getElapsedTime();

    // Subtle camera sway (se não estiver em shake)
    if (this.camera && !this._isShaking) {
      this.camera.position.x = Math.sin(elapsed * 0.3) * 0.5;
      this.camera.lookAt(0, 1.2, 0);
    }

    const feedback = this.feedbackState;
    const redControl = Math.max(0, feedback.dominance);
    const blueControl = Math.max(0, -feedback.dominance);
    const criticalBoost = feedback.critical ? 0.8 : 0;
    const redTarget = 3 + redControl * 2.4 + criticalBoost;
    const blueTarget = 3 + blueControl * 2.4 + criticalBoost;
    if (this.redSpot) this.redSpot.intensity += (redTarget - this.redSpot.intensity) * 0.1;
    if (this.blueSpot) this.blueSpot.intensity += (blueTarget - this.blueSpot.intensity) * 0.1;

    const updateFighter = (group, control, side) => {
      if (!group) return;
      const won = feedback.finish && feedback.winnerSide === side;
      const lost = feedback.finish && feedback.winnerSide && feedback.winnerSide !== side;
      const targetScale = 1 + control * 0.09 - feedback.fatigue * 0.035 + (won ? 0.11 : 0) - (lost ? 0.07 : 0);
      const targetY = control * 0.08 + (won ? 0.1 : 0) - (lost ? 0.06 : 0);
      group.scale.x += (targetScale - group.scale.x) * 0.08;
      group.scale.y += (targetScale - group.scale.y) * 0.08;
      group.scale.z += (targetScale - group.scale.z) * 0.08;
      group.position.y += (targetY - group.position.y) * 0.08;
    };
    updateFighter(this.fighterGroups.A, redControl, 'A');
    updateFighter(this.fighterGroups.B, blueControl, 'B');

    // Animate particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += 0.003;
        if (positions[i + 1] > 3) positions[i + 1] = 0;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      const particleMaterial = this.particles.material;
      particleMaterial.size += (0.02 + feedback.danger * 0.025 - particleMaterial.size) * 0.08;
      particleMaterial.opacity += (0.5 + (feedback.critical ? 0.2 : 0) - particleMaterial.opacity) * 0.08;
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
