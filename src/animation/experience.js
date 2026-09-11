//experience.js

import * as THREE from 'three/webgpu';
import GommageOrchestrator from './gommageOrchestrator.js';
import { float, mrt, pass, output } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';

export class Experience {
  #threejs = null;
  #scene = null;
  #camera = null;
  #webgpuComposer = null;
  orchestrator = null;

  constructor() {}

  async initialize(container) {
    try {
      await this.#setupProject(container);
      window.addEventListener('resize', this.#onWindowResize_.bind(this), false);
      await this.#setupPostprocessing();
      this.#raf();
    } catch (error) {
      console.error('Experience initialization failed:', error);
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '50%';
      errorDiv.style.left = '50%';
      errorDiv.style.transform = 'translate(-50%, -50%)';
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
      errorDiv.style.padding = '20px';
      errorDiv.style.zIndex = '10000';
      errorDiv.innerHTML = `<h2>Initialization Error</h2><p>${error.message}</p><p>Check console for details.</p>`;
      document.body.appendChild(errorDiv);
      throw error;
    }
  }

  async #setupProject(container) {
    this.container = container;
    this.#threejs = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    await this.#threejs.init();

    this.#threejs.shadowMap.enabled = false;
    this.#threejs.toneMapping = THREE.ACESFilmicToneMapping;
    this.#threejs.setClearColor(0xFFFFFF, 1);
    
    const width = container.clientWidth || 375;
    const height = container.clientHeight || 812;
    this.#threejs.setSize(width, height);
    this.#threejs.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.#threejs.domElement);

    // Camera Setup !
    const fov = 45;
    const aspect = width / height;
    const near = 0.1;
    const far = 25;
    this.#camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.#camera.position.set(0, 0, 5);
    
    // Initial resize to ensure correct FOV and size
    setTimeout(() => this.#onWindowResize_(), 100);
    
    this.#scene = new THREE.Scene();
    this.orchestrator = new GommageOrchestrator();
    await this.orchestrator.initialize(this.#scene);
  }

  async #setupPostprocessing() {
    this.#webgpuComposer = new THREE.PostProcessing(this.#threejs);
    const scenePass = pass(this.#scene, this.#camera);

    scenePass.setMRT(
      mrt({
        output,
        bloomIntensity: float(0),
      })
    );
    let outNode = scenePass;

    const outputPass = scenePass.getTextureNode();
    const bloomIntensityPass = scenePass.getTextureNode('bloomIntensity');
    const bloomPass = bloom(outputPass.mul(bloomIntensityPass), 0.8);
    outNode = outNode.add(bloomPass);

    this.#webgpuComposer.outputNode = outNode.renderOutput();
    this.#webgpuComposer.needsUpdate = true;
  }

  #onWindowResize_() {
    if (!this.container || !this.#camera || !this.#threejs) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (width === 0 || height === 0) return;

    this.#camera.aspect = width / height;
    
    // Fixed vertical FOV for better predictability
    this.#camera.fov = 45; 
    
    // Adjust camera Z based on aspect ratio to keep text in view
    // If it's too narrow, we move the camera back
    const minAspect = 375 / 812;
    if (this.#camera.aspect < minAspect) {
      this.#camera.position.z = 5 * (minAspect / this.#camera.aspect);
    } else {
      this.#camera.position.z = 5;
    }

    this.#camera.updateProjectionMatrix();
    this.#threejs.setSize(width, height);
    
    if (this.#webgpuComposer) {
      this.#webgpuComposer.needsUpdate = true;
    }
  }

  #render() {
    //this.#threejs.render(this.#scene, this.#camera);
    if (this.#webgpuComposer) {
      this.#webgpuComposer.render();
    }
  }

  #raf() {
    this.rafId = requestAnimationFrame((t) => {
      this.#render();
      this.#raf();
    });
  }

  dispose() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('resize', this.#onWindowResize_);
    if (this.#threejs) {
      this.#threejs.dispose();
    }
  }
}
