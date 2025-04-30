import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Santa from './Santa.js';
import Lights from './Lights.js';
import Snowman from './Snowman.js';
import ToyCar from './ToyCar.js';
import Gift from './Gift.js';
import ChristmasTree from './ChristmasTree.js';
import Train from './Train.js';
import Floor from './Floor.js';
import Skybox from './Skybox.js';
import Text from './Text.js';

class App {
    constructor() {
        if (App.instance) {
            return App.instance;
        }
        App.instance = this;

        this.canvas = document.querySelector('canvas.webgl');
        this.scene = new THREE.Scene();
        this.sizes = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // Temperature slider logic
        this.tempSlider = document.getElementById('temp-slider');
        this.tempValue = document.getElementById('temp-value');
        this.currentTemperature = parseFloat(this.tempSlider.value);
        this.tempValue.textContent = this.currentTemperature;
        this.tempSlider.addEventListener('input', () => {
            this.currentTemperature = parseFloat(this.tempSlider.value);
            this.tempValue.textContent = this.currentTemperature;
        });
        window.getCurrentTemperature = () => this.currentTemperature;

        this.initCamera();
        this.initRenderer();
        this.initControls();
        this.initEventListeners();

        this.lights = new Lights(this.scene);
        this.santa = new Santa(this.scene, this.camera, this.renderer);
        this.snowman = new Snowman(this.scene, this.camera, this.renderer, this.onSnowmanClick.bind(this));
        this.toyCar = new ToyCar(this.scene, this.camera, this.renderer, this.onCarClick.bind(this), this.santa.santa);
        this.gift = new Gift(this.scene, this.camera, this.renderer);
        this.christmasTree = new ChristmasTree(this.scene, this.camera, this.renderer);
        this.train = new Train(this.scene);
        this.floor = new Floor(this.scene);
        this.skybox = new Skybox(this.scene);
        this.text = new Text(this.scene);
        
        // --- Snow System ---
        this.SNOW_PARTICLE_COUNT = 1500;
        this.SNOW_AREA = 8;
        this.SNOW_HEIGHT = 7;
        this.GROUND_Y = 0.01;
        // Snowfall particles
        this.snowGeometry = new THREE.BufferGeometry();
        this.snowPositions = new Float32Array(this.SNOW_PARTICLE_COUNT * 3);
        this.snowVelocities = new Float32Array(this.SNOW_PARTICLE_COUNT);
        for (let i = 0; i < this.SNOW_PARTICLE_COUNT; i++) {
            this.snowPositions[i * 3] = (Math.random() - 0.5) * this.SNOW_AREA;
            this.snowPositions[i * 3 + 1] = Math.random() * this.SNOW_HEIGHT + 2;
            this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * this.SNOW_AREA;
            this.snowVelocities[i] = 0.5 + Math.random() * 0.5;
        }
        this.snowGeometry.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));
        // Load snowflake texture for particles
        this.snowMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.08,
            sizeAttenuation: true,
            transparent: true
        });
        this.snowParticles = new THREE.Points(this.snowGeometry, this.snowMaterial);
        this.scene.add(this.snowParticles);
        // Ground snow
        this.groundSnowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        this.groundSnow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), this.groundSnowMaterial);
        this.groundSnow.rotation.x = -Math.PI / 2;
        this.groundSnow.position.y = this.GROUND_Y + 0.01;
        this.groundSnow.visible = false;
        this.scene.add(this.groundSnow);
        // Water
        this.waterMaterial = new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.5 });
        this.water = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), this.waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = this.GROUND_Y + 0.005;
        this.water.visible = false;
        this.scene.add(this.water);
        this.groundSnowAmount = 0; // Start with clean ground
        // --- End Snow System ---

        // --- Landed Snow Particles System ---
        this.maxGroundParticles = 400; // Allow more ground particles
        this.groundParticlePositions = [];
        this.groundParticleOpacities = [];
        this.groundParticleGeometry = new THREE.BufferGeometry();
        this.groundParticleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.18,
            sizeAttenuation: true,
            transparent: true,
            opacity: 1
        });
        this.groundParticlePoints = new THREE.Points(this.groundParticleGeometry, this.groundParticleMaterial);
        this.scene.add(this.groundParticlePoints);

        // --- Landed Snow Particles on Tree System ---
        this.maxTreeParticles = 200;
        this.treeParticlePositions = [];
        this.treeParticleOpacities = [];
        this.treeParticleGeometry = new THREE.BufferGeometry();
        this.treeParticleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.16,
            sizeAttenuation: true,
            transparent: true,
            opacity: 1
        });
        this.treeParticlePoints = new THREE.Points(this.treeParticleGeometry, this.treeParticleMaterial);
        this.scene.add(this.treeParticlePoints);
        // Tree area approximation (centered at 0,0,0)
        this.treeRadius = 1.2; // Adjust as needed for your tree size
        this.treeBaseY = 0.0;
        this.treeTopY = 2.5; // Adjust as needed for your tree height

        this.loadAssets().then(() => {
            this.onAssetsLoaded();
            // Dynamically set tree radius and height after tree loads
            if (this.christmasTree && this.christmasTree.tree) {
                const box = new THREE.Box3().setFromObject(this.christmasTree.tree);
                const size = new THREE.Vector3();
                box.getSize(size);
                this.treeRadius = Math.max(size.x, size.z) / 2;
                this.treeBaseY = box.min.y;
                this.treeTopY = box.max.y;
            }
        });

        this.clock = new THREE.Clock();
        this.previousTime = 0;

        this.animate();
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.sizes.width / this.sizes.height, 0.1, 100);
        this.camera.position.set(5, 5, 5); // Pull the camera back to ensure the whole scene is visible
        this.scene.add(this.camera);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(this.sizes.width, this.sizes.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.target.set(0, 0, 0);
    }

    initEventListeners() {
        window.addEventListener('resize', () => {
            this.sizes.width = window.innerWidth;
            this.sizes.height = window.innerHeight;

            this.camera.aspect = this.sizes.width / this.sizes.height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(this.sizes.width, this.sizes.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        });

        this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    }

    loadAssets() {
        return Promise.all([
            this.lights.load(),
            this.santa.load(),
            this.snowman.load(),
            this.toyCar.load(),
            this.gift.load(),
            this.christmasTree.load(),
            this.train.load(),
            this.floor.load(),
            this.skybox.load(),
            this.text.load()
        ]);
    }

    onClick(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects([
            this.santa.santa,
            ...this.snowman.snowmen.map(snowman => snowman.scene),
            ...this.toyCar.getCarMeshes(),
            ...this.gift.gifts,
            this.christmasTree.tree,
            this.train.train,
            this.text.textMesh
        ].filter(Boolean), true);

        console.log('Intersections:', intersects);

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            console.log('Intersected object:', intersectedObject);
            if (intersectedObject === this.santa.santa) {
                console.log('Santa clicked');
                this.santa.lightUp();
            } else {
                const snowman = this.snowman.snowmen.find(snowman => snowman.scene === intersectedObject);
                if (snowman) {
                    console.log('Snowman clicked');
                    this.snowman.playAnimation(snowman);
                } else {
                    const car = this.toyCar.getCarByMesh(intersectedObject);
                    if (car) {
                        console.log('Car clicked');
                        this.toyCar.playCarAnimation(car);
                    } else {
                        const gift = this.gift.gifts.find(gift => gift === intersectedObject);
                        if (gift) {
                            console.log('Gift clicked');
                            this.gift.toggleGiftMaterial(gift);
                        } else if (intersectedObject === this.christmasTree.tree) {
                            console.log('Christmas tree clicked');
                            this.christmasTree.toggleAnimation();
                        } else if (intersectedObject.name.startsWith('train-')) {
                            console.log('Train clicked');
                            this.train.toggleAnimation();
                            this.train.toggleLights();
                        } else if (intersectedObject === this.text.textMesh) {
                            console.log('Text clicked');
                            this.text.handleClick();
                        }
                    }
                }
            }
        } else {
            console.log('No intersections');
        }
    }

    onSnowmanClick(snowman) {
        this.snowman.playAnimation(snowman);
    }

    onCarClick(car) {
        this.toyCar.playCarAnimation(car);
    }

    onAssetsLoaded() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.display = 'none';
    }

    animate() {
        const elapsedTime = this.clock.getElapsedTime();
        const deltaTime = elapsedTime - this.previousTime;
        this.previousTime = elapsedTime;

        if (this.santa) {
            this.santa.update(deltaTime);
        }

        if (this.snowman) {
            this.snowman.update(deltaTime);
        }

        if (this.toyCar) {
            this.toyCar.update(deltaTime);
        }

        if (this.gift) {
            this.gift.update(deltaTime);
        }

        if (this.christmasTree) {
            this.christmasTree.update(deltaTime);
        }

        if (this.train) {
            this.train.update(deltaTime);
        }

        // Update snow system
        this.updateSnowSystem(deltaTime);

        this.controls.update();
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => this.animate());
    }

    updateSnowSystem(deltaTime) {
        // Digital twin snow/water logic
        if (this.currentTemperature < 0) {
            // Snowfall and accumulation
            this.snowParticles.visible = true;
            const positions = this.snowGeometry.attributes.position.array;
            // Calculate intensity factor: 0 at 0°C, 1 at -10°C
            const intensity = Math.min(1, Math.max(0, -this.currentTemperature / 10));
            const baseSpeed = 0.5;
            const extraSpeed = 1.0; // max extra speed at -10°C
            const snowSpeed = baseSpeed + intensity * extraSpeed;
            for (let i = 0; i < this.SNOW_PARTICLE_COUNT; i++) {
                positions[i * 3 + 1] -= snowSpeed * deltaTime;
                const x = positions[i * 3];
                const y = positions[i * 3 + 1];
                const z = positions[i * 3 + 2];
                // Check for tree collision at any height
                if (
                    y > this.treeBaseY + 0.1 &&
                    y < this.treeTopY &&
                    this.treeParticlePositions.length < this.maxTreeParticles
                ) {
                    const h = this.treeTopY - this.treeBaseY;
                    const relY = y - this.treeBaseY;
                    const coneRadiusAtY = this.treeRadius * (1 - (relY / h));
                    const distXZ = Math.sqrt(x * x + z * z);
                    if (distXZ < coneRadiusAtY) {
                        // Land on tree
                        const theta = Math.random() * 2 * Math.PI;
                        const r = coneRadiusAtY + (Math.random() - 0.5) * 0.08;
                        const px = Math.cos(theta) * r;
                        const pz = Math.sin(theta) * r;
                        this.treeParticlePositions.push([
                            px,
                            y,
                            pz
                        ]);
                        this.treeParticleOpacities.push(1.0);
                        // Reset snowflake to top
                        positions[i * 3] = (Math.random() - 0.5) * this.SNOW_AREA;
                        positions[i * 3 + 1] = this.SNOW_HEIGHT + Math.random() * 2;
                        positions[i * 3 + 2] = (Math.random() - 0.5) * this.SNOW_AREA;
                        continue;
                    }
                }
                // If it reaches the ground, land on ground as before
                if (y < this.GROUND_Y + 0.05) {
                    const baseProb = 0.08;
                    const extraProb = 0.12; // max extra probability at -10°C
                    const landProb = baseProb + extraProb * intensity;
                    if (Math.random() < landProb && this.groundParticlePositions.length < this.maxGroundParticles) {
                        const offsetX = (Math.random() - 0.5) * 0.15;
                        const offsetZ = (Math.random() - 0.5) * 0.15;
                        this.groundParticlePositions.push([
                            x + offsetX,
                            this.GROUND_Y + 0.02 + Math.random() * 0.01,
                            z + offsetZ
                        ]);
                        this.groundParticleOpacities.push(1.0);
                    }
                    positions[i * 3] = (Math.random() - 0.5) * this.SNOW_AREA;
                    positions[i * 3 + 1] = this.SNOW_HEIGHT + Math.random() * 2;
                    positions[i * 3 + 2] = (Math.random() - 0.5) * this.SNOW_AREA;
                }
            }
            this.snowGeometry.attributes.position.needsUpdate = true;
            // Accumulate snow on ground
            this.groundSnowAmount += deltaTime * 0.15; // Accumulate
            if (this.groundSnowAmount > 1) this.groundSnowAmount = 1;
        } else {
            // No snowfall, start melting
            this.snowParticles.visible = false;
            if (this.currentTemperature > 0 && this.groundSnowAmount > 0) {
                // Melting rate increases with temperature above 0°C
                const meltRate = deltaTime * 0.08 * this.currentTemperature; // 0.08 is a tunable factor
                this.groundSnowAmount -= meltRate;
                if (this.groundSnowAmount < 0) this.groundSnowAmount = 0;
                // Fade ground particles proportionally
                for (let i = 0; i < this.groundParticleOpacities.length; i++) {
                    this.groundParticleOpacities[i] -= deltaTime * 0.2 * this.currentTemperature;
                }
                // Remove fully melted particles
                while (this.groundParticleOpacities.length > 0 && this.groundParticleOpacities[0] <= 0) {
                    this.groundParticleOpacities.shift();
                    this.groundParticlePositions.shift();
                }
                // Fade tree particles proportionally
                for (let i = 0; i < this.treeParticleOpacities.length; i++) {
                    this.treeParticleOpacities[i] -= deltaTime * 0.2 * this.currentTemperature;
                }
                // Remove fully melted tree particles
                while (this.treeParticleOpacities.length > 0 && this.treeParticleOpacities[0] <= 0) {
                    this.treeParticleOpacities.shift();
                    this.treeParticlePositions.shift();
                }
            }
        }
        // Show/hide ground snow and water
        this.groundSnow.visible = this.groundSnowAmount > 0.01;
        this.groundSnow.material.opacity = this.groundSnowAmount * 0.8;
        // Water appears only as snow melts, and is proportional to melted snow
        if (this.currentTemperature > 0 && this.groundSnowAmount < 0.99 && this.groundSnowAmount > 0) {
            this.water.visible = true;
            this.water.material.opacity = (1 - this.groundSnowAmount) * 0.5;
        } else {
            this.water.visible = false;
        }

        // --- Update ground snow particles geometry and opacity ---
        if (this.groundParticlePositions.length > 0) {
            const flat = this.groundParticlePositions.flat();
            this.groundParticleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
            // Set per-particle opacity (Three.js PointsMaterial does not support per-point opacity directly, so fade all together)
            // As a workaround, set overall opacity to the average of all opacities
            let avgOpacity = this.groundParticleOpacities.reduce((a, b) => a + b, 0) / this.groundParticleOpacities.length;
            this.groundParticleMaterial.opacity = avgOpacity;
            this.groundParticlePoints.visible = true;
        } else {
            this.groundParticlePoints.visible = false;
        }

        // --- Update tree snow particles geometry and opacity ---
        if (this.treeParticlePositions.length > 0) {
            const flatTree = this.treeParticlePositions.flat();
            this.treeParticleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatTree, 3));
            let avgTreeOpacity = this.treeParticleOpacities.reduce((a, b) => a + b, 0) / this.treeParticleOpacities.length;
            this.treeParticleMaterial.opacity = avgTreeOpacity;
            this.treeParticlePoints.visible = true;
        } else {
            this.treeParticlePoints.visible = false;
        }
    }
}

export default App;