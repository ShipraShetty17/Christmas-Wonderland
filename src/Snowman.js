import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Snowman {
    constructor(scene, camera, renderer, onSnowmanClick) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.snowmen = [];
        this.onSnowmanClick = onSnowmanClick;
        this.weather = {
            temperature: -5, // Celsius
            isSnowing: true,
            snowAccumulationRate: 0.001, // Rate at which snow accumulates
            meltingRate: 0.005 // Rate at which snow melts when temperature is above 0
        };
        this.dayNightCycle = {
            time: 0, // 0-24 hours
            isDay: true
        };
    }

    load() {
        return new Promise((resolve, reject) => {
            const gltfLoader = new GLTFLoader();

            // New positions with one snowman next to Santa
            const positions = [
                { x: 3.5, z: 1.2, scale: 0.3 }, // Position next to Santa (larger)
                { x: -1.5, z: 1.5, scale: 0.15 }, // Position 2
                { x: 1.5, z: -1.5, scale: 0.15 } // Position 3
            ];

            let loadedCount = 0;

            for (let i = 0; i < positions.length; i++) {
                gltfLoader.load(
                    '/models/snowman/snow_man.glb',
                    (gltf) => {
                        const position = positions[i];
                        gltf.scene.scale.set(position.scale, position.scale, position.scale);

                        // Set position and rotation
                        gltf.scene.position.set(position.x, 0.1, position.z);
                        gltf.scene.rotation.y = Math.random() * Math.PI * 2;

                        // Add snow collection effect
                        const snowCollection = new THREE.Mesh(
                            new THREE.SphereGeometry(0.5, 32, 32),
                            new THREE.MeshBasicMaterial({ 
                                color: 0xffffff,
                                transparent: true,
                                opacity: 0
                            })
                        );
                        snowCollection.position.y = 0.5;
                        gltf.scene.add(snowCollection);

                        this.scene.add(gltf.scene);

                        // Animation
                        const mixer = new THREE.AnimationMixer(gltf.scene);
                        if (gltf.animations.length > 0) {
                            const action = mixer.clipAction(gltf.animations[0]);
                            action.paused = true;
                            action.loop = THREE.LoopOnce;
                            action.clampWhenFinished = true;
                            this.snowmen.push({ 
                                scene: gltf.scene, 
                                mixer: mixer, 
                                action: action,
                                snowCollection: snowCollection,
                                snowAmount: 0,
                                isMelting: false,
                                baseHeight: position.y
                            });
                        } else {
                            this.snowmen.push({ 
                                scene: gltf.scene, 
                                mixer: null, 
                                action: null,
                                snowCollection: snowCollection,
                                snowAmount: 0,
                                isMelting: false,
                                baseHeight: position.y
                            });
                        }

                        loadedCount++;
                        if (loadedCount === positions.length) {
                            resolve();
                        }
                    },
                    undefined,
                    (error) => {
                        console.error('An error happened while loading the snowman model:', error);
                        reject(error);
                    }
                );
            }

            this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
        });
    }

    updateWeather() {
        // Simulate temperature changes (more gradual)
        this.weather.temperature += (Math.random() - 0.5) * 0.05;
        
        // Update snowmen based on temperature
        for (const snowman of this.snowmen) {
            if (this.weather.temperature > 0) {
                // Melting when temperature is above 0
                snowman.isMelting = true;
                snowman.snowAmount = Math.max(0, snowman.snowAmount - this.weather.meltingRate);
            } else {
                // Accumulating snow when temperature is below 0
                snowman.isMelting = false;
                snowman.snowAmount = Math.min(1, snowman.snowAmount + this.weather.snowAccumulationRate);
            }
            
            // Update snow collection visual
            const snowHeight = snowman.snowAmount * 0.5; // Maximum height increase
            snowman.snowCollection.scale.set(
                1 + snowman.snowAmount * 0.5,
                1 + snowman.snowAmount * 0.5,
                1 + snowman.snowAmount * 0.5
            );
            snowman.snowCollection.position.y = 0.5 + snowHeight;
            snowman.snowCollection.material.opacity = snowman.snowAmount * 0.8;

            // Adjust snowman height based on snow amount
            snowman.scene.position.y = snowman.baseHeight + snowHeight * 0.2;
        }
    }

    updateDayNightCycle() {
        this.dayNightCycle.time = (this.dayNightCycle.time + 0.01) % 24;
        this.dayNightCycle.isDay = this.dayNightCycle.time > 6 && this.dayNightCycle.time < 18;
        
        // Update snowmen appearance based on time of day
        for (const snowman of this.snowmen) {
            const brightness = this.dayNightCycle.isDay ? 1.0 : 0.5;
            snowman.scene.traverse((child) => {
                if (child.isMesh) {
                    child.material.color.multiplyScalar(brightness);
                }
            });
        }
    }

    onClick(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        for (const snowman of this.snowmen) {
            const intersects = raycaster.intersectObject(snowman.scene, true);
            if (intersects.length > 0) {
                this.onSnowmanClick(snowman);
                // Add snow when clicked
                snowman.snowAmount = Math.min(1, snowman.snowAmount + 0.2);
                break;
            }
        }
    }

    playAnimation(snowman) {
        if (snowman.action) {
            snowman.action.reset();
            snowman.action.paused = false;
            snowman.action.play();

            snowman.mixer.addEventListener('finished', () => {
                snowman.action.paused = true;
            });
        }
    }

    update(deltaTime) {
        this.updateWeather();
        this.updateDayNightCycle();
        
        for (const snowman of this.snowmen) {
            if (snowman.mixer) {
                snowman.mixer.update(deltaTime);
            }
        }
    }
}

export default Snowman;