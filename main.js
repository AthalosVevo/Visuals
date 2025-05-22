import * as THREE from './libs/three.module.min.js';
import { GUI } from './libs/dat.gui.min.js';

let scene, camera, renderer, bars = [], analyser, dataArray, audioCtx;
let beatHistory = [], lastBeat = 0;

const settings = {
  barCount: 64,
  barSpacing: 0.3,
  colorSpeed: 0.01,
  beatScale: 1.5,
  gradient: true,
  rotation: true,
};

const gui = new GUI();
gui.add(settings, 'barCount', 16, 256, 1).onChange(initBars);
gui.add(settings, 'colorSpeed', 0.001, 0.1);
gui.add(settings, 'beatScale', 1, 3);
gui.add(settings, 'gradient');
gui.add(settings, 'rotation');

// Scene setup
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 40;

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1));

// Audio
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  initBars();
  animate();
}).catch(err => {
  alert("Microphone access denied.");
  console.error(err);
});

function initBars() {
  bars.forEach(b => scene.remove(b));
  bars = [];

  for (let i = 0; i < settings.barCount; i++) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    const bar = new THREE.Mesh(geometry, material);
    bar.position.x = (i - settings.barCount / 2) * (1 + settings.barSpacing);
    scene.add(bar);
    bars.push(bar);
  }
}

function getColorFromSpectrum(i, total, time) {
  const hue = (i / total + time * settings.colorSpeed) % 1;
  const color = new THREE.Color(`hsl(${hue * 360}, 100%, 50%)`);
  return color;
}

function detectBeat(avg) {
  beatHistory.push(avg);
  if (beatHistory.length > 60) beatHistory.shift();
  const recentAvg = beatHistory.reduce((a, b) => a + b, 0) / beatHistory.length;
  const now = performance.now();
  if (avg > recentAvg * 1.2 && now - lastBeat > 300) {
    lastBeat = now;
    return true;
  }
  return false;
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  const beat = detectBeat(avg);

  for (let i = 0; i < bars.length; i++) {
    const scale = (dataArray[i] || 0) / 64;
    const bar = bars[i];
    bar.scale.y = scale * (beat ? settings.beatScale : 1);
    if (settings.gradient) {
      bar.material.color = getColorFromSpectrum(i, bars.length, time * 0.001);
    }
  }

  if (settings.rotation) scene.rotation.y += 0.002;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
