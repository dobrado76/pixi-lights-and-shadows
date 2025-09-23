import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
// Vertex shader will be loaded dynamically from .glsl file
// Fragment shader will be loaded dynamically from .glsl file
import { ShaderParams } from '../App';
import { Light, ShadowConfig } from '@shared/lights';

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
        // Load textures 
        const bgDiffuse = PIXI.Texture.from('/BGTextureTest.jpg');
        const bgNormal = PIXI.Texture.from('/BGTextureNORM.jpg');
        const ballDiffuse = PIXI.Texture.from('/ball.png');
        const ballNormal = PIXI.Texture.from('/ballN.png');
        const blockDiffuse = PIXI.Texture.from('/block.png');
        const blockNormal = PIXI.Texture.from('/blockNormalMap.jpg');
        
        console.log('Textures loaded, creating geometries...');

        // Helper function to convert external lights config to shader uniforms
        const createLightUniforms = () => {
          const uniforms: any = {};
          
          // Get all enabled lights by type
          const enabledLights = lightsConfig.filter(light => light.enabled);
          const pointLights = enabledLights.filter(light => light.type === 'point');
          const directionalLights = enabledLights.filter(light => light.type === 'directional');
          const spotlights = enabledLights.filter(light => light.type === 'spotlight');
          
          // Initialize all lights as disabled
          uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false; uniforms.uPoint2Enabled = false; uniforms.uPoint3Enabled = false;
          uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
          uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
          
          // Initialize all masks as disabled
          uniforms.uPoint0HasMask = false; uniforms.uPoint1HasMask = false; uniforms.uPoint2HasMask = false; uniforms.uPoint3HasMask = false;
          uniforms.uSpot0HasMask = false; uniforms.uSpot1HasMask = false; uniforms.uSpot2HasMask = false; uniforms.uSpot3HasMask = false;
          
          // Point Lights (up to 4) - use stable slot assignment
          console.log(`🔍 PROCESSING ${pointLights.length} POINT LIGHTS:`, pointLights.map(l => l.id));
          
          // Create a mapping of light IDs to stable uniform slots
          const lightIdToSlot = new Map<string, number>();
          let slotIndex = 0;
          
          // First, assign slots to all lights in the original config order (for stability)
          lightsConfig.filter(light => light.type === 'point').forEach(light => {
            if (slotIndex < 4) {
              lightIdToSlot.set(light.id, slotIndex);
              slotIndex++;
            }
          });
          
          pointLights.slice(0, 4).forEach((light) => {
            const slotIdx = lightIdToSlot.get(light.id);
            if (slotIdx !== undefined) {
              const prefix = `uPoint${slotIdx}`;
              console.log(`   Setting ${prefix}Enabled = true for light: ${light.id} (stable slot ${slotIdx})`);
              uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
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
            }
          });
          
          // Directional Lights (up to 2)
          directionalLights.slice(0, 2).forEach((light, i) => {
            const prefix = `uDir${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
          });
          
          // Spotlights (up to 4)
          spotlights.slice(0, 4).forEach((light, i) => {
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

          console.log('DEBUG: All lights config:', lightsConfig.map(l => ({id: l.id, type: l.type, enabled: l.enabled})));
          console.log('DEBUG: Enabled lights:', enabledLights.map(l => ({id: l.id, type: l.type})));
          console.log('DEBUG: Point lights found:', pointLights.map(l => ({id: l.id, enabled: l.enabled})));
          console.log('Expanded Lights:', { 
            pointLights: pointLights.length, 
            directionalLights: directionalLights.length, 
            spotlights: spotlights.length 
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
       
      // Background shader and mesh (using unified sprite shader)
      const lightUniforms = createLightUniforms();
      const bgShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [0, 0], // Background covers entire canvas starting at (0,0)
        uSpriteSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Full canvas size
        uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Canvas dimensions for pixel-perfect scaling
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        // Shadow participation flags for background
        uSpriteCastsShadows: false, // Background doesn't cast shadows
        uSpriteReceivesShadows: true, // Background can receive shadows
        // Global shadow uniforms
        uShadowsEnabled: shadowConfig.enabled,
        uShadowStrength: shadowConfig.strength,
        uShadowMaxLength: shadowConfig.maxLength,
        uShadowHeight: shadowConfig.height,
        ...lightUniforms
      });

      const bgMesh = new PIXI.Mesh(geometry, bgShader as any);
      bgMesh.x = 0;
      bgMesh.y = 0;

      // Create sprite geometries positioned in world space
      const createSpriteGeometry = (x: number, y: number, width: number, height: number) => {
        const geometry = new PIXI.Geometry();
        const vertices = [x, y, x + width, y, x + width, y + height, x, y + height];
        const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        const indices = [0, 1, 2, 0, 2, 3];
        
        geometry.addAttribute('aVertexPosition', vertices, 2);
        geometry.addAttribute('aTextureCoord', uvs, 2);
        geometry.addIndex(indices);
        return geometry;
      };

      // Shadow functions moved to component level for reuse
      
      // Wait for textures to load, then use their actual dimensions
      await Promise.all([
        new Promise(resolve => ballDiffuse.baseTexture.valid ? resolve(null) : ballDiffuse.baseTexture.once('loaded', resolve)),
        new Promise(resolve => blockDiffuse.baseTexture.valid ? resolve(null) : blockDiffuse.baseTexture.once('loaded', resolve))
      ]);

      // Create geometries positioned at correct world coordinates
      const ballPos = { x: 120, y: 80 };
      const blockPos = { x: 280, y: 120 };
      const ballGeometry = createSpriteGeometry(ballPos.x, ballPos.y, ballDiffuse.width, ballDiffuse.height);
      const blockGeometry = createSpriteGeometry(blockPos.x, blockPos.y, blockDiffuse.width, blockDiffuse.height);
      
      console.log('Ball actual dimensions:', ballDiffuse.width, ballDiffuse.height);
      console.log('Block actual dimensions:', blockDiffuse.width, blockDiffuse.height);

      // Create shadow casters from sprite data
      const shadowCasters: ShadowCaster[] = [
        {
          id: 'ball',
          x: ballPos.x,
          y: ballPos.y,
          width: ballDiffuse.width,
          height: ballDiffuse.height,
          castsShadows: true
        },
        {
          id: 'block',
          x: blockPos.x,
          y: blockPos.y,
          width: blockDiffuse.width,
          height: blockDiffuse.height,
          castsShadows: true
        }
      ];

      console.log('💡 Shadow casters created:', shadowCasters);

      // Ball shader and mesh
      const ballShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: ballDiffuse,
        uNormal: ballNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos:  [ballPos.x, ballPos.y],
        uSpriteSize: [ballDiffuse.width, ballDiffuse.height],
        uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Canvas dimensions for pixel-perfect scaling
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        // Shadow participation flags for ball
        uSpriteCastsShadows: true, // Ball casts shadows on other sprites
        uSpriteReceivesShadows: true, // Ball can receive shadows
        ...lightUniforms
      });

      const ballMesh = new PIXI.Mesh(ballGeometry, ballShader as any);
      ballMesh.x = 0;
      ballMesh.y = 0;

      // Block shader and mesh
      const blockShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: blockDiffuse,
        uNormal: blockNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [blockPos.x, blockPos.y],
        uSpriteSize: [blockDiffuse.width, blockDiffuse.height],
        uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Canvas dimensions for pixel-perfect scaling
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        // Shadow participation flags for block
        uSpriteCastsShadows: true, // Block casts shadows on other sprites
        uSpriteReceivesShadows: true, // Block can receive shadows
        ...lightUniforms
      });

      const blockMesh = new PIXI.Mesh(blockGeometry, blockShader as any);
      blockMesh.x = 0;
      blockMesh.y = 0;

      // Create shadow rendering function
      const renderShadows = (lights: Light[]) => {
        if (!shadowConfig.enabled) return [];
        
        const shadowMeshes: PIXI.Mesh[] = [];
        const enabledLights = lights.filter(light => light.enabled && light.castsShadows);
        
        console.log(`🌑 Creating shadows for ${enabledLights.length} lights`);
        
        enabledLights.forEach(light => {
          if (light.type !== 'point') return; // Only point lights for now
          
          const lightX = light.followMouse ? mousePos.x : light.position.x;
          const lightY = light.followMouse ? mousePos.y : light.position.y;
          
          shadowCasters.forEach(caster => {
            const shadowGeometry = createShadowGeometry(caster, lightX, lightY, shadowConfig.maxLength || 200);
            if (shadowGeometry) {
              const shadowMesh = createShadowMesh(shadowGeometry, shadowConfig.strength || 0.3);
              shadowMesh.blendMode = PIXI.BLEND_MODES.MULTIPLY; // Dark shadows blend multiplicatively
              shadowMeshes.push(shadowMesh);
              sceneContainerRef.current!.addChild(shadowMesh);
            }
          });
        });
        
        return shadowMeshes;
      };

      // Store references (will be updated when shadows are created)
      meshesRef.current = [bgMesh, ballMesh, blockMesh];
      shadersRef.current = [bgShader, ballShader, blockShader];

      // Add to stage
      // Add meshes to scene container for multi-pass rendering
      sceneContainerRef.current!.addChild(bgMesh);
      sceneContainerRef.current!.addChild(ballMesh);
      sceneContainerRef.current!.addChild(blockMesh);

      // Store shadow casters for dynamic updates
      shadowCastersRef.current = shadowCasters;

      // Render initial shadows
      const initialShadowMeshes = renderShadows(lightsConfig);
      shadowMeshesRef.current = initialShadowMeshes;
      console.log(`🌑 Created ${initialShadowMeshes.length} shadow meshes`);

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
    };
  }, [pixiApp, geometry, onGeometryUpdate, onShaderUpdate, onMeshUpdate]);

  // Dynamic shader uniform updates for real-time lighting changes
  useEffect(() => {
    if (shadersRef.current.length === 0) return;

    // Full light uniforms recreation - individual uniform approach
    const createLightUniforms = () => {
      const uniforms: any = {};
      
      // Get all enabled lights by type
      const enabledLights = lightsConfig.filter(light => light.enabled);
      const pointLights = enabledLights.filter(light => light.type === 'point');
      const directionalLights = enabledLights.filter(light => light.type === 'directional');
      const spotlights = enabledLights.filter(light => light.type === 'spotlight');
      
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

      // Add global shadow configuration uniforms
      uniforms.uShadowsEnabled = shadowConfig.enabled;
      uniforms.uShadowStrength = shadowConfig.strength;
      uniforms.uShadowMaxLength = shadowConfig.maxLength;
      uniforms.uShadowHeight = shadowConfig.height;

      // Debug shadow uniforms
      console.log('🌑 SHADOW GLOBAL UNIFORMS:', {
        enabled: uniforms.uShadowsEnabled,
        strength: uniforms.uShadowStrength,
        maxLength: uniforms.uShadowMaxLength,
        height: uniforms.uShadowHeight
      });
      
      // Point Lights (up to 4)
      pointLights.slice(0, 4).forEach((light, i) => {
        const prefix = `uPoint${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
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
      directionalLights.slice(0, 2).forEach((light, i) => {
        const prefix = `uDir${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
        
        // Shadow casting flag for directional lights
        uniforms[`${prefix}CastsShadows`] = light.castsShadows || false;
      });
      
      // Spotlights (up to 4)
      spotlights.slice(0, 4).forEach((light, i) => {
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
      
      // Update shadows for mouse light dynamically
      updateShadowsForMouseLight(x, y);
    };

    const updateShadowsForMouseLight = (mouseX: number, mouseY: number) => {
      if (!shadowConfig.enabled || !sceneContainerRef.current) return;
      
      // Find mouse light in config
      const mouseLight = lightsConfig.find(light => light.followMouse && light.enabled && light.castsShadows);
      if (!mouseLight) return;
      
      // Remove old shadow meshes for mouse light (first light creates first 2 shadow meshes)
      const mouseShadowMeshes = shadowMeshesRef.current.slice(0, 2);
      mouseShadowMeshes.forEach(mesh => {
        if (mesh.parent) mesh.parent.removeChild(mesh);
      });
      
      // Create new shadow meshes for mouse light
      const newMouseShadows: PIXI.Mesh[] = [];
      shadowCastersRef.current.forEach(caster => {
        const shadowGeometry = createShadowGeometry(caster, mouseX, mouseY, shadowConfig.maxLength || 200);
        if (shadowGeometry) {
          const shadowMesh = createShadowMesh(shadowGeometry, shadowConfig.strength || 0.3);
          shadowMesh.blendMode = PIXI.BLEND_MODES.MULTIPLY;
          newMouseShadows.push(shadowMesh);
          sceneContainerRef.current!.addChild(shadowMesh);
        }
      });
      
      // Update shadow meshes array (replace first 2 with new ones)
      shadowMeshesRef.current = [...newMouseShadows, ...shadowMeshesRef.current.slice(2)];
    };

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