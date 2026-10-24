/* ========================================================
   PulseWave - Web Audio API & HTML5 Canvas Visualizer
   ======================================================== */

// Global State & Elements
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
const modeButtons = document.querySelectorAll('.pill-btn');

let audioCtx = null;
let analyser = null;
let gainNode = null;
let sourceNode = null;
let micStream = null;

let isPlaying = false;
let currentMode = 'radial';
let accentColor = '#00f3ff';
let fftSize = 512;
let dataArray = null;

// Synthetic Oscillator Beat
let isDemoRunning = false;
let demoInterval = null;

// Custom Cursor Coordinates
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;
let bassIntensity = 0;
let hasMouseMoved = false;

// Particle System for "Nebula" mode
const particles = [];
const PARTICLE_COUNT = 120;

// FPS tracking
let lastFrameTime = performance.now();
let frameCount = 0;

// Initialize Canvas Size
function resizeCanvas() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ================= 1. Audio Setup ================= */
function initAudio() {
  if (audioCtx) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.82;

  gainNode = audioCtx.createGain();
  gainNode.gain.value = parseFloat(gainSlider.value);

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
}

/* ================= 2. Custom Cursor Logic ================= */
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  // Reveal cursor elements on first pointer interaction
  if (!hasMouseMoved) {
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '1';
    ringX = mouseX;
    ringY = mouseY;
    hasMouseMoved = true;
  }

  cursorDot.style.left = `${mouseX}px`;
  cursorDot.style.top = `${mouseY}px`;
});

// Hide cursor when leaving viewport
document.addEventListener('mouseleave', () => {
  cursorDot.style.opacity = '0';
  cursorRing.style.opacity = '0';
});

// Restore cursor visibility when returning
document.addEventListener('mouseenter', () => {
  if (hasMouseMoved) {
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '1';
  }
});

// Register hover expansion over interactive controls
const interactives = document.querySelectorAll('button, label, input, .pill-btn, .btn-action');
interactives.forEach((el) => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('cursor-hover'));
});

function updateCursor() {
  // Smooth spring-like trailing lerp
  ringX += (mouseX - ringX) * 0.18;
  ringY += (mouseY - ringY) * 0.18;

  const isHovered = cursorRing.classList.contains('cursor-hover');
  const baseScale = isHovered ? 1.5 : 1.0;
  const pulseScale = baseScale + bassIntensity * 0.85;

  cursorRing.style.left = `${ringX}px`;
  cursorRing.style.top = `${ringY}px`;
  cursorRing.style.transform = `translate(-50%, -50%) scale(${pulseScale})`;

  requestAnimationFrame(updateCursor);
}
updateCursor();

/* ================= 3. Audio Modes & Rendering ================= */
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: Math.random() * 2 + 1,
    baseX: Math.random() * window.innerWidth,
    baseY: Math.random() * window.innerHeight,
    speed: Math.random() * 0.02 + 0.005,
    angle: Math.random() * Math.PI * 2
  });
}

function render() {
  requestAnimationFrame(render);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const cx = width / 2;
  const cy = height / 2;

  // FPS calculation
  const now = performance.now();
  frameCount++;
  if (now - lastFrameTime >= 1000) {
    fpsCounter.textContent = `FPS: ${frameCount}`;
    frameCount = 0;
    lastFrameTime = now;
  }

  // Soft trailing background
  ctx.fillStyle = 'rgba(7, 9, 14, 0.28)';
  ctx.fillRect(0, 0, width, height);

  if (!analyser) return;

  analyser.getByteFrequencyData(dataArray);

  // Bass frequency analysis (bins 0 to 12)
  let bassSum = 0;
  for (let i = 0; i < 12; i++) {
    bassSum += dataArray[i];
  }
  bassIntensity = bassSum / (12 * 255);

  /* --- MODE 1: RADIAL --- */
  if (currentMode === 'radial') {
    const bars = 90;
    const baseRadius = Math.min(width, height) * 0.18 + (bassIntensity * 25);

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i < bars; i++) {
      const rad = (Math.PI * 2 / bars) * i;
      const dataIndex = Math.floor((i / bars) * (dataArray.length * 0.65));
      const value = dataArray[dataIndex] || 0;
      const barHeight = (value / 255) * (Math.min(width, height) * 0.22);

      const x1 = Math.cos(rad) * baseRadius;
      const y1 = Math.sin(rad) * baseRadius;
      const x2 = Math.cos(rad) * (baseRadius + barHeight);
      const y2 = Math.sin(rad) * (baseRadius + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(10, baseRadius * 0.8), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /* --- MODE 2: BARS --- */
  else if (currentMode === 'bars') {
    const totalBars = 64;
    const barWidth = (width / totalBars) * 0.65;
    const spacing = (width / totalBars) * 0.35;

    for (let i = 0; i < totalBars; i++) {
      const dataIndex = Math.floor((i / totalBars) * (dataArray.length * 0.7));
      const val = (dataArray[dataIndex] / 255) * (height * 0.45);
      const x = i * (barWidth + spacing) + spacing / 2;

      const grad = ctx.createLinearGradient(0, height / 2 - val, 0, height / 2 + val);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(1, '#ff0077');

      ctx.fillStyle = grad;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 8;
      ctx.fillRect(x, cy - val, barWidth, val * 2);
    }
  }

  /* --- MODE 3: NEBULA --- */
  else if (currentMode === 'particles') {
    particles.forEach((p, index) => {
      p.angle += p.speed;
      const freqIndex = index % 32;
      const energy = (dataArray[freqIndex] / 255);

      const offsetDist = energy * 90;
      const currentX = p.baseX + Math.cos(p.angle) * offsetDist;
      const currentY = p.baseY + Math.sin(p.angle) * offsetDist;

      ctx.beginPath();
      ctx.arc(currentX, currentY, p.radius + energy * 4, 0, Math.PI * 2);
      ctx.fillStyle = energy > 0.4 ? accentColor : 'rgba(255, 255, 255, 0.6)';
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = energy * 15;
      ctx.fill();

      for (let j = index + 1; j < index + 4 && j < particles.length; j++) {
        const dx = particles[j].baseX - p.baseX;
        const dy = particles[j].baseY - p.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(currentX, currentY);
          ctx.lineTo(particles[j].baseX, particles[j].baseY);
          ctx.strokeStyle = `rgba(0, 243, 255, ${0.15 * (1 - dist / 100)})`;
          ctx.stroke();
        }
      }
    });
  }
}
render();

/* ================= 4. Interactive Input Handlers ================= */

// File Upload
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
  isPlaying = true;
  centerBanner.classList.add('hide');
  playText.textContent = 'Pause';
});

// Microphone Input
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
      // Analyser only (avoids mic loopback feedback)
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
    alert('Microphone access denied or unavailable: ' + err.message);
  }
});

// Synthetic Demo Beat Generator
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
      // Sub kick
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 0.15);
      env.gain.setValueAtTime(0.8, audioCtx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    } else {
      // Harmonic arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25, 587.33];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      env.gain.setValueAtTime(0.25, audioCtx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    }

    osc.connect(env);
    env.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
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

// Master Play / Demo Toggle
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

// Mode Selector
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.getAttribute('data-mode');
  });
});

// Gain Slider
gainSlider.addEventListener('input', (e) => {
  if (gainNode) {
    gainNode.gain.value = parseFloat(e.target.value);
  }
});

// Dynamic Accent Color
colorPicker.addEventListener('input', (e) => {
  accentColor = e.target.value;
  document.documentElement.style.setProperty('--accent-color', accentColor);
  document.documentElement.style.setProperty('--accent-glow', `${accentColor}55`);
});