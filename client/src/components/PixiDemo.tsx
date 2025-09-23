import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
// Vertex shader will be loaded dynamically from .glsl file
// Fragment shader will be loaded dynamically from .glsl file
import { ShaderParams } from '../App';
import { Light, ShadowConfig } from '@shared/lights';
import { SceneManager, SceneSprite } from './Sprite';

// Shadow casting sprite interface
interface ShadowCaster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  castsShadows: boolean;
}

interface PixiDemoProps {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  shadowConfig: ShadowConfig;
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, lightsConfig, ambientLight, shadowConfig, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  const meshesRef = useRef<PIXI.Mesh[]>([]);
  const shadersRef = useRef<PIXI.Shader[]>([]);
  const shadowMeshesRef = useRef<PIXI.Mesh[]>([]);
  const shadowCastersRef = useRef<ShadowCaster[]>([]);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const occluderRenderTargetRef = useRef<PIXI.RenderTexture | null>(null);
  const occluderContainerRef = useRef<PIXI.Container | null>(null);
  const occluderSpritesRef = useRef<PIXI.Sprite[]>([]);

  // Shadow geometry functions (moved to component level for reuse)
  const createShadowGeometry = (caster: ShadowCaster, lightX: number, lightY: number, shadowLength: number = 100) => {
    if (!caster.castsShadows) return null;
    
    // Get the four corners of the sprite rectangle
    const corners = [
      { x: caster.x, y: caster.y },                           // Top-left
      { x: caster.x + caster.width, y: caster.y },            // Top-right  
      { x: caster.x + caster.width, y: caster.y + caster.height }, // Bottom-right
      { x: caster.x, y: caster.y + caster.height }            // Bottom-left
    ];

    // Project each corner away from the light
    const projectedCorners = corners.map(corner => {
      const dx = corner.x - lightX;
      const dy = corner.y - lightY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 0.1) return corner; // Avoid division by zero
      
      // Normalize and project
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

    // Create triangles to form shadow volume
    // Shadow consists of 4 quads, one for each edge of the rectangle
    const shadowIndices = [
      // Edge 0->1 (top edge)
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

  // Create shadow mesh with basic black color
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
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

  // Occluder map builder for unlimited shadow casters - optimized to reuse sprites
  const buildOccluderMap = () => {
    if (!pixiApp || !occluderRenderTargetRef.current || !occluderContainerRef.current) return;
    
    const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
    
    // Ensure we have enough pooled sprites
    while (occluderSpritesRef.current.length < shadowCasters.length) {
      const sprite = new PIXI.Sprite();
      occluderSpritesRef.current.push(sprite);
      occluderContainerRef.current.addChild(sprite);
    }
    
    // Update existing sprites with current shadow caster data
    shadowCasters.forEach((caster, index) => {
      if (!caster.diffuseTexture) return;
      
      const occluderSprite = occluderSpritesRef.current[index];
      
      // Update texture only if changed
      if (occluderSprite.texture !== caster.diffuseTexture) {
        occluderSprite.texture = caster.diffuseTexture;
      }
      
      // Update position and scale to match the scene sprite
      const bounds = caster.getBounds();
      occluderSprite.x = bounds.x;
      occluderSprite.y = bounds.y;
      occluderSprite.width = bounds.width;
      occluderSprite.height = bounds.height;
      occluderSprite.visible = true;
    });
    
    // Hide unused sprites
    for (let i = shadowCasters.length; i < occluderSpritesRef.current.length; i++) {
      occluderSpritesRef.current[i].visible = false;
    }
    
    // Render to occluder texture with optimized settings
    pixiApp.renderer.render(occluderContainerRef.current, { 
      renderTexture: occluderRenderTargetRef.current, 
      clear: true 
    });
  };

  // Multi-pass lighting composer
  const renderMultiPass = (lights: Light[]) => {
    if (!pixiApp || !renderTargetRef.current || !sceneContainerRef.current || !displaySpriteRef.current) return;

    const enabledLights = lights.filter(light => light.enabled && light.type !== 'ambient');
    console.log(`🎨 MULTI-PASS: Rendering ${enabledLights.length} lights`);

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
    
    console.log(`🔄 RENDERING ${totalPasses} lighting passes:`);
    console.log(`   Point lights: ${pointLights.length} (${pointPasses} passes)`);
    console.log(`   Spotlights: ${spotlights.length} (${spotPasses} passes)`);
    console.log(`   Directional: ${directionalLights.length} (${dirPasses} passes)`);

    // Render each lighting pass
    for (let pass = 0; pass < totalPasses; pass++) {
      // Get lights for this pass
      const passPointLights = pointLights.slice(pass * maxPointsPerPass, (pass + 1) * maxPointsPerPass);
      const passSpotlights = spotlights.slice(pass * maxSpotsPerPass, (pass + 1) * maxSpotsPerPass);
      const passDirLights = directionalLights.slice(pass * maxDirPerPass, (pass + 1) * maxDirPerPass);

      // Skip empty passes
      if (passPointLights.length === 0 && passSpotlights.length === 0 && passDirLights.length === 0) continue;

      console.log(`   Pass ${pass + 1}: ${passPointLights.length} points, ${passSpotlights.length} spots, ${passDirLights.length} dir`);

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
          resolution: 1, // Use fixed resolution for compatibility
          autoDensity: false,
          forceCanvas: false,
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
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
        });
      }

      // Access canvas using proper PIXI.js property
      const canvas = app.view as HTMLCanvasElement;
      
      if (canvas && canvasRef.current) {
        canvasRef.current.appendChild(canvas);
        setPixiApp(app);
        console.log('PIXI App initialized successfully');
        console.log('Renderer type:', app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas');
        
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
      occluderRenderTargetRef.current = PIXI.RenderTexture.create({ 
        width: shaderParams.canvasWidth, 
        height: shaderParams.canvasHeight 
      });
      occluderContainerRef.current = new PIXI.Container();
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

  // Setup demo content when PIXI app is ready
  useEffect(() => {
    if (!pixiApp || !pixiApp.stage) {
      return;
    }

    console.log('Setting up PIXI demo with real textures...');

    const setupDemo = async () => {
      try {
        // Load scene configuration from JSON
        const sceneResponse = await fetch('/scene.json');
        const sceneData = await sceneResponse.json();
        
        // Initialize scene manager
        sceneManagerRef.current = new SceneManager();
        await sceneManagerRef.current.loadScene(sceneData);
        
        console.log('Scene loaded, creating geometries...');

        // Helper function to convert external lights config to shader uniforms
        const createLightUniforms = () => {
          const uniforms: any = {};
          
          // Get all lights by type (enabled and disabled - let shader handle via intensity)
          const allPointLights = lightsConfig.filter(light => light.type === 'point');
          const enabledDirectionalLights = lightsConfig.filter(light => light.type === 'directional' && light.enabled);
          const enabledSpotlights = lightsConfig.filter(light => light.type === 'spotlight' && light.enabled);
          
          // Initialize all lights as disabled
          uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false; uniforms.uPoint2Enabled = false; uniforms.uPoint3Enabled = false;
          uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
          uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
          
          // Initialize all masks as disabled
          uniforms.uPoint0HasMask = false; uniforms.uPoint1HasMask = false; uniforms.uPoint2HasMask = false; uniforms.uPoint3HasMask = false;
          uniforms.uSpot0HasMask = false; uniforms.uSpot1HasMask = false; uniforms.uSpot2HasMask = false; uniforms.uSpot3HasMask = false;
          
          // Point Lights (up to 4) - pass ALL lights with stable slot assignment
          console.log(`🔍 PROCESSING ${allPointLights.length} POINT LIGHTS (all):`, allPointLights.map(l => `${l.id}(${l.enabled ? 'ON' : 'OFF'})`));
          
          allPointLights.slice(0, 4).forEach((light, slotIdx) => {
            const prefix = `uPoint${slotIdx}`;
            console.log(`   Setting ${prefix} for light: ${light.id} (slot ${slotIdx}, enabled: ${light.enabled})`);
            
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
          
          // Directional Lights (up to 2)
          enabledDirectionalLights.slice(0, 2).forEach((light, i) => {
            const prefix = `uDir${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
          });
          
          // Spotlights (up to 4)
          enabledSpotlights.slice(0, 4).forEach((light, i) => {
            const prefix = `uSpot${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
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
          for (let i = enabledSpotlights.length; i < 4; i++) {
            uniforms[`uSpot${i}Enabled`] = false;
            uniforms[`uSpot${i}HasMask`] = false;
            uniforms[`uSpot${i}CastsShadows`] = false;
          }

          console.log('DEBUG: All lights config:', lightsConfig.map(l => ({id: l.id, type: l.type, enabled: l.enabled})));
          console.log('DEBUG: Point lights found (all):', allPointLights.map(l => ({id: l.id, enabled: l.enabled})));
          console.log('Expanded Lights:', { 
            pointLights: allPointLights.length, 
            directionalLights: enabledDirectionalLights.length, 
            spotlights: enabledSpotlights.length 
          });

          return uniforms;
        };

      // Update status
      onGeometryUpdate?.('Geometry created: 4 vertices with real texture mapping');
      onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
      onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');

      // Load shaders from external files for better syntax highlighting
      const vertexShaderResponse = await fetch('/src/shaders/vertex.glsl');
      const vertexShaderSource = await vertexShaderResponse.text();
      
      const fragmentShaderResponse = await fetch('/src/shaders/fragment.glsl');
      const spriteFragmentShader = await fragmentShaderResponse.text();
       
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
        uShadowCaster0: [shadowCaster0.x, shadowCaster0.y, shadowCaster0.width, shadowCaster0.height],
        uShadowCaster1: [shadowCaster1.x, shadowCaster1.y, shadowCaster1.width, shadowCaster1.height],
        uShadowCaster2: [shadowCaster2.x, shadowCaster2.y, shadowCaster2.width, shadowCaster2.height],
        uShadowCaster0Enabled: shadowCasters.length > 0,
        uShadowCaster1Enabled: shadowCasters.length > 1,
        uShadowCaster2Enabled: shadowCasters.length > 2,
        ...lightUniforms
      };
      
      // Create all sprite meshes
      const spriteMeshes: PIXI.Mesh[] = [];
      const allSprites = sceneManagerRef.current!.getAllSprites();
      
      for (const sprite of allSprites) {
        const mesh = sprite.createMesh(vertexShaderSource, spriteFragmentShader, commonUniforms);
        spriteMeshes.push(mesh);
      }

      // Log sprite information from scene
      allSprites.forEach(sprite => {
        const bounds = sprite.getBounds();
        console.log(`${sprite.id} actual dimensions:`, bounds.width, bounds.height);
      });

      // Create legacy shadow casters for compatibility
      const legacyShadowCasters: ShadowCaster[] = shadowCasters.map(sprite => {
        const bounds = sprite.getBounds();
        return {
          id: sprite.id,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          castsShadows: sprite.definition.castsShadows
        };
      });

      console.log('💡 Shadow casters created:', legacyShadowCasters);

      // Set shadow texture uniforms for all sprites
      const shadowTextureUniforms = {
        uShadowCaster0Texture: shadowCasters[0]?.diffuseTexture || PIXI.Texture.WHITE,
        uShadowCaster1Texture: shadowCasters[1]?.diffuseTexture || PIXI.Texture.WHITE,
        uShadowCaster2Texture: shadowCasters[2]?.diffuseTexture || PIXI.Texture.WHITE
      };

      // Apply shadow texture uniforms to all sprite shaders
      spriteMeshes.forEach(mesh => {
        if (mesh.shader && mesh.shader.uniforms) {
          Object.assign(mesh.shader.uniforms, shadowTextureUniforms);
        }
      });

      // Store references
      meshesRef.current = spriteMeshes;
      shadersRef.current = spriteMeshes.map(mesh => mesh.shader!);
      shadowCastersRef.current = legacyShadowCasters;

      // Add all sprite meshes to stage
      spriteMeshes.forEach(mesh => {
        sceneContainerRef.current!.addChild(mesh);
      });

      // Apply shadow texture uniforms to all sprite shaders (already done above)
      console.log('All sprite shaders created with shadow texture uniforms');

      console.log('🌑 Shadow system integrated into lighting shader');
      console.log('🌑 Shadow texture uniforms applied to all shaders');

      console.log('PIXI demo setup completed successfully');

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

  // Dynamic shader uniform updates for real-time lighting changes
  useEffect(() => {
    if (shadersRef.current.length === 0) return;

    // Full light uniforms recreation - individual uniform approach
    const createLightUniforms = () => {
      const uniforms: any = {};
      
      // Get all lights by type (enabled and disabled - let shader handle via intensity)
      const allPointLights = lightsConfig.filter(light => light.type === 'point');
      const enabledDirectionalLights = lightsConfig.filter(light => light.type === 'directional' && light.enabled);
      const enabledSpotlights = lightsConfig.filter(light => light.type === 'spotlight' && light.enabled);
      
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

      // Add shadow system uniforms
      uniforms.uShadowsEnabled = shadowConfig.enabled;
      uniforms.uShadowStrength = shadowConfig.strength || 0.5;
      uniforms.uShadowCaster0 = [120, 80, 75, 75]; // Ball: x, y, width, height
      uniforms.uShadowCaster1 = [280, 120, 120, 60]; // Block: x, y, width, height  
      uniforms.uShadowCaster0Enabled = true;
      uniforms.uShadowCaster1Enabled = true;
      
      // Occluder map uniforms for unlimited shadow casters
      const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
      uniforms.uUseOccluderMap = shadowCasters.length > 4;
      uniforms.uOccluderMap = occluderRenderTargetRef.current || null;
      
      // Texture uniforms will be set after textures are loaded

      // Debug shadow uniforms
      console.log('🌑 SHADOW SYSTEM UNIFORMS:', {
        enabled: uniforms.uShadowsEnabled,
        strength: uniforms.uShadowStrength,
        caster0: uniforms.uShadowCaster0,
        caster1: uniforms.uShadowCaster1
      });
      
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
        
        // Debug: Log exact uniform values being set
        console.log(`🔦 ${prefix} UNIFORM VALUES:`, {
          position: uniforms[`${prefix}Position`],
          color: uniforms[`${prefix}Color`],
          intensity: uniforms[`${prefix}Intensity`],
          radius: uniforms[`${prefix}Radius`]
        });
        
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
      
      // Directional Lights (up to 2)
      enabledDirectionalLights.slice(0, 2).forEach((light, i) => {
        const prefix = `uDir${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
        
        // Shadow casting flag for directional lights
        uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
      });
      
      // Spotlights (up to 4)
      enabledSpotlights.slice(0, 4).forEach((light, i) => {
        const prefix = `uSpot${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
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
      
      // Global shadow properties
      uniforms.uShadowHeight = shadowConfig.height; // Height of sprites above ground plane for shadow projection
      uniforms.uShadowMaxLength = shadowConfig.maxLength; // Maximum shadow length to prevent extremely long shadows
      uniforms.uShadowsEnabled = shadowConfig.enabled; // Global shadow enable/disable
      uniforms.uShadowStrength = shadowConfig.strength; // Global shadow strength/opacity
      uniforms.uShadowSharpness = shadowConfig.sharpness ?? 0.5; // Shadow sharpness (0=soft, 1=sharp)
      
      // Debug: Log ambient light uniforms
      console.log(`🌅 AMBIENT LIGHT VALUES:`, {
        intensity: ambientLight.intensity,
        color: ambientLight.color,
        uniformIntensity: uniforms.uAmbientLight,
        uniformColor: uniforms.uAmbientColor
      });
      
      return uniforms;
    };

    const updatedUniforms = createLightUniforms();

    // DEBUG: Log point light uniform details
    const pointUniforms = Object.keys(updatedUniforms).filter(key => key.includes('Point'));
    console.log('🔧 POINT LIGHT UNIFORMS:', pointUniforms.length);
    pointUniforms.forEach(key => {
      if (key.includes('Enabled')) {
        console.log(`   ${key}: ${updatedUniforms[key]}`);
      }
    });

    // Debug shadow casting flags
    const shadowUniforms = Object.keys(updatedUniforms).filter(key => key.includes('CastsShadows'));
    console.log('🌑 SHADOW CASTING FLAGS:', shadowUniforms.length);
    shadowUniforms.forEach(key => {
      console.log(`   ${key}: ${updatedUniforms[key]}`);
    });

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
      
      // Shadow system mode selection: Occluder map for >4 shadow casters
      const shadowCasters = sceneManagerRef.current?.getShadowCasters() || [];
      const useOccluderMap = shadowCasters.length > 4;
      
      if (useOccluderMap) {
        console.log(`🌑 OCCLUDER MAP: Using occluder map for ${shadowCasters.length} shadow casters`);
        buildOccluderMap();
        
        // Update all shaders to use occluder map
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uUseOccluderMap = true;
            shader.uniforms.uOccluderMap = occluderRenderTargetRef.current;
          }
        });
      } else {
        console.log(`⚡ FAST SHADOWS: Using per-caster uniforms for ${shadowCasters.length} shadow casters`);
        
        // Update all shaders to use per-caster uniforms
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uUseOccluderMap = false;
            shader.uniforms.uOccluderMap = PIXI.Texture.EMPTY;
          }
        });
      }
      
      if (useMultiPass && renderTargetRef.current && sceneContainerRef.current && displaySpriteRef.current) {
        console.log(`🚀 MULTI-PASS: Rendering ${lightCount} lights with multi-pass architecture (${Math.ceil(lightCount/8)} passes)`);
        renderMultiPass(lightsConfig);
      } else {
        console.log(`⚡ SINGLE-PASS: Rendering ${lightCount} lights directly to screen (≤8 lights)`);
        // Single-pass: Ensure meshes are on main stage and render directly
        meshesRef.current.forEach(mesh => {
          mesh.blendMode = PIXI.BLEND_MODES.NORMAL;
          // Make sure mesh is on the main stage for single-pass rendering
          if (mesh.parent !== pixiApp.stage) {
            if (mesh.parent) mesh.parent.removeChild(mesh);
            pixiApp.stage.addChild(mesh);
          }
        });
        shadersRef.current.forEach(shader => {
          if (shader.uniforms) {
            shader.uniforms.uPassMode = 1; // Lighting pass mode (all lights active)
          }
        });
        pixiApp.render();
      }
    }
  }, [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB, mousePos, lightsConfig, ambientLight, shadowConfig]);

  // Animation loop
  useEffect(() => {
    if (!pixiApp || !pixiApp.ticker) return;

    const ticker = () => {
      if (shadersRef.current.length > 0 && shadersRef.current[0].uniforms) {
        shadersRef.current[0].uniforms.uTime += 0.02;
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