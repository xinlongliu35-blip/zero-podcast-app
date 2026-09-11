//msdfText.js

import * as THREE from 'three/webgpu';
import { MSDFTextGeometry, MSDFTextNodeMaterial } from 'three-msdf-text-utils/webgpu';
import { texture, mix, uniform, clamp, pow, attribute, step, float, smoothstep, mrt } from 'three/tsl';

export default class MSDFText {
  constructor() {}

  #worldPositionBounds;

  async initialize(
    text = 'welcome',
    position = new THREE.Vector3(0, 0, 0),
    uProgress,
    perlinTexture,
    fontAtlasTexture
  ) {
    // Load font data
    console.log('Fetching font data from /fonts/Cinzel/Cinzel.json...');
    const response = await fetch('/fonts/Cinzel/Cinzel.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch font data: ${response.statusText}`);
    }
    const fontData = await response.json();
    console.log('Font data loaded successfully');

    // Create text geometry
    const textGeometry = new MSDFTextGeometry({
      text,
      font: fontData,
      width: 1000,
      align: 'center',
    });

    const textMaterial = this.createTextMaterial(fontAtlasTexture, perlinTexture, uProgress);

    // Adjust to remove visual artifacts
    textMaterial.alphaTest = 0.1;
    const mesh = new THREE.Mesh(textGeometry, textMaterial);

    // With this we make the height of lineHeight 0.45 world units for a perfect mobile fit
    const targetLineHeight = 0.45;
    const lineHeightPx = fontData.common.lineHeight;
    let textScale = targetLineHeight / lineHeightPx;

    mesh.scale.set(textScale, textScale, textScale);
    const meshOffset = -(textGeometry.layout.width / 2) * textScale;

    // Position text in the upper half of the screen to leave plenty of space for button
    mesh.position.set(position.x + meshOffset, position.y + 0.6, position.z + 0.8);
    mesh.rotation.x = Math.PI;
    // Compute the world position bounds of our text
    textGeometry.computeBoundingBox();
    mesh.updateWorldMatrix(true, false);
    this.#worldPositionBounds = new THREE.Box3().setFromObject(mesh);
    return mesh;
  }

  getRandomPositionInMesh() {
    const min = this.#worldPositionBounds.min;
    const max = this.#worldPositionBounds.max;
    const x = Math.random() * (max.x - min.x) + min.x;
    const y = Math.random() * (max.y - min.y) + min.y;
    const z = Math.random() * 0.5;
    return new THREE.Vector3(x, y, z);
  }

  createTextMaterial(fontAtlasTexture, perlinTexture, uProgress) {
    const textMaterial = new MSDFTextNodeMaterial({
      map: fontAtlasTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const glyphUv = attribute('glyphUv', 'vec2');
    const center = attribute('center', 'vec2');

    const uNoiseRemapMin = uniform(0.48);
    const uNoiseRemapMax = uniform(0.9);
    const uCenterScale = uniform(0.05);
    const uGlyphScale = uniform(0.75);
    const uDissolvedColor = uniform(new THREE.Color('#333333'));
    const uDesatComplete = uniform(0.45);
    const uBaseColor = uniform(new THREE.Color('#000000'));

    const customUv = center.mul(uCenterScale).add(glyphUv.mul(uGlyphScale));

    const perlinTextureNode = texture(perlinTexture, customUv).x;
    const perlinRemap = clamp(perlinTextureNode.sub(uNoiseRemapMin).div(uNoiseRemapMax.sub(uNoiseRemapMin)), 0, 1);
    const dissolve = step(uProgress, perlinRemap);
    const desaturationProgress = smoothstep(float(0.0), uDesatComplete, uProgress);

    const colorMix = mix(uBaseColor, uDissolvedColor, desaturationProgress);
    textMaterial.colorNode = colorMix;
    const msdfOpacity = textMaterial.opacityNode;
    textMaterial.opacityNode = msdfOpacity.mul(dissolve);
    textMaterial.mrtNode = mrt({
      bloomIntensity: float(0.4).mul(dissolve),
    });

    return textMaterial;
  }
}
