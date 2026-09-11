//gommageOrchestrator.js

import * as THREE from 'three/webgpu';
import MSDFText from './msdfText.js';
import { uniform } from 'three/tsl';
import DustParticles from './dustParticles.js';
import PetalParticles from './petalParticles.js';
import Debug, { DEBUG_FOLDERS } from './debug.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

export default class GommageOrchestrator {
  #uProgress = uniform(0.0);

  #MSDFTextEntity = null;
  #DustParticlesEntity = null;
  #PetalParticlesEntity = null;

  #dustInterval = 0.125;
  #petalInterval = 0.05;
  #gommageTween = null;
  #spawnDustTween = null;
  #spawnPetalTween = null;

  constructor() {}

  async initialize(scene) {
    try {
      const { perlinTexture, dustParticleTexture, fontAtlasTexture } = await this.loadTextures();
      const petalGeometry = await this.loadPetalGeometry();
      console.log('Orchestrator assets loaded');

      const debugFolder = Debug.getInstance().getFolder(DEBUG_FOLDERS.MSDF_TEXT);
      this.#MSDFTextEntity = new MSDFText();
      const msdfText = await this.#MSDFTextEntity.initialize(
        'welcome',
        new THREE.Vector3(0, 0, 0),
        this.#uProgress,
        perlinTexture,
        fontAtlasTexture
      );
      scene.add(msdfText);
      console.log('MSDF Text added to scene');

      this.#DustParticlesEntity = new DustParticles();
      const dustParticles = await this.#DustParticlesEntity.initialize(perlinTexture, dustParticleTexture);
      scene.add(dustParticles);
      console.log('Dust particles added to scene');

      this.#PetalParticlesEntity = new PetalParticles();
      const petalParticles = await this.#PetalParticlesEntity.initialize(perlinTexture, petalGeometry);
      scene.add(petalParticles);
      console.log('Petal particles added to scene');

      const GommageButton = debugFolder.addButton({
        title: 'GOMMAGE',
      });
      const ResetButton = debugFolder.addButton({
        title: 'RESET',
      });
      const DustButton = debugFolder.addButton({
        title: 'DUST',
      });
      const PetalButton = debugFolder.addButton({
        title: 'PETAL',
      });
      GommageButton.on('click', () => {
        this.triggerGommage();
      });
      ResetButton.on('click', () => {
        this.resetGommage();
      });
      DustButton.on('click', () => {
        const randomPosition = this.#MSDFTextEntity.getRandomPositionInMesh();
        this.#DustParticlesEntity.spawnDust(randomPosition);
      });
      PetalButton.on('click', () => {
        this.#PetalParticlesEntity.debugSpawnPetal();
      });

      this.progressContainer = document.getElementById('progress-container');
      this.progressBar = document.getElementById('progress-bar');
      this.progressPercent = document.getElementById('progress-percent');
    } catch (err) {
      console.error('Orchestrator initialization error:', err);
      throw err;
    }
  }

  setCompletionCallback(callback) {
    this.onCompleteCallback = callback;
  }

  async loadPetalGeometry() {
    const modelLoader = new GLTFLoader();
    console.log('Loading petal geometry from /models/petal.glb...');
    try {
      const petalScene = await modelLoader.loadAsync('/models/petal.glb');
      const petalMesh = petalScene.scene.getObjectByName('PetalV2');
      if (!petalMesh) {
        throw new Error('PetalV2 not found in GLB');
      }
      console.log('Petal geometry loaded successfully');
      return petalMesh.geometry;
    } catch (err) {
      console.error('Error loading petal geometry:', err);
      throw err;
    }
  }

  async loadTextures() {
    const textureLoader = new THREE.TextureLoader();
    console.log('Loading textures...');

    try {
      const [dustParticleTexture, perlinTexture, fontAtlasTexture] = await Promise.all([
        textureLoader.loadAsync('/textures/dustParticle.png'),
        textureLoader.loadAsync('/textures/perlin.webp'),
        textureLoader.loadAsync('/fonts/Cinzel/Cinzel.png'),
      ]);

      dustParticleTexture.colorSpace = THREE.NoColorSpace;
      dustParticleTexture.minFilter = THREE.LinearFilter;
      dustParticleTexture.magFilter = THREE.LinearFilter;
      dustParticleTexture.generateMipmaps = false;

      perlinTexture.colorSpace = THREE.NoColorSpace;
      perlinTexture.minFilter = THREE.LinearFilter;
      perlinTexture.magFilter = THREE.LinearFilter;
      perlinTexture.wrapS = THREE.RepeatWrapping;
      perlinTexture.wrapT = THREE.RepeatWrapping;
      perlinTexture.generateMipmaps = false;

      fontAtlasTexture.colorSpace = THREE.NoColorSpace;
      fontAtlasTexture.minFilter = THREE.LinearFilter;
      fontAtlasTexture.magFilter = THREE.LinearFilter;
      fontAtlasTexture.wrapS = THREE.ClampToEdgeWrapping;
      fontAtlasTexture.wrapT = THREE.ClampToEdgeWrapping;
      fontAtlasTexture.generateMipmaps = false;

      console.log('Textures loaded successfully');
      return { perlinTexture, dustParticleTexture, fontAtlasTexture };
    } catch (err) {
      console.error('Error loading textures:', err);
      throw err;
    }
  }

  triggerGommage() {
    // Don't start if already running
    if (this.#gommageTween || this.#spawnDustTween || this.#spawnPetalTween) return;
    this.#uProgress.value = 0;

    // Show progress bar
    if (this.progressContainer) {
      this.progressContainer.classList.add('visible');
    }
    this.updateProgressUI(0);

    this.#spawnDustTween = gsap.to(
      {},
      {
        duration: this.#dustInterval,
        repeat: -1,
        onRepeat: () => {
          const p = this.#MSDFTextEntity.getRandomPositionInMesh();
          this.#DustParticlesEntity.spawnDust(p);
        },
      }
    );

    this.#spawnPetalTween = gsap.to(
      {},
      {
        duration: this.#petalInterval,
        repeat: -1,
        onRepeat: () => {
          const p = this.#MSDFTextEntity.getRandomPositionInMesh();
          this.#PetalParticlesEntity.spawnPetal(p);
        },
      }
    );

    this.#gommageTween = gsap.to(this.#uProgress, {
      value: 1,
      duration: 2.5, // Faster gommage
      ease: 'power2.inOut',
      onUpdate: () => {
        this.updateProgressUI(this.#uProgress.value);
      },
      onComplete: () => {
        this.#spawnDustTween?.kill();
        this.#spawnPetalTween?.kill();
        this.#spawnDustTween = null;
        this.#gommageTween = null;
        this.#spawnPetalTween = null;

        // Hide progress bar instantly
        if (this.progressContainer) {
          this.progressContainer.classList.remove('visible');
        }

        // Trigger finish callback almost immediately
        gsap.delayedCall(0.2, () => {
          if (this.onCompleteCallback) {
            this.onCompleteCallback();
          }
        });
      },
    });
  }

  updateProgressUI(progress) {
    const percent = Math.floor(progress * 99) + 1;
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    if (this.progressPercent) {
      this.progressPercent.innerText = `${percent}%`;
    }
  }

  resetGommage() {
    this.#gommageTween?.kill();
    this.#spawnDustTween?.kill();
    this.#spawnPetalTween?.kill();

    this.#gommageTween = null;
    this.#spawnDustTween = null;
    this.#spawnPetalTween = null;

    this.#uProgress.value = 0;
    this.updateProgressUI(0);
    this.progressContainer.classList.remove('visible');
  }
}
