// brain.js — версия 0.1 (основной фон)

const THREE = window.THREE;

let scene, camera, renderer, brain, clock;

// === 1. Создание сцены ===
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

// === 2. Рендерер ===
renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("brainCanvas"),
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);

// === 3. Свет ===
const ambient = new THREE.AmbientLight(0x00ff99, 0.3);
scene.add(ambient);

const pointLight = new THREE.PointLight(0x00ff55, 2, 10);
pointLight.position.set(2, 3, 2);
scene.add(pointLight);

const rimLight = new THREE.PointLight(0x3300ff, 1.5, 8);
rimLight.position.set(-3, -2, -1);
scene.add(rimLight);

// === 4. Геометрия мозга (пока сфера-заглушка) ===
const geometry = new THREE.IcosahedronGeometry(1, 5);
const material = new THREE.MeshStandardMaterial({
  color: 0x00ff88,
  emissive: 0x003311,
  metalness: 0.8,
  roughness: 0.4,
});
brain = new THREE.Mesh(geometry, material);
scene.add(brain);

// === 5. "Дыхание" и "пульс" ===
clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();
  const pulse = Math.sin(t * 2) * 0.03 + 1.0;
  brain.scale.set(pulse, pulse, pulse);

  brain.rotation.y += 0.002;
  brain.rotation.x += 0.0005;

  // Лёгкое свечение
  material.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.2;

  renderer.render(scene, camera);
}

animate();

// === 6. Адаптация под экран ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
