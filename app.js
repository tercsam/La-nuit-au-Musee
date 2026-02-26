// ═══════════════════════════════════════════
//  L'OBSERVATOIRE DES MONDES — Improved
// ═══════════════════════════════════════════

const $ = id => document.getElementById(id);

// ── Starfield ──
(function initStarfield() {
  const c = $('star-canvas');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize() {
    c.width = window.innerWidth * devicePixelRatio;
    c.height = window.innerHeight * devicePixelRatio;
    c.style.width = window.innerWidth + 'px';
    c.style.height = window.innerHeight + 'px';
    stars = Array.from({length: 260}, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.3,
      a: Math.random(),
      speed: Math.random() * 0.008 + 0.002,
      phase: Math.random() * Math.PI * 2
    }));
  }
  resize();
  window.addEventListener('resize', resize);
  function draw(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of stars) {
      const flicker = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      ctx.globalAlpha = s.a * flicker * 0.8;
      ctx.fillStyle = '#f0e6ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// ── Screens ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 2500);
}

// ══════════════════════════════════════════
//  CAMERA / CAPTURE
// ══════════════════════════════════════════
let videoStream = null;

async function startCamera() {
  showScreen('screen-camera');
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    $('video-feed').srcObject = videoStream;
  } catch (e) {
    console.warn('Camera not available:', e);
    toast('Caméra indisponible — utilise "Importer"');
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
    $('video-feed').srcObject = null;
  }
}

// Capture the circular region from the video that matches the guide circle
function captureFromVideo() {
  const video = $('video-feed');
  if (!video.srcObject) return;
  const c = $('capture-canvas');

  // The guide circle is 75% of the smallest viewport dimension
  // We need to extract the equivalent region from the video
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Video is displayed with object-fit: cover, so we need to figure out
  // which part of the video is actually visible and where the circle maps to
  const dispW = window.innerWidth;
  const dispH = window.innerHeight;
  const videoAspect = vw / vh;
  const dispAspect = dispW / dispH;

  let srcW, srcH, srcX, srcY;
  if (videoAspect > dispAspect) {
    // Video is wider — height fits, width cropped
    srcH = vh;
    srcW = vh * dispAspect;
    srcX = (vw - srcW) / 2;
    srcY = 0;
  } else {
    // Video is taller — width fits, height cropped
    srcW = vw;
    srcH = vw / dispAspect;
    srcX = 0;
    srcY = (vh - srcH) / 2;
  }

  // The guide circle is centered and sized at min(75vw, 75vh) in display coords
  const circleDispSize = Math.min(dispW * 0.75, dispH * 0.75);
  // Scale factor from display to video source
  const scale = srcW / dispW;
  const circleSrcSize = circleDispSize * scale;

  // Center of the visible area in source coords
  const centerSrcX = srcX + srcW / 2;
  const centerSrcY = srcY + srcH / 2;

  const extractX = centerSrcX - circleSrcSize / 2;
  const extractY = centerSrcY - circleSrcSize / 2;

  const size = Math.round(circleSrcSize);
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.drawImage(video, extractX, extractY, circleSrcSize, circleSrcSize, 0, 0, size, size);

  stopCamera();
  processImage(c);
}

function captureFromFile(file) {
  const img = new Image();
  img.onload = () => {
    const c = $('capture-canvas');
    const size = Math.min(img.width, img.height);
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const ox = (img.width - size) / 2;
    const oy = (img.height - size) / 2;
    ctx.drawImage(img, ox, oy, size, size, 0, 0, size, size);
    stopCamera();
    processImage(c);
  };
  img.src = URL.createObjectURL(file);
}

// ══════════════════════════════════════════
//  TEXTURE PROCESSING — Improved Equirectangular
// ══════════════════════════════════════════
function processImage(sourceCanvas) {
  showScreen('screen-loading');

  setTimeout(() => {
    const TEX_W = 2048;
    const TEX_H = 1024;

    const texCanvas = $('texture-canvas');
    texCanvas.width = TEX_W;
    texCanvas.height = TEX_H;
    const ctx = texCanvas.getContext('2d');

    // Step 1: Extract circular region from source with feathered edge
    const srcSize = sourceCanvas.width;
    const circCanvas = document.createElement('canvas');
    circCanvas.width = srcSize;
    circCanvas.height = srcSize;
    const cctx = circCanvas.getContext('2d');

    // Draw source
    cctx.drawImage(sourceCanvas, 0, 0);

    // Compute average border color for seamless fill
    const srcData = cctx.getImageData(0, 0, srcSize, srcSize);
    const px = srcData.data;
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    const half = srcSize / 2;
    const radius = half * 0.95;
    // Sample pixels near the edge of the circle
    for (let y = 0; y < srcSize; y++) {
      for (let x = 0; x < srcSize; x++) {
        const dx = x - half, dy = y - half;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius * 0.85 && dist < radius) {
          const i = (y * srcSize + x) * 4;
          rSum += px[i]; gSum += px[i+1]; bSum += px[i+2];
          count++;
        }
      }
    }
    const avgR = count ? Math.round(rSum / count) : 128;
    const avgG = count ? Math.round(gSum / count) : 128;
    const avgB = count ? Math.round(bSum / count) : 128;
    const bgColor = `rgb(${avgR},${avgG},${avgB})`;

    // Step 2: Build equirectangular projection
    // Fill background with average edge color (for poles)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    // We'll project the circular drawing onto the sphere using
    // an equirectangular map. The drawing is treated as an azimuthal
    // projection (like looking straight at one hemisphere).
    // We paint it on the front face, then blend-mirror for the back.

    // Draw the main image centered (covers ~180° longitude)
    const mainW = TEX_W / 2;
    const offsetX = TEX_W / 4; // center it

    // Draw the source scaled to fill the center portion
    ctx.drawImage(sourceCanvas, offsetX, 0, mainW, TEX_H);

    // Apply circular vignette fade at the edges of the drawn region
    // so it blends smoothly into the background color at the sides
    const vignetteWidth = mainW * 0.15;

    // Left fade
    const gradL = ctx.createLinearGradient(offsetX, 0, offsetX + vignetteWidth, 0);
    gradL.addColorStop(0, bgColor);
    gradL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(offsetX, 0, vignetteWidth, TEX_H);

    // Right fade
    const gradR = ctx.createLinearGradient(offsetX + mainW, 0, offsetX + mainW - vignetteWidth, 0);
    gradR.addColorStop(0, bgColor);
    gradR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(offsetX + mainW - vignetteWidth, 0, vignetteWidth, TEX_H);

    // Top fade (pole blend)
    const gradT = ctx.createLinearGradient(0, 0, 0, TEX_H * 0.12);
    gradT.addColorStop(0, bgColor);
    gradT.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradT;
    ctx.fillRect(0, 0, TEX_W, TEX_H * 0.12);

    // Bottom fade (pole blend)
    const gradB = ctx.createLinearGradient(0, TEX_H, 0, TEX_H * 0.88);
    gradB.addColorStop(0, bgColor);
    gradB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradB;
    ctx.fillRect(0, TEX_H * 0.88, TEX_W, TEX_H * 0.12);

    // Step 3: Fill the back hemisphere with a mirrored + color-shifted version
    // This gives variety on the back side instead of plain color
    const backCanvas = document.createElement('canvas');
    backCanvas.width = TEX_W / 2;
    backCanvas.height = TEX_H;
    const bctx = backCanvas.getContext('2d');

    // Draw mirrored + slightly rotated version of source
    bctx.save();
    bctx.translate(backCanvas.width, 0);
    bctx.scale(-1, 1);
    bctx.drawImage(sourceCanvas, 0, 0, backCanvas.width, backCanvas.height);
    bctx.restore();

    // Tint it slightly to differentiate
    bctx.fillStyle = 'rgba(' + avgR + ',' + avgG + ',' + avgB + ',0.3)';
    bctx.fillRect(0, 0, backCanvas.width, backCanvas.height);

    // Draw back hemisphere on the left and right edges of the equirectangular map
    const backHalfW = TEX_W / 4;

    // Left side (0 to offsetX)
    ctx.globalAlpha = 0.7;
    ctx.drawImage(backCanvas, backCanvas.width / 2, 0, backCanvas.width / 2, backCanvas.height,
                  0, 0, backHalfW, TEX_H);

    // Right side (offsetX + mainW to TEX_W)
    ctx.drawImage(backCanvas, 0, 0, backCanvas.width / 2, backCanvas.height,
                  offsetX + mainW, 0, backHalfW, TEX_H);
    ctx.globalAlpha = 1.0;

    // Step 4: Blend the seams between front and back at offsetX and offsetX+mainW
    const seamW = TEX_W * 0.06;

    // Left seam
    const seamL = ctx.createLinearGradient(offsetX - seamW/2, 0, offsetX + seamW/2, 0);
    seamL.addColorStop(0, bgColor.replace('rgb', 'rgba').replace(')', ',0.4)'));
    seamL.addColorStop(0.5, bgColor.replace('rgb', 'rgba').replace(')', ',0.15)'));
    seamL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = seamL;
    ctx.fillRect(offsetX - seamW/2, 0, seamW, TEX_H);

    // Right seam
    const seamR = ctx.createLinearGradient(offsetX + mainW + seamW/2, 0, offsetX + mainW - seamW/2, 0);
    seamR.addColorStop(0, bgColor.replace('rgb', 'rgba').replace(')', ',0.4)'));
    seamR.addColorStop(0.5, bgColor.replace('rgb', 'rgba').replace(')', ',0.15)'));
    seamR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = seamR;
    ctx.fillRect(offsetX + mainW - seamW/2, 0, seamW, TEX_H);

    // Step 5: Make the horizontal wrap seamless (left edge must match right edge)
    // Copy a thin strip from the middle to blend at the wrap boundary
    const wrapBlend = TEX_W * 0.04;
    const wrapCanvas = document.createElement('canvas');
    wrapCanvas.width = TEX_W;
    wrapCanvas.height = TEX_H;
    const wctx = wrapCanvas.getContext('2d');
    wctx.drawImage(texCanvas, 0, 0);

    // Blend the left and right edges together
    for (let x = 0; x < wrapBlend; x++) {
      const alpha = x / wrapBlend; // 0 at left edge, 1 at wrapBlend
      const rightX = TEX_W - wrapBlend + x;

      // Read columns from both sides
      const leftCol = ctx.getImageData(x, 0, 1, TEX_H);
      const rightCol = ctx.getImageData(rightX, 0, 1, TEX_H);

      for (let y = 0; y < TEX_H; y++) {
        const i = y * 4;
        leftCol.data[i]     = Math.round(leftCol.data[i] * alpha + rightCol.data[i] * (1 - alpha));
        leftCol.data[i + 1] = Math.round(leftCol.data[i+1] * alpha + rightCol.data[i+1] * (1 - alpha));
        leftCol.data[i + 2] = Math.round(leftCol.data[i+2] * alpha + rightCol.data[i+2] * (1 - alpha));

        rightCol.data[i]     = Math.round(rightCol.data[i] * (1 - alpha) + leftCol.data[i] * alpha);
        rightCol.data[i + 1] = Math.round(rightCol.data[i+1] * (1 - alpha) + leftCol.data[i+1] * alpha);
        rightCol.data[i + 2] = Math.round(rightCol.data[i+2] * (1 - alpha) + leftCol.data[i+2] * alpha);
      }

      ctx.putImageData(leftCol, x, 0);
      ctx.putImageData(rightCol, rightX, 0);
    }

    buildPlanet(texCanvas);
  }, 2200);
}

// ══════════════════════════════════════════
//  THREE.JS PLANET
// ══════════════════════════════════════════
let scene, camera, renderer, planet, atmosphere;
let isUserInteracting = false;
let autoRotateSpeed = 0.002;
let mouseDown = false;
let prevMouse = { x: 0, y: 0 };
let rotVel = { x: 0, y: 0 };
let accessoryGroup = null;

// ══════════════════════════════════════════
//  ACCESSORIES — Procedural space objects
// ══════════════════════════════════════════

function createAsteroid(size) {
  // Deformed sphere with noise for rocky look
  const geo = new THREE.IcosahedronGeometry(size, 2);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const noise = 1 + (Math.sin(x * 12) * Math.cos(y * 8) * Math.sin(z * 10)) * 0.3;
    positions.setXYZ(i, x * noise, y * noise, z * noise);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a7a6a,
    roughness: 0.95,
    metalness: 0.1,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

function createAsteroidBelt() {
  const group = new THREE.Group();
  const count = 12 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const radius = 1.6 + Math.random() * 0.4;
    const size = 0.015 + Math.random() * 0.035;
    const asteroid = createAsteroid(size);
    asteroid.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * 0.15,
      Math.sin(angle) * radius
    );
    asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(asteroid);
  }
  group.userData.type = 'asteroidBelt';
  group.userData.rotSpeed = 0.0008 + Math.random() * 0.0005;
  return group;
}

function createRings() {
  const group = new THREE.Group();

  // Main ring
  const ringGeo = new THREE.RingGeometry(1.25, 1.75, 128);
  // Color the ring with radial gradient via vertex colors
  const colors = [];
  const positions = ringGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getY(i); // RingGeometry is in XY plane
    const dist = Math.sqrt(x * x + z * z);
    const t = (dist - 1.25) / 0.5;
    // Golden/amber rings with opacity variation
    const band = Math.sin(t * Math.PI * 6) * 0.15 + 0.85;
    colors.push(0.85 * band, 0.7 * band, 0.45 * band);
  }
  ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const ringMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    roughness: 0.7,
    metalness: 0.2,
  });

  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  // Inner subtle ring
  const innerGeo = new THREE.RingGeometry(1.15, 1.24, 96);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xaa8855,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,
    roughness: 0.8,
  });
  const innerRing = new THREE.Mesh(innerGeo, innerMat);
  innerRing.rotation.x = Math.PI / 2;
  group.add(innerRing);

  group.rotation.x = THREE.MathUtils.degToRad(15);
  group.rotation.z = THREE.MathUtils.degToRad(5);
  group.userData.type = 'rings';
  return group;
}

function createRocket() {
  const group = new THREE.Group();

  // Body — cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.18, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.03, 0.08, 12);
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.4, metalness: 0.3 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.y = 0.13;
  group.add(nose);

  // Fins (3 fins around the base)
  for (let i = 0; i < 3; i++) {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.04, 0);
    finShape.lineTo(0, 0.07);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.004, bevelEnabled: false });
    const finMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.y = -0.09;
    fin.position.x = -0.002;
    fin.rotation.y = (i / 3) * Math.PI * 2;
    fin.translateX(0.025);
    group.add(fin);
  }

  // Window porthole
  const windowGeo = new THREE.CircleGeometry(0.012, 16);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2288aa, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.8 });
  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  windowMesh.position.set(0.031, 0.04, 0);
  windowMesh.rotation.y = Math.PI / 2;
  group.add(windowMesh);

  // Flame — animated via shader
  const flameGeo = new THREE.ConeGeometry(0.025, 0.1, 8);
  const flameMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        float t = vUv.y;
        float flicker = 0.8 + 0.2 * sin(time * 15.0 + t * 10.0);
        vec3 col = mix(vec3(1.0, 0.9, 0.2), vec3(1.0, 0.3, 0.05), t) * flicker;
        float alpha = (1.0 - t) * 0.9 * flicker;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    uniforms: { time: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = -0.14;
  flame.rotation.x = Math.PI; // point downward
  group.add(flame);

  // Orbit parameters
  const orbitRadius = 1.8 + Math.random() * 0.6;
  const orbitSpeed = 0.4 + Math.random() * 0.3;
  const orbitTilt = (Math.random() - 0.5) * 0.6;
  group.userData.type = 'rocket';
  group.userData.orbit = { radius: orbitRadius, speed: orbitSpeed, tilt: orbitTilt, angle: Math.random() * Math.PI * 2 };
  group.userData.flameMat = flameMat;

  return group;
}

function createUFO() {
  const group = new THREE.Group();

  // Main disc (squashed sphere)
  const discGeo = new THREE.SphereGeometry(0.08, 24, 12);
  discGeo.scale(1, 0.3, 1);
  const discMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.7 });
  const disc = new THREE.Mesh(discGeo, discMat);
  group.add(disc);

  // Dome on top
  const domeGeo = new THREE.SphereGeometry(0.04, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x2266aa,
    emissiveIntensity: 0.3,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 0.015;
  group.add(dome);

  // Rim lights around edge
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lightGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 1.0,
    });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(Math.cos(angle) * 0.075, -0.005, Math.sin(angle) * 0.075);
    light.userData.rimLight = true;
    light.userData.phase = i;
    group.add(light);
  }

  // Tractor beam (cone of light below)
  const beamGeo = new THREE.ConeGeometry(0.06, 0.2, 16, 1, true);
  const beamMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      void main() {
        float t = vUv.y;
        float pulse = 0.5 + 0.5 * sin(time * 3.0 + t * 8.0);
        vec3 col = vec3(0.1, 1.0, 0.5) * pulse;
        float alpha = (1.0 - t) * 0.2 * pulse;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    uniforms: { time: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -0.12;
  group.add(beam);

  // Orbit
  const orbitRadius = 1.7 + Math.random() * 0.5;
  const orbitSpeed = 0.2 + Math.random() * 0.2;
  group.userData.type = 'ufo';
  group.userData.orbit = { radius: orbitRadius, speed: orbitSpeed, tilt: (Math.random() - 0.5) * 0.4, angle: Math.random() * Math.PI * 2 };
  group.userData.beamMat = beamMat;

  return group;
}

function pickAccessories() {
  // Random selection — sometimes nothing, sometimes 1-2 accessories
  const roll = Math.random();
  const accessories = [];

  if (roll < 0.25) {
    // 25% chance: nothing
    return accessories;
  } else if (roll < 0.45) {
    // 20% chance: rings only
    accessories.push(createRings());
  } else if (roll < 0.62) {
    // 17% chance: asteroid belt
    accessories.push(createAsteroidBelt());
  } else if (roll < 0.76) {
    // 14% chance: rocket
    accessories.push(createRocket());
  } else if (roll < 0.87) {
    // 11% chance: UFO
    accessories.push(createUFO());
  } else if (roll < 0.94) {
    // 7% chance: rings + rocket
    accessories.push(createRings());
    accessories.push(createRocket());
  } else {
    // 6% chance: asteroid belt + UFO
    accessories.push(createAsteroidBelt());
    accessories.push(createUFO());
  }

  return accessories;
}

function animateAccessories(time) {
  if (!accessoryGroup) return;
  accessoryGroup.children.forEach(obj => {
    const data = obj.userData;

    if (data.type === 'asteroidBelt') {
      obj.rotation.y += data.rotSpeed;
    }

    if (data.type === 'rings') {
      obj.rotation.z = THREE.MathUtils.degToRad(5) + Math.sin(time * 0.3) * 0.02;
    }

    if (data.type === 'rocket') {
      const o = data.orbit;
      o.angle += o.speed * 0.01;
      obj.position.set(
        Math.cos(o.angle) * o.radius,
        Math.sin(o.angle * 0.7) * o.tilt,
        Math.sin(o.angle) * o.radius
      );
      // Point rocket in direction of travel
      const nextAngle = o.angle + 0.05;
      const lookX = Math.cos(nextAngle) * o.radius;
      const lookZ = Math.sin(nextAngle) * o.radius;
      obj.lookAt(lookX, obj.position.y, lookZ);
      obj.rotateX(Math.PI / 2);
      // Animate flame
      if (data.flameMat) data.flameMat.uniforms.time.value = time;
    }

    if (data.type === 'ufo') {
      const o = data.orbit;
      o.angle += o.speed * 0.008;
      obj.position.set(
        Math.cos(o.angle) * o.radius,
        Math.sin(o.angle * 1.3) * o.tilt + 0.2,
        Math.sin(o.angle) * o.radius
      );
      // Gentle wobble
      obj.rotation.x = Math.sin(time * 1.5) * 0.1;
      obj.rotation.z = Math.cos(time * 1.2) * 0.08;
      // Animate beam
      if (data.beamMat) data.beamMat.uniforms.time.value = time;
      // Animate rim lights
      obj.children.forEach(child => {
        if (child.userData.rimLight) {
          const pulse = 0.4 + 0.6 * Math.sin(time * 5 + child.userData.phase * 0.8);
          child.material.emissiveIntensity = pulse;
        }
      });
    }
  });
}

function buildPlanet(textureCanvas) {
  const container = $('three-canvas');

  if (renderer) {
    renderer.dispose();
    container.innerHTML = '';
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Generate a bump map with more contrast for surface detail
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = textureCanvas.width;
  bumpCanvas.height = textureCanvas.height;
  const bmpCtx = bumpCanvas.getContext('2d');
  bmpCtx.drawImage(textureCanvas, 0, 0);
  // Increase contrast for bump
  bmpCtx.filter = 'contrast(1.8) grayscale(1)';
  bmpCtx.drawImage(textureCanvas, 0, 0);
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;

  const geo = new THREE.SphereGeometry(1, 128, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.72,
    metalness: 0.05,
    bumpMap: bumpTexture,
    bumpScale: 0.018,
  });
  planet = new THREE.Mesh(geo, mat);
  planet.rotation.z = THREE.MathUtils.degToRad(23.4);
  scene.add(planet);

  // Atmosphere
  const atmoGeo = new THREE.SphereGeometry(1.04, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(0.45, 0.6, 1.0, 1.0) * intensity * 0.6;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  scene.add(atmosphere);

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sunLight.position.set(5, 2, 3);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x4466aa, 0.15);
  fillLight.position.set(-5, -1, -2);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x222244, 0.2);
  scene.add(ambient);

  const rimLight = new THREE.DirectionalLight(0xffd475, 0.5);
  rimLight.position.set(-3, 0, -5);
  scene.add(rimLight);

  // Spawn random accessories
  accessoryGroup = new THREE.Group();
  const accessories = pickAccessories();
  accessories.forEach(a => accessoryGroup.add(a));
  scene.add(accessoryGroup);

  setupPlanetInteraction(container);

  rotVel = { x: 0, y: 0 };
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    if (!isUserInteracting) {
      planet.rotation.y += autoRotateSpeed;
    }
    if (!mouseDown) {
      rotVel.x *= 0.95;
      rotVel.y *= 0.95;
      planet.rotation.y += rotVel.x;
      planet.rotation.x += rotVel.y;
    }
    atmosphere.rotation.copy(planet.rotation);

    // Animate accessories
    animateAccessories(elapsed);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  showScreen('screen-planet');
}

function setupPlanetInteraction(canvas) {
  function onStart(e) {
    mouseDown = true;
    isUserInteracting = true;
    const p = e.touches ? e.touches[0] : e;
    prevMouse = { x: p.clientX, y: p.clientY };
  }
  function onMove(e) {
    if (!mouseDown) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - prevMouse.x;
    const dy = p.clientY - prevMouse.y;
    rotVel.x = dx * 0.005;
    rotVel.y = dy * 0.005;
    planet.rotation.y += rotVel.x;
    planet.rotation.x += rotVel.y;
    prevMouse = { x: p.clientX, y: p.clientY };
  }
  function onEnd() {
    mouseDown = false;
    setTimeout(() => { isUserInteracting = false; }, 2000);
  }

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('touchend', onEnd);

  let initDist = 0;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      initDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - initDist) * 0.005;
      camera.position.z = Math.max(1.8, Math.min(6, camera.position.z - delta));
      initDist = dist;
    }
  }, { passive: true });

  canvas.addEventListener('wheel', e => {
    camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + e.deltaY * 0.002));
  }, { passive: true });
}

// ══════════════════════════════════════════
//  SCREENSHOT
// ══════════════════════════════════════════
function takeScreenshot() {
  const flash = $('flash');
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 500);

  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'ma-planete.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('Photo de ta planète sauvegardée !');
}

// ══════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════
$('btn-start').addEventListener('click', startCamera);
$('btn-capture').addEventListener('click', captureFromVideo);
$('btn-back-cam').addEventListener('click', () => {
  stopCamera();
  showScreen('screen-welcome');
});
$('btn-upload-trigger').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', e => {
  if (e.target.files[0]) captureFromFile(e.target.files[0]);
});
$('btn-screenshot').addEventListener('click', takeScreenshot);
$('btn-save').addEventListener('click', takeScreenshot);
$('btn-new').addEventListener('click', () => {
  if (renderer) renderer.dispose();
  showScreen('screen-welcome');
});
