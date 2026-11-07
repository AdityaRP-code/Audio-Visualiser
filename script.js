/* ========================================================
   PulseWave - Modern Minimal Audio Visualizer
   ======================================================== */

// DOM Elements
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');
const centerBanner = document.getElementById('centerBanner');
const fpsCounter = document.getElementById('fpsCounter');
const audioUpload = document.getElementById('audioUpload');
const btnPlayPause = document.getElementById('btnPlayPause');
const playText = document.getElementById('playText');
const btnMic = document.getElementById('btnMic');
const audioElement = document.getElementById('audioElement');
const gainSlider = document.getElementById('gainSlider');
const colorPicker = document.getElementById('colorPicker');
const modeButtons = document.querySelectorAll('.segment-btn');
const themeToggle = document.getElementById('themeToggle');

// State
let audioCtx = null;
let analyser = null;
let gainNode = null;
let sourceNode = null;
let micStream = null;
let currentMode = 'radial';
let accentColor = '#18181b';
let fftSize = 512;
let dataArray = null;

let isDemoRunning = false;
let demoInterval = null;

// Cursor Coordinates
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;
let bassIntensity = 0;
let hasMouseMoved = false;

// Nebula Particles
const particles = [];
const PARTICLE_COUNT = 90;

// FPS calculation
let lastFrameTime = performance.now();
let frameCount = 0;

/* --- 1. Theme Management --- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('pw_theme', theme);

  if (theme === 'dark') {
    accentColor = '#ffffff';
    colorPicker.value = '#ffffff';
  } else {
    accentColor = '#18181b';
    colorPicker.value = '#18181b';
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const target = current === 'light' ? 'dark' : 'light';
  applyTheme(target);
});

// Auto-detect theme preference
const savedTheme = localStorage.getItem('pw_theme') || 'light';
applyTheme(savedTheme);

/* --- 2. Canvas Setup --- */
function resizeCanvas() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* --- 3. Web Audio Setup --- */
function initAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.85;

  gainNode = audioCtx.createGain();
  gainNode.gain.value = parseFloat(gainSlider.value);

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
}

/* --- 4. Minimal Custom Cursor --- */
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (!hasMouseMoved) {
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '0.35';
    ringX = mouseX;
    ringY = mouseY;
    hasMouseMoved = true;
  }

  cursorDot.style.left = `${mouseX}px`;
  cursorDot.style.top = `${mouseY}px`;
});

document.addEventListener('mouseleave', () => {
  cursorDot.style.opacity = '0';
  cursorRing.style.opacity = '0';
});

document.addEventListener('mouseenter', () => {
  if (hasMouseMoved) {
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '0.35';
  }
});

const interactives = document.querySelectorAll('button, label, input, .segment-btn, .btn-action');
interactives.forEach((el) => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('cursor-hover'));
});

function updateCursor() {
  ringX += (mouseX - ringX) * 0.18;
  ringY += (mouseY - ringY) * 0.18;

  const isHovered = cursorRing.classList.contains('cursor-hover');
  const baseScale = isHovered ? 1.4 : 1.0;
  const pulseScale = baseScale + (bassIntensity * 0.4);

  cursorRing.style.left = `${ringX}px`;
  cursorRing.style.top = `${ringY}px`;
  cursorRing.style.transform = `translate(-50%, -50%) scale(${pulseScale})`;

  requestAnimationFrame(updateCursor);
}
updateCursor();

/* --- 5. Render Loop --- */
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: Math.random() * 1.5 + 1,
    baseX: Math.random() * window.innerWidth,
    baseY: Math.random() * window.innerHeight,
    speed: Math.random() * 0.015 + 0.005,
    angle: Math.random() * Math.PI * 2
  });
}

function render() {
  requestAnimationFrame(render);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const cx = width / 2;
  const cy = height / 2;

  // FPS tracking
  const now = performance.now();
  frameCount++;
  if (now - lastFrameTime >= 1000) {
    fpsCounter.textContent = `${frameCount} FPS`;
    frameCount = 0;
    lastFrameTime = now;
  }

  // Clear with soft minimal trail
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? 'rgba(9, 9, 11, 0.32)' : 'rgba(250, 250, 250, 0.35)';
  ctx.fillRect(0, 0, width, height);

  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);

  // Bass frequency analysis
  let bassSum = 0;
  for (let i = 0; i < 12; i++) {
    bassSum += dataArray[i];
  }
  bassIntensity = bassSum / (12 * 255);

  /* Mode 1: Radial */
  if (currentMode === 'radial') {
    const bars = 72;
    const baseRadius = Math.min(width, height) * 0.16 + (bassIntensity * 18);

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < bars; i++) {
      const rad = (Math.PI * 2 / bars) * i;
      const dataIndex = Math.floor((i / bars) * (dataArray.length * 0.6));
      const value = dataArray[dataIndex] || 0;
      const barHeight = (value / 255) * (Math.min(width, height) * 0.18);

      const x1 = Math.cos(rad) * baseRadius;
      const y1 = Math.sin(rad) * baseRadius;
      const x2 = Math.cos(rad) * (baseRadius + barHeight);
      const y2 = Math.sin(rad) * (baseRadius + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(8, baseRadius * 0.9), 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* Mode 2: Minimal Bars */
  else if (currentMode === 'bars') {
    const totalBars = 48;
    const barWidth = 4;
    const totalSpread = totalBars * 12;
    const startX = cx - (totalSpread / 2);

    for (let i = 0; i < totalBars; i++) {
      const dataIndex = Math.floor((i / totalBars) * (dataArray.length * 0.65));
      const val = (dataArray[dataIndex] / 255) * (height * 0.3);
      const x = startX + (i * 12);

      ctx.fillStyle = accentColor;
      ctx.fillRect(x, cy - (val / 2), barWidth, Math.max(val, 2));
    }
  }

  /* Mode 3: Nebula Particles */
  else if (currentMode === 'particles') {
    particles.forEach((p, index) => {
      p.angle += p.speed;
      const freqIndex = index % 32;
      const energy = (dataArray[freqIndex] / 255);
      const offsetDist = energy * 60;

      const currentX = p.baseX + Math.cos(p.angle) * offsetDist;
      const currentY = p.baseY + Math.sin(p.angle) * offsetDist;

      ctx.beginPath();
      ctx.arc(currentX, currentY, p.radius + energy * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();

      // Subtle interconnect lines
      for (let j = index + 1; j < index + 3 && j < particles.length; j++) {
        const dx = particles[j].baseX - p.baseX;
        const dy = particles[j].baseY - p.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 80) {
          ctx.beginPath();
          ctx.moveTo(currentX, currentY);
          ctx.lineTo(particles[j].baseX, particles[j].baseY);
          ctx.strokeStyle = isDark
            ? `rgba(255, 255, 255, ${0.12 * (1 - dist / 80)})`
            : `rgba(0, 0, 0, ${0.08 * (1 - dist / 80)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });
  }
}
render();

/* --- 6. Input & Audio Control Handlers --- */
audioUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  initAudio();
  stopDemo();

  const fileURL = URL.createObjectURL(file);
  audioElement.src = fileURL;

  if (!sourceNode) {
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    sourceNode.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  audioElement.play();
  audioCtx.resume();
  centerBanner.classList.add('hide');
  playText.textContent = 'Pause';
});

btnMic.addEventListener('click', async () => {
  initAudio();
  stopDemo();
  audioElement.pause();

  try {
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(gainNode);
      gainNode.connect(analyser);

      btnMic.classList.add('primary');
      centerBanner.classList.add('hide');
      playText.textContent = 'Mic Active';
    } else {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
      btnMic.classList.remove('primary');
      playText.textContent = 'Play Demo';
    }
  } catch (err) {
    alert('Microphone access denied: ' + err.message);
  }
});

function startDemo() {
  if (isDemoRunning) return;
  initAudio();
  audioCtx.resume();

  let step = 0;
  const tempo = 220;

  demoInterval = setInterval(() => {
    if (!isDemoRunning) return;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();

    if (step % 4 === 0) {
      osc.frequency.setValueAtTime(130, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 0.15);
      env.gain.setValueAtTime(0.7, audioCtx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    } else {
      const notes = [261.63, 329.63, 392.00, 523.25];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      env.gain.setValueAtTime(0.2, audioCtx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    }

    osc.connect(env);
    env.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
    step++;
  }, tempo);

  isDemoRunning = true;
  centerBanner.classList.add('hide');
}

function stopDemo() {
  isDemoRunning = false;
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

btnPlayPause.addEventListener('click', () => {
  initAudio();
  audioCtx.resume();

  if (audioElement.src && audioElement.src !== '') {
    if (audioElement.paused) {
      audioElement.play();
      playText.textContent = 'Pause';
      centerBanner.classList.add('hide');
    } else {
      audioElement.pause();
      playText.textContent = 'Play';
    }
  } else {
    if (!isDemoRunning) {
      startDemo();
      playText.textContent = 'Stop Demo';
    } else {
      stopDemo();
      playText.textContent = 'Play Demo';
    }
  }
});

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.getAttribute('data-mode');
  });
});

gainSlider.addEventListener('input', (e) => {
  if (gainNode) {
    gainNode.gain.value = parseFloat(e.target.value);
  }
});

colorPicker.addEventListener('input', (e) => {
  accentColor = e.target.value;
});
