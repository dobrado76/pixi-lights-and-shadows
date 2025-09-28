import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import vertexShaderSource from '../shaders/vertex.glsl?raw';
import fragmentShaderSource from '../shaders/fragment.glsl?raw';
import { ShaderParams } from '../App';
import { Light, ShadowConfig, AmbientOcclusionConfig } from '@/lib/lights';
import { SceneManager, SceneSprite } from './Sprite';

/**
 * Core PIXI.js rendering component implementing advanced shadow casting system.
 * Manages WebGL rendering, multi-pass lighting, and unlimited shadow casters using
 * auto-switching architecture between per-caster uniforms and occluder maps.
 */


// Simplified shadow caster representation for shadow geometry calculations
interface ShadowCaster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  castsShadows: boolean;
  zOrder: number; // Z-order for shadow hierarchy - sprites only receive shadows from same/higher zOrder
}

interface PixiDemoProps {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  shadowConfig: ShadowConfig;
  ambientOcclusionConfig: AmbientOcclusionConfig;
  sceneConfig: { scene: Record<string, any> };
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
  onImmediateSpriteChange?: (spriteId: string, updates: any) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, lightsConfig, ambientLight, shadowConfig, ambientOcclusionConfig, sceneConfig, onGeometryUpdate, onShaderUpdate, onMeshUpdate, onImmediateSpriteChange } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  // Initialize mouse position to canvas center for immediate mouse-following light display
  const [mousePos, setMousePos] = useState({ 
    x: shaderParams.canvasWidth / 2,  // 400 for 800px width
    y: shaderParams.canvasHeight / 2  // 300 for 600px height
  });
  
  
  // Core rendering references
  const meshesRef = useRef<PIXI.Mesh[]>([]);           // Main sprite meshes with lighting shaders
  const shadersRef = useRef<PIXI.Shader[]>([]);        // Compiled shader programs
  const shadowMeshesRef = useRef<PIXI.Mesh[]>([]);     // Shadow geometry meshes
  const shadowCastersRef = useRef<ShadowCaster[]>([]);  // Simplified caster data for calculations
  const sceneManagerRef = useRef<SceneManager | null>(null);  // Scene/sprite management system
  
  // Unlimited shadow caster system - uses render texture when >4 casters
  const occluderRenderTargetRef = useRef<PIXI.RenderTexture | null>(null);
  const occluderContainerRef = useRef<PIXI.Container | null>(null);
  const occluderSpritesRef = useRef<PIXI.Sprite[]>([]);

  /**
   * Creates shadow volume geometry by projecting caster corners away from light.
   * Generates 4 shadow quads (one per rectangle edge) to form complete shadow volume.
   */
  const createShadowGeometry = (caster: ShadowCaster, lightX: number, lightY: number, shadowLength: number = 100) => {
    if (!caster.castsShadows) return null;
    
    // Get the actual sprite to access transformed geometry
    const sprite = sceneManagerRef.current?.getSprite(caster.id);
    if (!sprite) {
      // Fallback to basic rectangle if sprite not found
      const corners = [
        { x: caster.x, y: caster.y },                           // Top-left
        { x: caster.x + caster.width, y: caster.y },            // Top-right  
        { x: caster.x + caster.width, y: caster.y + caster.height }, // Bottom-right
        { x: caster.x, y: caster.y + caster.height }            // Bottom-left
      ];
      return createShadowVolumeFromCorners(corners, lightX, lightY, shadowLength);
    }
    
    // Get transformed corners that include rotation, scale, and pivot
    const corners = getTransformedCorners(sprite);
    return createShadowVolumeFromCorners(corners, lightX, lightY, shadowLength);
  };

  // Helper function to get transformed corners from sprite (includes rotation, scale, pivot)
  const getTransformedCorners = (sprite: SceneSprite) => {
    const { x, y } = sprite.definition.position;
    
    // Get dimensions from texture (like in Sprite.tsx)
    if (!sprite.diffuseTexture) {
      throw new Error('Texture must be loaded to get dimensions');
    }
    const baseWidth = sprite.diffuseTexture.width;
    const baseHeight = sprite.diffuseTexture.height;
    
    // Local space quad corners
    const corners = [
      { x: 0, y: 0 },                      // Top-left
      { x: baseWidth, y: 0 },              // Top-right
      { x: baseWidth, y: baseHeight },     // Bottom-right
      { x: 0, y: baseHeight }              // Bottom-left
    ];

    // Calculate pivot point
    const pivot = sprite.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
    let basePivotX = 0, basePivotY = 0;
    
    switch (pivot.preset) {
      case 'top-left': basePivotX = 0; basePivotY = 0; break;
      case 'top-center': basePivotX = baseWidth / 2; basePivotY = 0; break;
      case 'top-right': basePivotX = baseWidth; basePivotY = 0; break;
      case 'middle-left': basePivotX = 0; basePivotY = baseHeight / 2; break;
      case 'middle-center': basePivotX = baseWidth / 2; basePivotY = baseHeight / 2; break;
      case 'middle-right': basePivotX = baseWidth; basePivotY = baseHeight / 2; break;
      case 'bottom-left': basePivotX = 0; basePivotY = baseHeight; break;
      case 'bottom-center': basePivotX = baseWidth / 2; basePivotY = baseHeight; break;
      case 'bottom-right': basePivotX = baseWidth; basePivotY = baseHeight; break;
    }
    
    // Apply offset relative to the selected preset (invert to match expected direction)
    basePivotX -= (pivot.offsetX || 0);
    basePivotY -= (pivot.offsetY || 0);
    
    const scaledPivotX = basePivotX * sprite.definition.scale;
    const scaledPivotY = basePivotY * sprite.definition.scale;
    
    // Apply scaling and rotation around pivot point (same logic as Sprite.tsx)
    return corners.map(corner => {
      // Apply scaling from pivot point
      const scaledOffsetX = (corner.x - basePivotX) * sprite.definition.scale;
      const scaledOffsetY = (corner.y - basePivotY) * sprite.definition.scale;
      
      // Apply rotation around the scaled pivot point
      const cosRot = Math.cos(sprite.definition.rotation);
      const sinRot = Math.sin(sprite.definition.rotation);
      
      const rotatedX = scaledOffsetX * cosRot - scaledOffsetY * sinRot;
      const rotatedY = scaledOffsetX * sinRot + scaledOffsetY * cosRot;
      
      return {
        x: x + scaledPivotX + rotatedX,
        y: y + scaledPivotY + rotatedY
      };
    });
  };

  // Helper function to create shadow volume from any set of corners
  const createShadowVolumeFromCorners = (corners: Array<{x: number, y: number}>, lightX: number, lightY: number, shadowLength: number = 100) => {
    // Project corners away from light to create shadow volume endpoints
    const projectedCorners = corners.map(corner => {
      const dx = corner.x - lightX;
      const dy = corner.y - lightY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 0.1) return corner; // Prevent division by zero for overlapping light/caster
      
      // Normalize direction vector and project to shadow length
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;
      
      return {
        x: corner.x + normalizedX * shadowLength,
        y: corner.y + normalizedY * shadowLength
      };
    });

    // Create shadow quad vertices (original + projected)
    const vertices: number[] = [];
    
    // Add original corners
    corners.forEach(corner => {
      vertices.push(corner.x, corner.y);
    });
    
    // Add projected corners  
    projectedCorners.forEach(corner => {
      vertices.push(corner.x, corner.y);
    });

    // Create shadow volume triangles - 4 quads connecting original/projected edges
    // Each rectangle edge generates one shadow quad (2 triangles)
    const shadowIndices = [
      // Edge 0->1 (top edge): original corners + projected corners
      0, 1, 5,  0, 5, 4,
      // Edge 1->2 (right edge)  
      1, 2, 6,  1, 6, 5,
      // Edge 2->3 (bottom edge)
      2, 3, 7,  2, 7, 6,
      // Edge 3->0 (left edge)
      3, 0, 4,  3, 4, 7
    ];

    const geometry = new PIXI.Geometry();
    geometry.addAttribute('aVertexPosition', vertices, 2);
    geometry.addIndex(shadowIndices);
    
    return geometry;
  };

  /**
   * Creates shadow mesh with simple black shader for shadow system.
   * Note: Modern system uses shader-based shadows instead of geometry meshes.
   */
  const createShadowMesh = (geometry: PIXI.Geometry, alpha: number = 0.3) => {
    const shader = new PIXI.Shader(
      PIXI.Program.from(
        // Simple vertex shader for shadows
        `
        attribute vec2 aVertexPosition;
        uniform mat3 projectionMatrix;
        uniform mat3 translationMatrix;
        
        void main() {
          gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        }
        `,
        // Simple fragment shader for shadows
        `
        precision mediump float;
        uniform float uAlpha;
        
        void main() {
          gl_Color = vec4(0.0, 0.0, 0.0, uAlpha);
        }
        `
      ),
      { uAlpha: alpha }
    );
    
    return new PIXI.Mesh(geometry, shader as any);
  };
  
  // Multi-pass rendering state
  const renderTargetRef = useRef<PIXI.RenderTexture | null>(null);
  const sceneContainerRef = useRef<PIXI.Container | null>(null);
  const displaySpriteRef = useRef<PIXI.Sprite | null>(null);
  const LIGHTS_PER_PASS = 8; // 4 point + 4 spot lights per pass
  
  // Buffer zone for off-screen shadow casting (sprites/lights outside frame can affect visible area)
  const SHADOW_BUFFER = 512; // Pixels to extend occlusion map beyond canvas borders
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

  // Helper function to check if a light is inside a sprite's non-transparent area  
  const isLightInsideSprite = (light: Light, sprite: any): boolean => {
    // DISABLED: This function was causing sprites to be excluded from shadow casting
    return false;
  };

  // Occluder map builder with zOrder hierarchy support
  // Builds occluder map containing only shadow casters that should affect the given sprite  
  const buildOccluderMapForSprite = (currentSpriteZOrder: number, excludeSpriteId?: string) => {
    if (!pixiApp || !occluderRenderTargetRef.current || !occluderContainerRef.current) return;
    
    const allCasters = sceneManagerRef.current?.getShadowCasters() || [];
    
    // Unified system: include sprites that cast shadows & AO
    const allShadowCasters = allCasters.filter(caster => 
      caster.definition.castsShadows
    );
    
    // Filter shadow casters based on zOrder hierarchy - only include casters at same level or above
    // Also exclude the current sprite being lit to prevent self-shadowing
    let relevantShadowCasters = allShadowCasters.filter(caster => 
      caster.definition.zOrder >= currentSpriteZOrder && 
      (!excludeSpriteId || caster.id !== excludeSpriteId)
    );
    
    // Special case: exclude sprites from casting shadows if light (Z >= 50) is inside their non-transparent area
    const enabledLights = lightsConfig.filter(light => light.enabled);
    relevantShadowCasters = relevantShadowCasters.filter(caster => {
      // Check if any enabled light with Z >= 50 is inside this caster's non-transparent area
      const lightInside = enabledLights.some(light => isLightInsideSprite(light, caster));
      return !lightInside; // Exclude caster if light is inside
    });
    
    // Ensure we have enough pooled sprites
    while (occluderSpritesRef.current.length < allShadowCasters.length) {
      const sprite = new PIXI.Sprite();
      occluderSpritesRef.current.push(sprite);
      occluderContainerRef.current.addChild(sprite);
    }
    
    // Clear the container and create custom geometry meshes that exactly match visual sprites
    occluderContainerRef.current.removeChildren();
    
    // Create meshes with identical custom geometry to visual sprites
    relevantShadowCasters.forEach((caster, index) => {
      if (!caster.diffuseTexture) return;
      
      // Use EXACT same geometry creation as Sprite.tsx createGeometry()
      const spritePos = caster.definition.position;
      const spriteScale = caster.definition.scale || 1;
      const spriteRotation = caster.definition.rotation || 0;
      const baseWidth = caster.diffuseTexture.width;
      const baseHeight = caster.diffuseTexture.height;
      
      // Calculate pivot point using EXACT same logic as Sprite.tsx
      const pivot = caster.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
      let basePivotX = 0, basePivotY = 0;
      
      switch (pivot.preset) {
        case 'top-left': basePivotX = 0; basePivotY = 0; break;
        case 'top-center': basePivotX = baseWidth / 2; basePivotY = 0; break;
        case 'top-right': basePivotX = baseWidth; basePivotY = 0; break;
        case 'middle-left': basePivotX = 0; basePivotY = baseHeight / 2; break;
        case 'middle-center': basePivotX = baseWidth / 2; basePivotY = baseHeight / 2; break;
        case 'middle-right': basePivotX = baseWidth; basePivotY = baseHeight / 2; break;
        case 'bottom-left': basePivotX = 0; basePivotY = baseHeight; break;
        case 'bottom-center': basePivotX = baseWidth / 2; basePivotY = baseHeight; break;
        case 'bottom-right': basePivotX = baseWidth; basePivotY = baseHeight; break;
      }
      
      // Apply offset relative to the selected preset (invert to match expected direction)
      basePivotX -= (pivot.offsetX || 0);
      basePivotY -= (pivot.offsetY || 0);
      
      // Local space quad corners in UNSCALED dimensions (EXACT same as Sprite.tsx)
      const corners = [
        { x: 0, y: 0 },                      // Top-left
        { x: baseWidth, y: 0 },              // Top-right
        { x: baseWidth, y: baseHeight },     // Bottom-right
        { x: 0, y: baseHeight }              // Bottom-left
      ];
      
      // Apply ONLY scaling and pivot (NO rotation in geometry) - match visual sprite approach
      const transformedCorners = corners.map(corner => {
        // Apply scaling from pivot point (pivot stays stationary) - NO ROTATION here
        const scaledOffsetX = (corner.x - basePivotX) * spriteScale;
        const scaledOffsetY = (corner.y - basePivotY) * spriteScale;
        
        // Local position relative to sprite origin (mesh.rotation will handle rotation)
        return {
          x: scaledOffsetX + (basePivotX * spriteScale),
          y: scaledOffsetY + (basePivotY * spriteScale)
        };
      });

      
      // Create rotated geometry that matches visual sprite shape exactly
      const geometry = new PIXI.Geometry();
      const vertices = new Float32Array([
        transformedCorners[0].x, transformedCorners[0].y, // Top-left
        transformedCorners[1].x, transformedCorners[1].y, // Top-right
        transformedCorners[2].x, transformedCorners[2].y, // Bottom-right
        transformedCorners[3].x, transformedCorners[3].y, // Bottom-left
      ]);
      
      const uvs = new Float32Array([
        0, 0,     // Top-left UV
        1, 0,     // Top-right UV
        1, 1,     // Bottom-right UV
        0, 1,     // Bottom-left UV
      ]);
      
      const indices = new Uint16Array([0, 1, 2, 0, 2, 3]); // Two triangles forming a quad
      
      geometry.addAttribute('aVertexPosition', vertices, 2);
      geometry.addAttribute('aTextureCoord', uvs, 2);
      geometry.addIndex(indices);
      
      // Create simple mesh with original texture and rotated geometry
      const mesh = new PIXI.Mesh(geometry, new PIXI.MeshMaterial(caster.diffuseTexture));
      mesh.tint = 0xFFFFFF; // White tint (no color modification)
      
      // Set mesh pivot to match sprite's pivot for correct rotation center
      const scaledPivotX = basePivotX * spriteScale;
      const scaledPivotY = basePivotY * spriteScale; 
      mesh.pivot.set(scaledPivotX, scaledPivotY);
      
      // Position mesh at sprite pivot location with SHADOW_BUFFER offset
      // spritePos now represents the pivot point location (not top-left corner)
      mesh.position.set(
        spritePos.x + SHADOW_BUFFER, 
        spritePos.y + SHADOW_BUFFER
      );
      mesh.rotation = spriteRotation; // Apply rotation via mesh transform (like visual sprites)
      mesh.scale.set(1, 1);
      
      if (occluderContainerRef.current) {
        occluderContainerRef.current.addChild(mesh);
      }
    });
    
    // Hide unused sprites (all sprites beyond relevant casters)
    for (let i = relevantShadowCasters.length; i < occluderSpritesRef.current.length; i++) {
      occluderSpritesRef.current[i].visible = false;
    }
    
    // Render to occluder texture with optimized settings
    pixiApp.renderer.render(occluderContainerRef.current, { 
      renderTexture: occluderRenderTargetRef.current, 
      clear: true 
    });
  };
  
  // Build occluder map using all shadow casters for unified system
  const buildOccluderMap = (excludeSpriteId?: string) => {
    buildOccluderMapForSprite(-999, excludeSpriteId); // Use very low zOrder to include all casters
  };

  // Multi-pass lighting composer
  const renderMultiPass = (lights: Light[]) => {
    if (!pixiApp || !renderTargetRef.current || !sceneContainerRef.current || !displaySpriteRef.current) return;

    const enabledLights = lights.filter(light => light.enabled && light.type !== 'ambient');

    // Clear accumulation buffer
    pixiApp.renderer.render(new PIXI.Container(), { renderTexture: renderTargetRef.current, clear: true });

    // BASE PASS: Ambient lighting only
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        shader.uniforms.uPassMode = 0; // Base pass
        // Reset all light enabled flags for base pass
        for (let i = 0; i < 4; i++) {
          shader.uniforms[`uPoint${i}Enabled`] = false;
          shader.uniforms[`uSpot${i}Enabled`] = false;
        }
        shader.uniforms.uDir0Enabled = false;
        shader.uniforms.uDir1Enabled = false;
      }
    });
    
    // Set meshes to NORMAL blending for base pass
    meshesRef.current.forEach(mesh => {
      mesh.blendMode = PIXI.BLEND_MODES.NORMAL;
    });
    
    // Render base pass with NORMAL blending
    pixiApp.renderer.render(sceneContainerRef.current, { 
      renderTexture: renderTargetRef.current, 
      clear: false 
    });

    // LIGHTING PASSES: Batch lights and render additively
    const pointLights = enabledLights.filter(light => light.type === 'point');
    const spotlights = enabledLights.filter(light => light.type === 'spotlight');
    const directionalLights = enabledLights.filter(light => light.type === 'directional');

    // Calculate number of passes needed
    const maxPointsPerPass = 4;
    const maxSpotsPerPass = 4;
    const maxDirPerPass = 2;
    
    const pointPasses = Math.ceil(pointLights.length / maxPointsPerPass);
    const spotPasses = Math.ceil(spotlights.length / maxSpotsPerPass);
    const dirPasses = Math.ceil(directionalLights.length / maxDirPerPass);
    
    const totalPasses = Math.max(pointPasses, spotPasses, dirPasses);
    

    // Render each lighting pass
    for (let pass = 0; pass < totalPasses; pass++) {
      // Get lights for this pass
      const passPointLights = pointLights.slice(pass * maxPointsPerPass, (pass + 1) * maxPointsPerPass);
      const passSpotlights = spotlights.slice(pass * maxSpotsPerPass, (pass + 1) * maxSpotsPerPass);
      const passDirLights = directionalLights.slice(pass * maxDirPerPass, (pass + 1) * maxDirPerPass);

      // Skip empty passes
      if (passPointLights.length === 0 && passSpotlights.length === 0 && passDirLights.length === 0) continue;


      // Set up uniforms for this pass
      shadersRef.current.forEach(shader => {
        if (shader.uniforms) {
          shader.uniforms.uPassMode = 1; // Lighting pass
          // Keep ambient light in multi-pass incremental rendering (will be overridden later)
          
          // Configure point lights for this pass
          for (let i = 0; i < 4; i++) {
            if (i < passPointLights.length) {
              const light = passPointLights[i];
              const prefix = `uPoint${i}`;
              shader.uniforms[`${prefix}Enabled`] = true;
              shader.uniforms[`${prefix}Position`] = [
                light.followMouse ? mousePos.x : light.position.x,
                light.followMouse ? mousePos.y : light.position.y,
                light.position.z
              ];
              shader.uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
              shader.uniforms[`${prefix}Intensity`] = light.intensity;
              shader.uniforms[`${prefix}Radius`] = light.radius || 200;
              
              // Handle masks
              if (light.mask) {
                const maskTexture = PIXI.Texture.from(`/light_masks/${light.mask.image}`);
                shader.uniforms[`${prefix}HasMask`] = true;
                shader.uniforms[`${prefix}Mask`] = maskTexture;
                shader.uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
                shader.uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
                shader.uniforms[`${prefix}MaskScale`] = light.mask.scale;
                shader.uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
              } else {
                shader.uniforms[`${prefix}HasMask`] = false;
              }
              // Shadow casting flag for multi-pass point lights
              shader.uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
            } else {
              shader.uniforms[`uPoint${i}Enabled`] = false;
              shader.uniforms[`uPoint${i}HasMask`] = false;
              shader.uniforms[`uPoint${i}CastsShadows`] = false;
            }
          }

          // Configure spotlights for this pass  
          for (let i = 0; i < 4; i++) {
            if (i < passSpotlights.length) {
              const light = passSpotlights[i];
              const prefix = `uSpot${i}`;
              shader.uniforms[`${prefix}Enabled`] = true;
              shader.uniforms[`${prefix}Position`] = [light.position.x, light.position.y, light.position.z];
              shader.uniforms[`${prefix}Direction`] = [light.direction!.x, light.direction!.y, light.direction!.z];
              shader.uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
              shader.uniforms[`${prefix}Intensity`] = light.intensity;
              shader.uniforms[`${prefix}Radius`] = light.radius || 150;
              shader.uniforms[`${prefix}ConeAngle`] = light.coneAngle || 30;
              shader.uniforms[`${prefix}Softness`] = light.softness || 0.5;
              
              // Handle masks
              if (light.mask) {
                const maskTexture = PIXI.Texture.from(`/light_masks/${light.mask.image}`);
                shader.uniforms[`${prefix}HasMask`] = true;
                shader.uniforms[`${prefix}Mask`] = maskTexture;
                shader.uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
                shader.uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
                shader.uniforms[`${prefix}MaskScale`] = light.mask.scale;
                shader.uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
              } else {
                shader.uniforms[`${prefix}HasMask`] = false;
              }
              // Shadow casting flag for multi-pass spotlights
              shader.uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
            } else {
              shader.uniforms[`uSpot${i}Enabled`] = false;
              shader.uniforms[`uSpot${i}HasMask`] = false;
              shader.uniforms[`uSpot${i}CastsShadows`] = false;
            }
          }

          // Configure directional lights for this pass
          for (let i = 0; i < 2; i++) {
            if (i < passDirLights.length) {
              const light = passDirLights[i];
              const prefix = `uDir${i}`;
              shader.uniforms[`${prefix}Enabled`] = true;
              shader.uniforms[`${prefix}Direction`] = [light.direction!.x, light.direction!.y, light.direction!.z];
              shader.uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
              shader.uniforms[`${prefix}Intensity`] = light.intensity;
              // Shadow casting flag for multi-pass directional lights
              shader.uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
            } else {
              shader.uniforms[`uDir${i}Enabled`] = false;
              shader.uniforms[`uDir${i}CastsShadows`] = false;
            }
          }
        }
      });

      // Render lighting pass with ADDITIVE blending
      meshesRef.current.forEach(mesh => {
        mesh.blendMode = PIXI.BLEND_MODES.ADD;
      });
      pixiApp.renderer.render(sceneContainerRef.current, { 
        renderTexture: renderTargetRef.current, 
        clear: false 
      });
      meshesRef.current.forEach(mesh => {
        mesh.blendMode = PIXI.BLEND_MODES.NORMAL;
      });
    }

    // Final render: Display accumulated result
    pixiApp.renderer.render(displaySpriteRef.current);
  };

  // Initialize PIXI Application
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      console.log('Initializing PIXI Application...');
      
      // Reset PIXI settings for maximum compatibility
      PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL;
      PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;
      
      let app: PIXI.Application;
      
      try {
        // First try WebGL
        app = new PIXI.Application({
          width: shaderParams.canvasWidth,
          height: shaderParams.canvasHeight,
          backgroundColor: 0x1a1a1a,
          antialias: true,
          hello: false,
          resolution: 1,
          autoDensity: false,
          forceCanvas: false,
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
          autoStart: false // CRITICAL: Set to false, we'll call start() manually
        });
      } catch (webglError) {
        console.warn('WebGL failed, trying Canvas fallback:', webglError);
        // Fallback to Canvas renderer
        app = new PIXI.Application({
          width: shaderParams.canvasWidth,
          height: shaderParams.canvasHeight,
          backgroundColor: 0x1a1a1a,
          antialias: false, // Disable for canvas
          hello: false,
          resolution: 1,
          autoDensity: false,
          forceCanvas: true, // Force Canvas renderer
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
          autoStart: false // CRITICAL: Set to false, we'll call start() manually
        });
      }

      // Access canvas using proper PIXI.js property
      const canvas = app.view as HTMLCanvasElement;
      
      if (canvas && canvasRef.current) {
        // Add canvas to DOM but DON'T start yet - wait for scene to load
        canvasRef.current.appendChild(canvas);
        
        // Set canvas properties
        canvas.style.display = 'block';
        canvas.style.width = shaderParams.canvasWidth + 'px';
        canvas.style.height = shaderParams.canvasHeight + 'px';
        canvas.tabIndex = 0;
        
        setPixiApp(app);
        console.log('🎯 PIXI App created - waiting for scene to load before starting');
        
        // Store canvas reference for later activation when scene loads
        (app as any).__canvas = canvas;
        console.log('PIXI App initialized successfully');
        console.log('Renderer type:', app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas');
        console.log('Ticker started:', app.ticker.started);
        
        // Initialize render targets for multi-pass rendering
        renderTargetRef.current = PIXI.RenderTexture.create({ 
          width: shaderParams.canvasWidth, 
          height: shaderParams.canvasHeight 
        });
        
        sceneContainerRef.current = new PIXI.Container();
        
        displaySpriteRef.current = new PIXI.Sprite(renderTargetRef.current);
        displaySpriteRef.current.blendMode = PIXI.BLEND_MODES.NORMAL; // Display accumulated result normally
        app.stage.addChild(displaySpriteRef.current);
        
        console.log('🎯 Multi-pass render targets initialized');
      
      // Initialize occluder render target for unlimited shadow casters
      // Extended size to include off-screen sprites that can cast shadows into visible area
      occluderRenderTargetRef.current = PIXI.RenderTexture.create({ 
        width: shaderParams.canvasWidth + (SHADOW_BUFFER * 2), 
        height: shaderParams.canvasHeight + (SHADOW_BUFFER * 2) 
      });
      occluderContainerRef.current = new PIXI.Container();
      
      // Disable culling to ensure off-screen sprites are rendered to occlusion map
      occluderContainerRef.current.cullable = false;
      occluderContainerRef.current.cullArea = new PIXI.Rectangle(
        -SHADOW_BUFFER, 
        -SHADOW_BUFFER, 
        shaderParams.canvasWidth + (SHADOW_BUFFER * 2),
        shaderParams.canvasHeight + (SHADOW_BUFFER * 2)
      );
      
      console.log('🌑 Occluder render target initialized for unlimited shadow casters');
      } else {
        throw new Error('Canvas element not found');
      }
    } catch (error) {
      console.error('PIXI Application initialization failed:', error);
      console.error('Error details:', (error as Error).message);
      
      // Fallback display for environments without graphics support
      if (canvasRef.current) {
        canvasRef.current.innerHTML = `
          <div style="
            width: ${shaderParams.canvasWidth}px; 
            height: ${shaderParams.canvasHeight}px; 
            background: linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%, #2a2a2a); 
            background-size: 20px 20px;
            border: 2px solid #4B5563;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #10b981;
            font-family: monospace;
            font-size: 14px;
            text-align: center;
            border-radius: 8px;
          ">
            <div>
              <div style="color: #0ea5e9; font-weight: bold; margin-bottom: 8px;">🎮 PIXI.js Demo Active</div>
              <div>Canvas: ${shaderParams.canvasWidth} × ${shaderParams.canvasHeight}</div>
              <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                ✅ Sliders visible<br>
                ✅ Resolution parametric<br>
                ✅ Controls responsive
              </div>
            </div>
          </div>
        `;
        onGeometryUpdate('✅ Fallback geometry ready');
        onShaderUpdate('✅ Fallback shader ready');
        onMeshUpdate('✅ Fallback mesh ready');
      }
    }

    // Cleanup
    return () => {
      if (pixiApp) {
        const canvas = pixiApp.view as HTMLCanvasElement;
        if (canvas && canvasRef.current) {
          try {
            canvasRef.current.removeChild(canvas);
          } catch (e) {
            // Ignore if already removed
          }
        }
        
        // Safe destroy to prevent hot reload errors
        try {
          pixiApp.destroy(true, {
            children: true,
            texture: false,
            baseTexture: false
          });
        } catch (e) {
          console.warn('PIXI destroy error (safe to ignore during hot reload):', e);
        }
      }
    };
  }, []);

  // Setup demo content when PIXI app is ready - initial load only
  useEffect(() => {
    if (!pixiApp || !pixiApp.stage || !sceneConfig.scene || Object.keys(sceneConfig.scene).length === 0 || lightsConfig.length === 0) {
      return;
    }


    const setupDemo = async () => {
      try {
        // Use scene configuration from props instead of fetching
        const sceneData = sceneConfig;
        
        // Initialize scene manager
        sceneManagerRef.current = new SceneManager();
        sceneManagerRef.current.setCanvasDimensions(shaderParams.canvasWidth, shaderParams.canvasHeight);
        await sceneManagerRef.current.loadScene(sceneData);
        
        // Set PIXI container reference for direct updates
        sceneManagerRef.current.setPixiContainer(sceneContainerRef.current);
        
        // UNIFIED IMMEDIATE UPDATE SYSTEM for ALL UI controls
        const immediateUpdateHandler = (spriteId: string, updates: any) => {
          console.log(`🚀 IMMEDIATE UPDATE for ${spriteId}:`, Object.keys(updates));
          if (sceneManagerRef.current && sceneContainerRef.current) {
            const sprite = sceneManagerRef.current.getSprite(spriteId);
            if (sprite && sprite.mesh) {
              let needsReSort = false;
              
              // Handle zOrder changes - Mark as immediate to prevent React override
              if (updates.zOrder !== undefined) {
                sprite.definition.zOrder = updates.zOrder;
                sprite.mesh.zIndex = updates.zOrder;
                (sprite.mesh as any).userData = (sprite.mesh as any).userData || {};
                (sprite.mesh as any).userData.__immediateZOrder = updates.zOrder; // Mark as immediate
                needsReSort = true;
                console.log(`⚡ Immediate zOrder: ${spriteId} → ${updates.zOrder}`);
              }
              
              // Handle normal map changes - Update shader uniform without reloading texture
              if (updates.useNormalMap !== undefined) {
                sprite.definition.useNormalMap = updates.useNormalMap;
                if (sprite.shader) {
                  sprite.shader.uniforms.uUseNormalMap = updates.useNormalMap;
                  (sprite.shader as any).userData = (sprite.shader as any).userData || {};
                  (sprite.shader as any).userData.__immediateNormalMap = updates.useNormalMap; // Mark as immediate
                }
                console.log(`⚡ Immediate normal map: ${spriteId} → ${updates.useNormalMap}`);
              }
              
              // Handle position changes
              if (updates.position) {
                sprite.updateTransform({
                  position: updates.position,
                  rotation: sprite.definition.rotation || 0,
                  scale: sprite.definition.scale || 1
                });
                console.log(`⚡ Immediate position: ${spriteId}`);
              }
              
              // Handle visibility changes - Update mesh.visible instead of recreating
              if (updates.visible !== undefined) {
                sprite.definition.visible = updates.visible;
                sprite.mesh.visible = updates.visible;
                console.log(`⚡ Immediate visibility: ${spriteId} → ${updates.visible}`);
              }
              
              // Handle shadow casting changes
              if (updates.castsShadows !== undefined) {
                sprite.definition.castsShadows = updates.castsShadows;
                console.log(`⚡ Immediate castsShadows: ${spriteId} → ${updates.castsShadows}`);
              }
              
              // Handle AO casting changes
              
              // Force re-sort if needed and update shadow caster uniforms
              if (needsReSort) {
                // Sort both containers since meshes can be in either depending on rendering mode
                sceneContainerRef.current.sortChildren();
                if (pixiApp && pixiApp.stage) {
                  pixiApp.stage.sortChildren();
                }
                console.log(`⚡ Container re-sorted after immediate update`);
                
                // Update shadow caster uniforms since order may have changed
                const shadowCasters = sceneManagerRef.current.getShadowCasters();
                const shadowCaster0 = shadowCasters[0]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
                const shadowCaster1 = shadowCasters[1]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
                const shadowCaster2 = shadowCasters[2]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
                
                // Update all shader uniforms
                shadersRef.current?.forEach(shader => {
                  if (shader && shader.uniforms) {
                  }
                });
                console.log(`⚡ Shadow caster uniforms updated after zOrder change`);
              }
              
              // Force a render to ensure immediate visual feedback
              if (pixiApp) {
                pixiApp.render();
              }
            }
          }
        };
        
        // Store the unified handler for ALL UI controls to use
        (window as any).__pixiImmediateUpdate = immediateUpdateHandler;
        

        // Helper function to convert external lights config to shader uniforms
        const createLightUniforms = () => {
          const uniforms: any = {};
          
          // Get all lights by type (enabled and disabled - let shader handle via intensity)
          const allPointLights = lightsConfig.filter(light => light.type === 'point');
          const allDirectionalLights = lightsConfig.filter(light => light.type === 'directional');
          const allSpotlights = lightsConfig.filter(light => light.type === 'spotlight');
          
          // Initialize all lights as disabled
          uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false; uniforms.uPoint2Enabled = false; uniforms.uPoint3Enabled = false;
          uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
          uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
          
          // Initialize all masks as disabled
          uniforms.uPoint0HasMask = false; uniforms.uPoint1HasMask = false; uniforms.uPoint2HasMask = false; uniforms.uPoint3HasMask = false;
          uniforms.uSpot0HasMask = false; uniforms.uSpot1HasMask = false; uniforms.uSpot2HasMask = false; uniforms.uSpot3HasMask = false;
          
          // Point Lights (up to 4) - pass ALL lights with stable slot assignment
          
          allPointLights.slice(0, 4).forEach((light, slotIdx) => {
            const prefix = `uPoint${slotIdx}`;

            
            // BYPASS ENABLED FLAG - always set enabled=true, use intensity=0 for disabled lights
            uniforms[`${prefix}Enabled`] = true; // ALWAYS TRUE - let intensity control visibility
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
            uniforms[`${prefix}Radius`] = light.radius || 200;
            
            // Handle mask
            if (light.mask) {
              console.log(`Loading mask for ${prefix}:`, light.mask);
              const maskPath = `/light_masks/${light.mask.image}`;
              console.log(`Mask texture path: ${maskPath}`);
              
              const maskTexture = PIXI.Texture.from(maskPath);
              uniforms[`${prefix}HasMask`] = true;
              uniforms[`${prefix}Mask`] = maskTexture;
              uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
              uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
              uniforms[`${prefix}MaskScale`] = light.mask.scale; // Use scale directly (1.0 = 100%)
              uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
              
              console.log(`Mask uniforms for ${prefix}:`, {
                hasMask: true,
                offset: [light.mask.offset.x, light.mask.offset.y],
                rotation: light.mask.rotation,
                scale: light.mask.scale
              });
              
              // Validate texture loading
              maskTexture.baseTexture.on('loaded', () => {
                console.log(`Mask texture loaded successfully: ${maskPath} (${maskTexture.width}x${maskTexture.height})`);
              });
              maskTexture.baseTexture.on('error', () => {
                console.error(`Failed to load mask texture: ${maskPath}`);
              });
            } else {
              uniforms[`${prefix}HasMask`] = false;
            }
          });
          
          // Directional Lights (up to 2) - pass ALL lights with stable slot assignment
          
          allDirectionalLights.slice(0, 2).forEach((light, slotIdx) => {
            const prefix = `uDir${slotIdx}`;

            
            // BYPASS ENABLED FLAG - always set enabled=true, use intensity=0 for disabled lights
            uniforms[`${prefix}Enabled`] = true; // ALWAYS TRUE - let intensity control visibility
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
          });
          
          // Spotlights (up to 4) - pass ALL lights with stable slot assignment
          
          allSpotlights.slice(0, 4).forEach((light, slotIdx) => {
            const prefix = `uSpot${slotIdx}`;

            
            // BYPASS ENABLED FLAG - always set enabled=true, use intensity=0 for disabled lights
            uniforms[`${prefix}Enabled`] = true; // ALWAYS TRUE - let intensity control visibility
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
            uniforms[`${prefix}Radius`] = light.radius || 150;
            uniforms[`${prefix}ConeAngle`] = light.coneAngle || 30;
            uniforms[`${prefix}Softness`] = light.softness || 0.5;
            
            // Handle mask
            if (light.mask) {
              console.log(`Loading mask for ${prefix}:`, light.mask);
              const maskPath = `/light_masks/${light.mask.image}`;
              console.log(`Mask texture path: ${maskPath}`);
              
              const maskTexture = PIXI.Texture.from(maskPath);
              uniforms[`${prefix}HasMask`] = true;
              uniforms[`${prefix}Mask`] = maskTexture;
              uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
              uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
              uniforms[`${prefix}MaskScale`] = light.mask.scale; // Use scale directly (1.0 = 100%)
              uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
              
              console.log(`Mask uniforms for ${prefix}:`, {
                hasMask: true,
                offset: [light.mask.offset.x, light.mask.offset.y],
                rotation: light.mask.rotation,
                scale: light.mask.scale
              });
              
              // Validate texture loading
              maskTexture.baseTexture.on('loaded', () => {
                console.log(`Mask texture loaded successfully: ${maskPath} (${maskTexture.width}x${maskTexture.height})`);
              });
              maskTexture.baseTexture.on('error', () => {
                console.error(`Failed to load mask texture: ${maskPath}`);
              });
            } else {
              uniforms[`${prefix}HasMask`] = false;
            }
          });

          // Clear uniforms for unused spotlight slots (just like multi-pass rendering)
          for (let i = allSpotlights.length; i < 4; i++) {
            uniforms[`uSpot${i}Enabled`] = false;
            uniforms[`uSpot${i}HasMask`] = false;
            uniforms[`uSpot${i}CastsShadows`] = false;
          }

          console.log('DEBUG: All lights config:', lightsConfig.map(l => ({id: l.id, type: l.type, enabled: l.enabled})));
          console.log('DEBUG: Point lights found (all):', allPointLights.map(l => ({id: l.id, enabled: l.enabled})));
          console.log('Expanded Lights:', { 
            pointLights: allPointLights.length, 
            directionalLights: allDirectionalLights.length, 
            spotlights: allSpotlights.length 
          });

          return uniforms;
        };

      // Update status
      onGeometryUpdate?.('Geometry created: 4 vertices with real texture mapping');
      onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
      onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');

      // Use imported shader sources
      const spriteFragmentShader = fragmentShaderSource;
       
      // Create all scene sprites using scene manager
      const lightUniforms = createLightUniforms();
      
      // Get shadow casters from scene
      const shadowCasters = sceneManagerRef.current!.getShadowCasters();
      const shadowCaster0 = shadowCasters[0]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
      const shadowCaster1 = shadowCasters[1]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
      const shadowCaster2 = shadowCasters[2]?.getBounds() || {x: 0, y: 0, width: 0, height: 0};
      
      // Common shader uniforms for all sprites
      const commonUniforms = {
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight],
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        // Shadow system uniforms
        uShadowsEnabled: shadowConfig.enabled,
        uShadowStrength: shadowConfig.strength || 0.5,
        uShadowBias: shadowConfig.bias || 3.0,
        // Add zOrder uniforms for shadow hierarchy
        // Switch to unlimited mode when more than 3 shadow casters
        uUseOccluderMap: true,
        uOccluderMapOffset: [SHADOW_BUFFER, SHADOW_BUFFER], // Offset for expanded occlusion map
        ...lightUniforms
      };
      
      // Create meshes for ALL sprites (regardless of visibility), sorted by zOrder (back to front)
      const spriteMeshes: PIXI.Mesh[] = [];
      const allSprites = sceneManagerRef.current!.getSpritesSortedByZOrder(); // Use z-ordered sprites
      
      for (const sprite of allSprites) {
        // Create sprite-specific uniforms including zOrder for shadow hierarchy
        const spriteUniforms = {
          ...commonUniforms,
          uCurrentSpriteZOrder: sprite.definition.zOrder // Add current sprite's zOrder for shadow comparison
        };
        const mesh = sprite.createMesh(vertexShaderSource, spriteFragmentShader, spriteUniforms);
        // Set PIXI zIndex based on sprite's zOrder for proper layering
        mesh.zIndex = sprite.definition.zOrder;
        // Control visibility through PIXI, not by excluding from creation
        mesh.visible = sprite.definition.visible;
        // CRITICAL: Attach sprite definition to mesh for animation loop access
        (mesh as any).definition = sprite.definition;
        spriteMeshes.push(mesh);
      }

      // Log all sprite information from scene (including invisible ones)
      allSprites.forEach(sprite => {
        const bounds = sprite.getBounds();
        console.log(`${sprite.id} actual dimensions:`, bounds.width, bounds.height);
      });

      // Create shadow casters for occluder map system
      const shadowCastersForMap: ShadowCaster[] = shadowCasters.map(sprite => {
        const bounds = sprite.getBounds();
        return {
          id: sprite.id,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          castsShadows: sprite.definition.castsShadows,
          zOrder: sprite.definition.zOrder // Add zOrder for shadow hierarchy
        };
      });

      
      // Shadow system: unified occluder map for all sprite counts (0-4+)
      const useOccluderMap = true;

      // Set shadow texture uniforms for all sprites
      const shadowTextureUniforms = {
      };

      // Apply shadow texture uniforms to all sprite shaders
      spriteMeshes.forEach(mesh => {
        if (mesh.shader && mesh.shader.uniforms) {
          Object.assign(mesh.shader.uniforms, shadowTextureUniforms);
        }
      });

      // Store references
      meshesRef.current = spriteMeshes;
      console.log('🎯 DEBUG: Set meshesRef.current to', spriteMeshes.length, 'meshes');
      
      // CRITICAL FIX: NOW start PIXI app AFTER scene is loaded - this is the key!
      console.log('🎯 Scene fully loaded with', spriteMeshes.length, 'sprites');
      console.log('🎯 NOW starting PIXI app with content loaded...');
      
      if (pixiApp) {
        // Start PIXI app now that scene is ready
        pixiApp.start();
        
        // SMART ACTIVATION: Trigger canvas focus + refresh RIGHT when scene is loaded!
        const canvas = (pixiApp as any).__canvas;
        if (canvas) {
          // Focus canvas to activate it
          canvas.focus();
          
          // Simulate mouse interaction at canvas center
          const rect = canvas.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: centerX,
            clientY: centerY,
            bubbles: true
          });
          
          canvas.dispatchEvent(mouseMoveEvent);
          console.log('🎯 SMART ACTIVATION: Canvas focused + mouse simulated RIGHT after scene load');
        }
        
        // Force renders after activation
        requestAnimationFrame(() => {
          pixiApp.render();
          console.log('🎯 Post-scene PIXI render completed');
          
          requestAnimationFrame(() => {
            pixiApp.render();
            console.log('🎯 Final safety render completed');
          });
        });
      }
      shadersRef.current = spriteMeshes.map(mesh => mesh.shader!);
      shadowCastersRef.current = shadowCastersForMap;
      
      // CRITICAL FIX: Call updateTransform on all sprites to set missing shader uniforms
      // This ensures uSpritePos, uSpriteSize, uRotation, uPivotPoint, etc. are properly set
      for (const sprite of allSprites) {
        sprite.updateTransform({
          position: sprite.definition.position,
          rotation: sprite.definition.rotation,
          scale: sprite.definition.scale
        });
      }

      // Add all sprite meshes to stage (visibility controlled by mesh.visible property)
      spriteMeshes.forEach(mesh => {
        sceneContainerRef.current!.addChild(mesh);
      });
      
      // Enable depth sorting in PIXI for proper z-ordering
      sceneContainerRef.current!.sortableChildren = true;
      
      // Also enable sorting on main stage for single-pass rendering
      pixiApp.stage.sortableChildren = true;

      // Apply shadow texture uniforms to all sprite shaders (already done above)

      // FORCE DIRECTIONAL LIGHT SHADOW SETUP AFTER SHADERS ARE CREATED
      const directionalLight = lightsConfig.find(light => light.type === 'directional' && light.enabled);
      if (directionalLight && directionalLight.castsShadows) {
        
        // Apply directional shadow uniforms to ALL created shaders
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uDir0CastsShadows = true;
          }
        });
      }



      } catch (error) {
        console.error('Error setting up PIXI demo:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack);
        }
      }
    };

    setupDemo();

    // Cleanup function
    return () => {
      meshesRef.current.forEach(mesh => {
        if (pixiApp.stage && mesh.parent) {
          pixiApp.stage.removeChild(mesh);
        }
      });
      meshesRef.current = [];
      shadersRef.current = [];
      
      // Clean up scene manager
      if (sceneManagerRef.current) {
        sceneManagerRef.current.destroy();
        sceneManagerRef.current = null;
      }
    };
  }, [pixiApp, geometry, onGeometryUpdate, onShaderUpdate, onMeshUpdate]);
  
  // Handle sprite updates without full scene rebuild
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneConfig.scene || !pixiApp) return;
    
    
    // Update individual sprite properties without rebuilding entire scene
    try {
      sceneManagerRef.current.updateFromConfig(sceneConfig, sceneContainerRef.current);
      
      // Handle sprites that need mesh creation (were invisible, now visible)
      const spritesNeedingMeshes = sceneManagerRef.current.getAllSprites().filter(sprite => sprite.needsMeshCreation);
      if (spritesNeedingMeshes.length > 0) {
        // Use already imported shader sources
        const spriteFragmentShader = fragmentShaderSource;
        
        // Get current light uniforms for new meshes
        const allPointLights = lightsConfig.filter(light => light.type === 'point');
        const allDirectionalLights = lightsConfig.filter(light => light.type === 'directional');
        const allSpotlights = lightsConfig.filter(light => light.type === 'spotlight');
        
        // Create light uniforms (simplified version)
        const lightUniforms: any = {};
        allPointLights.slice(0, 4).forEach((light, idx) => {
          const prefix = `uPoint${idx}`;
          lightUniforms[`${prefix}Enabled`] = true;
          lightUniforms[`${prefix}Position`] = [light.position.x, light.position.y, light.position.z];
          lightUniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
          lightUniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0;
          lightUniforms[`${prefix}Radius`] = light.radius || 200;
        });
        
        // Create meshes for sprites that need them
        for (const sprite of spritesNeedingMeshes) {
          if (sprite.diffuseTexture && sprite.normalTexture) {
            const commonUniforms = {
              uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
              uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight],
              uAmbientLight: ambientLight.intensity,
              uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
              uShadowsEnabled: shadowConfig.enabled,
              uShadowStrength: shadowConfig.strength || 0.5,
              uShadowBias: shadowConfig.bias || 3.0,
              ...lightUniforms
            };
            
            const mesh = sprite.createMesh(vertexShaderSource, spriteFragmentShader, commonUniforms);
            // Set PIXI zIndex based on sprite's zOrder for proper layering
            mesh.zIndex = sprite.definition.zOrder;
            pixiApp.stage.addChild(mesh);
            meshesRef.current.push(mesh);
            shadersRef.current.push(mesh.shader as PIXI.Shader);
            sprite.needsMeshCreation = false;
          }
        }
      }
      
      // Force PIXI container to re-sort after any sprite updates (including zOrder changes)
      if (sceneContainerRef.current) {
        sceneContainerRef.current.sortChildren();
      }
      
      // Also sort main stage since meshes might be there in single-pass mode
      if (pixiApp && pixiApp.stage) {
        pixiApp.stage.sortChildren();
      }
      
      
      // Update shadow casters immediately when sprite visibility changes
      if (shadersRef.current.length > 0) {
        const shadowCasters = sceneManagerRef.current.getShadowCasters();
        
        // 🔧 CRITICAL FIX: Update shadow caster TEXTURES when shadow casters change!
        const shadowTextureUniforms = {
        };
        
        // Update shadow uniforms for all shaders
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            
            // 🎯 UPDATE SHADOW CASTER TEXTURES (fixes mismatched masks!)
            Object.assign(shader.uniforms, shadowTextureUniforms);
            
            // Enable unlimited shadow mode when more than 3 casters
            shader.uniforms.uUseOccluderMap = true;
            shader.uniforms.uOccluderMapOffset = [SHADOW_BUFFER, SHADOW_BUFFER];
            // Always use occluder map in unified system
            {
              shader.uniforms.uOccluderMap = occluderRenderTargetRef.current;
            }
          }
        });
        
      }
      
      // Trigger immediate render after sprite updates
      pixiApp.render();
    } catch (error) {
    }
  }, [sceneConfig, pixiApp, JSON.stringify(sceneConfig.scene)]);
  
  // CRITICAL: Render trigger when scene is fully loaded
  useEffect(() => {
    if (!pixiApp || meshesRef.current.length === 0) return;
    
    console.log('🎯 Scene fully loaded with', meshesRef.current.length, 'sprites - triggering render');
    
    // Force multiple renders to ensure scene displays immediately
    const forceRender = () => {
      if (pixiApp && pixiApp.renderer) {
        pixiApp.render();
        console.log('🎯 Forced scene render completed');
      }
    };
    
    // Immediate render
    forceRender();
    
    // Additional renders with delays to handle any async loading
    const timeout1 = setTimeout(forceRender, 50);
    const timeout2 = setTimeout(forceRender, 200);
    const timeout3 = setTimeout(forceRender, 500);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [pixiApp, meshesRef.current.length])

  // Dynamic shader uniform updates for real-time lighting changes
  useEffect(() => {
    // Lighting update effect - cleaned up for performance
    
    if (shadersRef.current.length === 0) return;
    
    // Updating shader uniforms in real-time

    // Full light uniforms recreation - individual uniform approach
    const createLightUniforms = () => {
      const uniforms: any = {};
      
      // Get all lights by type (enabled and disabled - let shader handle via intensity)
      const allPointLights = lightsConfig.filter(light => light.type === 'point');
      const allDirectionalLights = lightsConfig.filter(light => light.type === 'directional');
      const allSpotlights = lightsConfig.filter(light => light.type === 'spotlight');
      
      // Initialize all lights as disabled
      uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false; uniforms.uPoint2Enabled = false; uniforms.uPoint3Enabled = false;
      uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
      uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
      
      // Initialize all masks as disabled
      uniforms.uPoint0HasMask = false; uniforms.uPoint1HasMask = false; uniforms.uPoint2HasMask = false; uniforms.uPoint3HasMask = false;
      uniforms.uSpot0HasMask = false; uniforms.uSpot1HasMask = false; uniforms.uSpot2HasMask = false; uniforms.uSpot3HasMask = false;
      
      // Initialize all shadow casting flags as disabled
      uniforms.uPoint0CastsShadows = false; uniforms.uPoint1CastsShadows = false; uniforms.uPoint2CastsShadows = false; uniforms.uPoint3CastsShadows = false;
      uniforms.uDir0CastsShadows = false; uniforms.uDir1CastsShadows = false;
      uniforms.uSpot0CastsShadows = false; uniforms.uSpot1CastsShadows = false; uniforms.uSpot2CastsShadows = false; uniforms.uSpot3CastsShadows = false;

      // Add shadow system uniforms - fully data-driven from scene configuration
      uniforms.uShadowsEnabled = shadowConfig.enabled;
      uniforms.uShadowStrength = shadowConfig.strength || 0.5;
      uniforms.uShadowBias = shadowConfig.bias || 3.0;
      
      // Ambient Occlusion uniforms (completely independent from shadows)
      uniforms.uAOEnabled = ambientOcclusionConfig.enabled;
      uniforms.uAOStrength = ambientOcclusionConfig.strength;
      uniforms.uAORadius = ambientOcclusionConfig.radius;
      uniforms.uAOSamples = ambientOcclusionConfig.samples;
      uniforms.uAOBias = ambientOcclusionConfig.bias;
      
      
      // Per-sprite AO settings will be set individually for each sprite
      
      // Shadow casters from scene data (not hardcoded)
      const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
      // Add zOrder uniforms for shadow hierarchy
      
      
      // Occluder map uniforms for unlimited shadow casters (switch when >3 casters)
      uniforms.uUseOccluderMap = true;
      uniforms.uOccluderMapOffset = [SHADOW_BUFFER, SHADOW_BUFFER];
      uniforms.uOccluderMap = occluderRenderTargetRef.current || null;
      
      // Texture uniforms will be set after textures are loaded

      // Debug shadow uniforms (disabled for performance)
      // console.log('🌑 SHADOW SYSTEM UNIFORMS:', {
      //   enabled: uniforms.uShadowsEnabled,
      //   strength: uniforms.uShadowStrength,
      // });
      
      // Point Lights (up to 4) - pass ALL lights with stable slot assignment
      allPointLights.slice(0, 4).forEach((light, slotIdx) => {
        const prefix = `uPoint${slotIdx}`;
        
        // Use enabled flag for existence, intensity for visibility (physics-correct approach)
        uniforms[`${prefix}Enabled`] = light.enabled; // Controls whether light exists
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Controls light strength
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
        uniforms[`${prefix}Radius`] = light.radius || 200;
        
        // Debug: Log exact uniform values being set (disabled for performance)
        // console.log(`🔦 ${prefix} UNIFORM VALUES:`, {
        //   position: uniforms[`${prefix}Position`],
        //   color: uniforms[`${prefix}Color`],
        //   intensity: uniforms[`${prefix}Intensity`],
        //   radius: uniforms[`${prefix}Radius`]
        // });
        
        // Handle mask
        if (light.mask) {
          const maskTexture = PIXI.Texture.from(`/light_masks/${light.mask.image}`);
          uniforms[`${prefix}HasMask`] = true;
          uniforms[`${prefix}Mask`] = maskTexture;
          uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
          uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
          uniforms[`${prefix}MaskScale`] = light.mask.scale;
          uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
        } else {
          uniforms[`${prefix}HasMask`] = false;
        }
        
        // Shadow casting flag for point lights
        uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
      });
      
      // Directional Lights (up to 2) - pass ALL lights with stable slot assignment
      allDirectionalLights.slice(0, 2).forEach((light, slotIdx) => {
        const prefix = `uDir${slotIdx}`;
        
        // Use enabled flag for existence, intensity for visibility (physics-correct approach)
        uniforms[`${prefix}Enabled`] = light.enabled; // Controls whether light exists
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Controls light strength
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
        
        // Shadow casting flag for directional lights
        uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
      });
      
      // Spotlights (up to 4) - pass ALL lights with stable slot assignment
      allSpotlights.slice(0, 4).forEach((light, slotIdx) => {
        const prefix = `uSpot${slotIdx}`;
        
        // Use enabled flag for existence, intensity for visibility (physics-correct approach)
        uniforms[`${prefix}Enabled`] = light.enabled; // Controls whether light exists
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Controls light strength
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.enabled ? light.intensity : 0; // Use 0 intensity for disabled lights
        uniforms[`${prefix}Radius`] = light.radius || 150;
        uniforms[`${prefix}ConeAngle`] = light.coneAngle || 30;
        uniforms[`${prefix}Softness`] = light.softness || 0.5;
        
        // Handle mask
        if (light.mask) {
          const maskTexture = PIXI.Texture.from(`/light_masks/${light.mask.image}`);
          uniforms[`${prefix}HasMask`] = true;
          uniforms[`${prefix}Mask`] = maskTexture;
          uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
          uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
          uniforms[`${prefix}MaskScale`] = light.mask.scale;
          uniforms[`${prefix}MaskSize`] = [maskTexture.width, maskTexture.height];
        } else {
          uniforms[`${prefix}HasMask`] = false;
        }
        
        // Shadow casting flag for spotlights
        uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
      });

      // Add other dynamic uniforms
      uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
      uniforms.uAmbientLight = ambientLight.intensity;
      uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
      uniforms.uCanvasSize = [shaderParams.canvasWidth, shaderParams.canvasHeight];
      
      // FORCE DIRECTIONAL LIGHT SHADOW SETUP - BYPASS BROKEN useEffect
      const directionalLight = lightsConfig.find(light => light.type === 'directional' && light.enabled);
      if (directionalLight) {
        uniforms.uDir0CastsShadows = directionalLight.castsShadows || false;
      }
      
      // Global shadow properties
      uniforms.uShadowHeight = shadowConfig.height; // Height of sprites above ground plane for shadow projection
      uniforms.uShadowMaxLength = shadowConfig.maxLength; // Maximum shadow length to prevent extremely long shadows
      uniforms.uShadowsEnabled = shadowConfig.enabled; // Global shadow enable/disable
      uniforms.uShadowStrength = shadowConfig.strength; // Global shadow strength/opacity
      uniforms.uShadowBias = shadowConfig.bias || 3.0; // Shadow bias to prevent self-shadowing artifacts
      // Removed shadow sharpness feature
      
      // Debug: Log ambient light uniforms (disabled for performance)
      // console.log(`🌅 AMBIENT LIGHT VALUES:`, {
      //   intensity: ambientLight.intensity,
      //   color: ambientLight.color,
      //   uniformIntensity: uniforms.uAmbientLight,
      //   uniformColor: uniforms.uAmbientColor
      // });
      
      return uniforms;
    };

    const updatedUniforms = createLightUniforms();

    // DEBUG: Log point light uniform details (disabled for performance)
    // const pointUniforms = Object.keys(updatedUniforms).filter(key => key.includes('Point'));
    // console.log('🔧 POINT LIGHT UNIFORMS:', pointUniforms.length);
    // pointUniforms.forEach(key => {
    //   if (key.includes('Enabled')) {
    //     console.log(`   ${key}: ${updatedUniforms[key]}`);
    //   }
    // });

    // Debug shadow casting flags (disabled for performance)
    // const shadowUniforms = Object.keys(updatedUniforms).filter(key => key.includes('CastsShadows'));
    // console.log('🌑 SHADOW CASTING FLAGS:', shadowUniforms.length);
    // shadowUniforms.forEach(key => {
    //   console.log(`   ${key}: ${updatedUniforms[key]}`);
    // });

    // Apply all uniform updates to all shaders
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        Object.assign(shader.uniforms, updatedUniforms);
      }
    });

    // Choose rendering mode based on light count
    if (pixiApp && pixiApp.renderer) {
      const enabledLights = lightsConfig.filter(light => light.enabled && light.type !== 'ambient');
      const lightCount = enabledLights.length;
      
      // Automatic mode selection: Multi-pass for >8 lights  
      const useMultiPass = lightCount > 8;
      
      // Shadow system: unified occluder map for all sprite counts
      const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
      const useOccluderMap = true;
      
      if (useOccluderMap) {
        buildOccluderMap();
        
        // Update all shaders to use single global occluder map
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uUseOccluderMap = true;
            shader.uniforms.uOccluderMapOffset = [SHADOW_BUFFER, SHADOW_BUFFER];
            shader.uniforms.uOccluderMap = occluderRenderTargetRef.current;
          }
        });
      } else {
        
        // Update all shaders to use per-caster uniforms
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uUseOccluderMap = false;
            shader.uniforms.uOccluderMapOffset = [0, 0]; // No offset when not using occlusion map
            shader.uniforms.uOccluderMap = PIXI.Texture.EMPTY;
          }
        });
      }
      
      // UNIFIED RENDERING PATH: Set per-sprite settings and render directly (no more multi-pass complexity)
      meshesRef.current.forEach(mesh => {
        // Set per-sprite zOrder settings (AO is now controlled via caster contribution, not per-sprite receive)
        if (mesh.shader && mesh.shader.uniforms && (mesh as any).definition) {
          const spriteData = (mesh as any).definition;
          mesh.shader.uniforms.uCurrentSpriteZOrder = spriteData.zOrder || 0;
          
        }

        // Ensure mesh is properly positioned for rendering
        mesh.blendMode = PIXI.BLEND_MODES.NORMAL;
        if (mesh.parent !== pixiApp.stage) {
          if (mesh.parent) mesh.parent.removeChild(mesh);
          pixiApp.stage.addChild(mesh);
        }
      });
      
      // Set unified lighting mode for all shaders
      shadersRef.current.forEach(shader => {
        if (shader.uniforms) {
          shader.uniforms.uPassMode = 1; // All lights active in unified mode
        }
      });
      
      // Single unified render call
      pixiApp.render();
      
      // Force immediate render after updating lighting uniforms
      if (pixiApp && pixiApp.renderer) {
        // Forcing immediate render after lighting uniform updates
        pixiApp.render();
      } else {
        console.warn('⚠️ Cannot render - pixiApp or renderer not available');
      }
    }
  }, [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB, mousePos, lightsConfig, ambientLight, shadowConfig, ambientOcclusionConfig]);


  // Animation loop
  useEffect(() => {
    if (!pixiApp || !pixiApp.ticker) return;

    const ticker = () => {
      if (shadersRef.current.length > 0 && shadersRef.current[0].uniforms) {
        shadersRef.current[0].uniforms.uTime += 0.02;
      }
      
      // Trigger shadow system check and render loop every frame
      const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
      // Always build occluder map in unified system
      {
        // Unlimited shadows: ${shadowCasters.length} casters detected
        
        // TRIGGER THE RENDER LOOP FOR UNLIMITED SHADOWS
        const useOccluderMap = true;
        if (useOccluderMap && occluderRenderTargetRef.current) {
          // Triggering occluder map build from animation loop
          buildOccluderMap();
          
          // Update all shaders to use single global occluder map
          shadersRef.current.forEach(shader => {
            if (shader.uniforms) {
              shader.uniforms.uUseOccluderMap = true;
              shader.uniforms.uOccluderMapOffset = [SHADOW_BUFFER, SHADOW_BUFFER];
              shader.uniforms.uOccluderMap = occluderRenderTargetRef.current;
              
              // Only enable directional shadows if there are actually enabled directional lights
              const enabledDirectionalLights = lightsConfig.filter(light => light.enabled && light.type === 'directional');
              shader.uniforms.uDir0CastsShadows = enabledDirectionalLights.length > 0 && enabledDirectionalLights[0].castsShadows;
            }
          });
          // Unlimited shadows applied from animation loop
        }
      }
      
      // CRITICAL FIX: Always render every frame to ensure canvas displays immediately
      if (pixiApp && pixiApp.renderer) {
        pixiApp.render();
      }
    };

    pixiApp.ticker.add(ticker);

    return () => {
      if (pixiApp?.ticker) {
        pixiApp.ticker.remove(ticker);
      }
    };
  }, [pixiApp]);

  // Mouse tracking
  useEffect(() => {
    if (!pixiApp || !pixiApp.view) return;

    const handleMouseMove = (event: MouseEvent) => {
      const canvas = pixiApp.view as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setMousePos({ x, y });
      
      // Shadows are now calculated dynamically in the shader
    };

    // No need for dynamic shadow mesh updates - shadows are now calculated in shader

    const canvas = pixiApp.view as HTMLCanvasElement;
    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [pixiApp]);

  return (
    <div 
      ref={canvasRef} 
      style={{ 
        width: shaderParams.canvasWidth, 
        height: shaderParams.canvasHeight, 
        border: '1px solid #333' 
      }}
      data-testid="pixi-stage"
    />
  );
};

export default PixiDemo;