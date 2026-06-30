import * as THREE from 'three';

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
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotY = 0;
    this.isDragging = false;
    this.prevMouseX = 0;
    this.rotationVelocity = 0;
    this.autoRotate = true;
    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const { width, height } = this.container.getBoundingClientRect();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c0c0c, 0.035);

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
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

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        const delta = e.touches[0].clientX - this.prevMouseX;
        this.targetRotY += delta * 0.005;
        this.rotationVelocity = delta * 0.005;
        this.prevMouseX = e.touches[0].clientX;
      }
    });

    // Resize
    window.addEventListener('resize', () => this.onResize());

    // Start animation loop
    this.animate();
  }

  createLights() {
    // Ambient — very dim, cage is dark
    const ambient = new THREE.AmbientLight(0x1a1a1a, 0.3);
    this.scene.add(ambient);

    // Main red spotlight from above
    const spotRed = new THREE.SpotLight(0xc41e3a, 2, 30, Math.PI / 6, 0.5, 1);
    spotRed.position.set(0, 12, 0);
    spotRed.target.position.set(0, 0, 0);
    spotRed.castShadow = true;
    spotRed.shadow.mapSize.set(1024, 1024);
    this.scene.add(spotRed);
    this.scene.add(spotRed.target);

    // Warm fill from side
    const spotWarm = new THREE.SpotLight(0xd4a843, 0.5, 20, Math.PI / 8, 0.8, 1);
    spotWarm.position.set(5, 8, 5);
    spotWarm.target.position.set(0, 0, 0);
    this.scene.add(spotWarm);
    this.scene.add(spotWarm.target);

    // Cool rim light
    const rim = new THREE.PointLight(0x3a3a5a, 0.3, 15);
    rim.position.set(-5, 4, -5);
    this.scene.add(rim);
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
      color: 0x2a0a12,
      roughness: 0.6,
      metalness: 0.05,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.receiveShadow = true;
    innerMesh.position.y = 0.1;
    group.add(innerMesh);

    // Center circle — logo area
    const circleGeo = new THREE.CircleGeometry(0.8, 32);
    const circleMat = new THREE.MeshStandardMaterial({
      color: 0xc41e3a,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xc41e3a,
      emissiveIntensity: 0.15,
    });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.12;
    group.add(circle);

    // Octagon edge lines (glowing)
    const edgePoints = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 8;
      edgePoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius));
    }
    edgePoints.push(edgePoints[0]);
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xc41e3a,
      transparent: true,
      opacity: 0.6,
    });
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    group.add(edgeLine);

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
      color: 0x0c0c0c,
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
      color: 0xc41e3a,
      transparent: true,
      opacity: 0.02,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4;
    beam.rotation.x = Math.PI;
    this.scene.add(beam);
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

  onResize() {
    if (!this.container || !this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const elapsed = this.clock.getElapsedTime();

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

    // Animate particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += 0.002;
        if (positions[i + 1] > 4) {
          positions[i + 1] = 0;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.rotation.y += 0.001;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
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
