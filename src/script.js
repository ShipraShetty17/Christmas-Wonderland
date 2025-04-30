import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Spaghetti code used when I started the project to experiment with things.
 */

/**
 * Base
 */
// Debug

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

/**
 * Models
 */
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let mixer = null;
let train = null;

gltfLoader.load(
    '/models/train/back_to_the_future_train_-_steam_locomotive.glb',
    (gltf) => {
        gltf.scene.scale.set(0.5, 0.5, 0.5); // Adjust scale
        scene.add(gltf.scene);

        train = gltf.scene;

        console.log('Available animations:', gltf.animations);

        // Animation
        mixer = new THREE.AnimationMixer(gltf.scene);
        if (gltf.animations.length > 0) {
            const action = mixer.clipAction(gltf.animations[0]); // Play the first animation
            action.play();
        }
    }
);

/**
 * Floor
 */
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
        color: '#444444',
        metalness: 0,
        roughness: 0.5
    })
);
floor.receiveShadow = true;
floor.rotation.x = - Math.PI * 0.5;
scene.add(floor);

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1.4); // Adjust light intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 10.8); // Adjust light intensity
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = - 7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = - 7;
directionalLight.position.set(- 5, 5, 0);
scene.add(directionalLight);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(2, 2, 2); // Adjust camera position
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.75, 0); // Adjust target
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;
const radius = 4; // Adjust the radius as needed

// --- Snow System ---
const SNOW_PARTICLE_COUNT = 1500;
const SNOW_AREA = 8;
const SNOW_HEIGHT = 7;
const GROUND_Y = 0.01;

// Snowfall particles
const snowGeometry = new THREE.BufferGeometry();
const snowPositions = new Float32Array(SNOW_PARTICLE_COUNT * 3);
const snowVelocities = new Float32Array(SNOW_PARTICLE_COUNT);
for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * SNOW_AREA;
    snowPositions[i * 3 + 1] = Math.random() * SNOW_HEIGHT + 2;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA;
    snowVelocities[i] = 0.5 + Math.random() * 0.5;
}
snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true });
const snowParticles = new THREE.Points(snowGeometry, snowMaterial);
scene.add(snowParticles);

// Ground snow (simple accumulation effect)
const groundSnowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const groundSnow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), groundSnowMaterial);
groundSnow.rotation.x = -Math.PI / 2;
groundSnow.position.y = GROUND_Y + 0.01;
groundSnow.visible = false;
scene.add(groundSnow);

// Water (appears as snow melts)
const waterMaterial = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.5 });
const water = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = GROUND_Y + 0.005;
water.visible = false;
scene.add(water);

let groundSnowAmount = 1; // 1 = full snow, 0 = all melted

function updateSnowSystem(deltaTime) {
    // Snowfall logic
    if (window.getCurrentTemperature() < 0) {
        snowParticles.visible = true;
        // Animate snow particles
        const positions = snowGeometry.attributes.position.array;
        for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
            positions[i * 3 + 1] -= snowVelocities[i] * deltaTime;
            if (positions[i * 3 + 1] < GROUND_Y + 0.05) {
                // Reset to top
                positions[i * 3] = (Math.random() - 0.5) * SNOW_AREA;
                positions[i * 3 + 1] = SNOW_HEIGHT + Math.random() * 2;
                positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA;
            }
        }
        snowGeometry.attributes.position.needsUpdate = true;
        // Accumulate snow on ground
        groundSnowAmount += deltaTime * 0.15; // Accumulate
        if (groundSnowAmount > 1) groundSnowAmount = 1;
    } else {
        snowParticles.visible = false;
        // Melt ground snow
        groundSnowAmount -= deltaTime * 0.18 * (1 + window.getCurrentTemperature() / 5); // Faster melt if warmer
        if (groundSnowAmount < 0) groundSnowAmount = 0;
    }
    // Show/hide ground snow and water
    groundSnow.visible = groundSnowAmount > 0.01;
    groundSnow.material.opacity = groundSnowAmount * 0.8;
    water.visible = groundSnowAmount < 0.99;
    water.material.opacity = (1 - groundSnowAmount) * 0.5;
}

// --- End Snow System ---

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - previousTime;
    previousTime = elapsedTime;

    // Model animation
    if (mixer) {
        mixer.update(deltaTime);
    }

    // Move train in a circle
    if (train) {
        const angle = elapsedTime * 1.0; // Adjust speed as needed
        train.position.x = radius * Math.cos(angle);
        train.position.z = radius * Math.sin(angle);
        train.rotation.y = -angle - Math.PI / 2; // Rotate the train to face the direction of movement
    }

    // Update snow system
    updateSnowSystem(deltaTime);

    // Update controls
    controls.update();

    // Render
    renderer.render(scene, camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
};

tick();

document.addEventListener('DOMContentLoaded', () => {
    const tempSlider = document.getElementById('temp-slider');
    const tempValue = document.getElementById('temp-value');
    let currentTemperature = parseFloat(tempSlider.value);
    tempValue.textContent = currentTemperature;

    tempSlider.addEventListener('input', () => {
        currentTemperature = parseFloat(tempSlider.value);
        tempValue.textContent = currentTemperature;
        // You can use currentTemperature in your snow system logic
        // console.log('Temperature changed:', currentTemperature);
    });

    // Make currentTemperature globally accessible
    window.getCurrentTemperature = () => currentTemperature;
});