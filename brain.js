// === A.D.A.M. BRAIN SYSTEM v0.1 ===
console.log("brain.js запущен...");

window.addEventListener("load", () => {
  const THREE = window.THREE;
  if (!THREE) {
    console.error("❌ THREE не найден! Проверь подключение three.min.js");
    return;
  }
  console.log("✅ THREE найден:", THREE);

  const canvas = document.getElementById("brainCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 3;

  // === Пробный “мозг” — пульсирующий шар ===
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    metalness: 0.3,
    roughness: 0.8,
    emissive: 0x008844,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  const light = new THREE.PointLight(0x00ff88, 1.5);
  light.position.set(2, 2, 3);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0x004422, 0.4);
  scene.add(ambient);

  function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;
    sphere.scale.setScalar(1 + Math.sin(t * 2) * 0.1);
    sphere.rotation.y += 0.005;
    sphere.rotation.x += 0.002;
    renderer.render(scene, camera);
  }

  animate();
});
