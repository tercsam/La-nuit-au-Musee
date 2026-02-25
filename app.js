// ═══════════════════════════════════════════
//  L'OBSERVATOIRE DES MONDES - Main App
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

// ── Screen Navigation ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ── Toast ──
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

function captureFromVideo() {
  const video = $('video-feed');
  if (!video.srcObject) return;
  const c = $('capture-canvas');
  const size = Math.min(video.videoWidth, video.videoHeight);
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const ox = (video.videoWidth - size) / 2;
  const oy = (video.videoHeight - size) / 2;
  ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size);
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
//  TEXTURE PROCESSING (Mirror Tiling)
// ══════════════════════════════════════════
function processImage(sourceCanvas) {
  showScreen('screen-loading');

  setTimeout(() => {
    const texCanvas = $('texture-canvas');
    const SIZE = 1024;
    texCanvas.width = SIZE * 2;
    texCanvas.height = SIZE;
    const ctx = texCanvas.getContext('2d');

    // Draw original on left half
    ctx.drawImage(sourceCanvas, 0, 0, SIZE, SIZE);

    // Draw mirrored on right half
    ctx.save();
    ctx.translate(SIZE * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sourceCanvas, 0, 0, SIZE, SIZE);
    ctx.restore();

    // Soft blend at the seam
    const grad = ctx.createLinearGradient(SIZE - 30, 0, SIZE + 30, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(SIZE - 30, 0, 60, SIZE);

    // Create circular crop version for sphere mapping
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = SIZE * 2;
    finalCanvas.height = SIZE;
    const fctx = finalCanvas.getContext('2d');
    fctx.drawImage(texCanvas, 0, 0);

    // Build 3D planet
    buildPlanet(finalCanvas);
  }, 2200);
}

// ══════════════════════════════════════════
//  THREE.JS PLANET SCENE
// ══════════════════════════════════════════
let scene, camera, renderer, planet, atmosphere;
let isUserInteracting = false;
let autoRotateSpeed = 0.002;
let mouseDown = false;
let prevMouse = { x: 0, y: 0 };
let rotVel = { x: 0, y: 0 };
let targetRot = { x: 0, y: 0 };

function buildPlanet(textureCanvas) {
  const container = $('three-canvas');

  // Cleanup previous
  if (renderer) {
    renderer.dispose();
    container.innerHTML = '';
  }

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 3;

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: container, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Texture
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Planet
  const geo = new THREE.SphereGeometry(1, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    metalness: 0.05,
    bumpMap: texture,
    bumpScale: 0.015,
  });
  planet = new THREE.Mesh(geo, mat);
  // 23.4° axial tilt
  planet.rotation.z = THREE.MathUtils.degToRad(23.4);
  scene.add(planet);

  // Atmosphere glow
  const atmoGeo = new THREE.SphereGeometry(1.04, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
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

  // Lighting — "Sunlight" from the right
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sunLight.position.set(5, 2, 3);
  scene.add(sunLight);

  // Subtle fill from opposite side
  const fillLight = new THREE.DirectionalLight(0x4466aa, 0.15);
  fillLight.position.set(-5, -1, -2);
  scene.add(fillLight);

  // Very dim ambient
  const ambient = new THREE.AmbientLight(0x222244, 0.2);
  scene.add(ambient);

  // Rim light from behind
  const rimLight = new THREE.DirectionalLight(0xffd475, 0.5);
  rimLight.position.set(-3, 0, -5);
  scene.add(rimLight);

  // Interaction
  setupPlanetInteraction(container);

  // Animate
  rotVel = { x: 0, y: 0 };
  function animate() {
    requestAnimationFrame(animate);

    if (!isUserInteracting) {
      planet.rotation.y += autoRotateSpeed;
    }

    // Inertia
    if (!mouseDown) {
      rotVel.x *= 0.95;
      rotVel.y *= 0.95;
      planet.rotation.y += rotVel.x;
      planet.rotation.x += rotVel.y;
    }

    atmosphere.rotation.copy(planet.rotation);
    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  showScreen('screen-planet');
}

function setupPlanetInteraction(canvas) {
  // Touch / Mouse drag to rotate
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

  // Pinch zoom
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

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + e.deltaY * 0.002));
  }, { passive: true });
}

// ══════════════════════════════════════════
//  SCREENSHOT
// ══════════════════════════════════════════
function takeScreenshot() {
  // Flash
  const flash = $('flash');
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 500);

  // Render one frame and capture
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  // Download
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