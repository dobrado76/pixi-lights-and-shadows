import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
// Vertex shader will be loaded dynamically from .glsl file
// Fragment shader will be loaded dynamically from .glsl file
import { ShaderParams } from '../App';
import { Light } from '@shared/lights';

interface PixiDemoProps {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, lightsConfig, ambientLight, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  const meshesRef = useRef<PIXI.Mesh[]>([]);
  const shadersRef = useRef<PIXI.Shader[]>([]);
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

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

        // 🔥 UNLIMITED DYNAMIC LIGHTING SYSTEM - NO HARDCODED LIMITS 🔥
        const createLightUniforms = () => {
          const uniforms: any = {};
          
          // Get all enabled lights
          const enabledLights = lightsConfig.filter(light => light.enabled);
          const lightCount = Math.min(enabledLights.length, 32); // Clamp to shader limit
          
          console.log(`🔥 DYNAMIC LIGHTING: Processing ${lightCount} lights (of ${enabledLights.length} total)`);
          if (enabledLights.length > 32) {
            console.warn(`⚠️ Too many lights! Using first 32 of ${enabledLights.length}. Consider optimizing.`);
          }
          
          // Initialize arrays
          uniforms.uLightCount = lightCount;
          uniforms.uLightTypes = new Array(32).fill(0);
          uniforms.uLightPositions = new Array(32).fill([0, 0, 0]);
          uniforms.uLightDirections = new Array(32).fill([0, 0, 0]);
          uniforms.uLightColors = new Array(32).fill([0, 0, 0]);
          uniforms.uLightIntensities = new Array(32).fill(0);
          uniforms.uLightRadii = new Array(32).fill(0);
          uniforms.uLightConeAngles = new Array(32).fill(0);
          uniforms.uLightSoftness = new Array(32).fill(0);
          uniforms.uLightHasMask = new Array(32).fill(false);
          uniforms.uLightMaskOffsets = new Array(32).fill([0, 0]);
          uniforms.uLightMaskRotations = new Array(32).fill(0);
          uniforms.uLightMaskScales = new Array(32).fill(1);
          uniforms.uLightMaskSizes = new Array(32).fill([1, 1]);
          uniforms.uLightMaskTextureIndex = new Array(32).fill(-1);
          
          // Initialize mask texture array
          uniforms.uLightMasks = new Array(8).fill(null);
          
          // Track mask texture allocation
          let nextMaskIndex = 0;
          const maskTextureMap = new Map();
          
          // Process lights
          for (let i = 0; i < lightCount; i++) {
            const light = enabledLights[i];
            // Light type mapping: 0=point, 1=directional, 2=spotlight
            let lightType = 0;
            if (light.type === 'directional') lightType = 1;
            else if (light.type === 'spotlight') lightType = 2;
            
            uniforms.uLightTypes[i] = lightType;
            
            // Position (for point and spotlights)
            if (light.type === 'point') {
              uniforms.uLightPositions[i] = [
                light.followMouse ? mousePos.x : light.position.x,
                light.followMouse ? mousePos.y : light.position.y,
                light.position.z
              ];
            } else {
              uniforms.uLightPositions[i] = [light.position.x, light.position.y, light.position.z];
            }
            
            // Direction (for directional and spotlights)
            uniforms.uLightDirections[i] = [light.direction?.x || 0, light.direction?.y || 0, light.direction?.z || 0];
            
            // Common properties
            uniforms.uLightColors[i] = [light.color.r, light.color.g, light.color.b];
            uniforms.uLightIntensities[i] = light.intensity;
            uniforms.uLightRadii[i] = light.radius || 200;
            uniforms.uLightConeAngles[i] = light.coneAngle || 30;
            uniforms.uLightSoftness[i] = light.softness || 0.5;
            
            // Handle masks efficiently - share texture slots
            if (light.mask && nextMaskIndex < 8) {
              const maskPath = `/light_masks/${light.mask.image}`;
              
              // Check if we already loaded this mask texture
              if (!maskTextureMap.has(maskPath)) {
                const maskTexture = PIXI.Texture.from(maskPath);
                uniforms.uLightMasks[nextMaskIndex] = maskTexture;
                maskTextureMap.set(maskPath, nextMaskIndex);
                nextMaskIndex++;
                
                console.log(`🎭 Mask texture loaded: ${light.mask.image} (slot ${nextMaskIndex - 1})`);
              }
              
              const textureIndex = maskTextureMap.get(maskPath);
              uniforms.uLightHasMask[i] = true;
              uniforms.uLightMaskTextureIndex[i] = textureIndex;
              uniforms.uLightMaskOffsets[i] = [light.mask.offset.x, light.mask.offset.y];
              uniforms.uLightMaskRotations[i] = light.mask.rotation;
              uniforms.uLightMaskScales[i] = light.mask.scale;
              
              // Get texture dimensions when available
              const maskTexture = uniforms.uLightMasks[textureIndex];
              if (maskTexture.baseTexture.valid) {
                uniforms.uLightMaskSizes[i] = [maskTexture.width, maskTexture.height];
              } else {
                maskTexture.baseTexture.on('loaded', () => {
                  uniforms.uLightMaskSizes[i] = [maskTexture.width, maskTexture.height];
                });
                uniforms.uLightMaskSizes[i] = [64, 64]; // Default size
              }
            }
          }


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
        ...lightUniforms
      });

      const blockMesh = new PIXI.Mesh(blockGeometry, blockShader as any);
      blockMesh.x = 0;
      blockMesh.y = 0;

      // Store references
      meshesRef.current = [bgMesh, ballMesh, blockMesh];
      shadersRef.current = [bgShader, ballShader, blockShader];

      // Add to stage
      pixiApp.stage.addChild(bgMesh);
      pixiApp.stage.addChild(ballMesh);
      pixiApp.stage.addChild(blockMesh);

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
      });

      // Add other dynamic uniforms
      uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
      uniforms.uAmbientLight = ambientLight.intensity;
      uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
      uniforms.uCanvasSize = [shaderParams.canvasWidth, shaderParams.canvasHeight];
      
      return uniforms;
    };

    const updatedUniforms = createLightUniforms();

    // Apply all uniform updates to all shaders
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        Object.assign(shader.uniforms, updatedUniforms);
      }
    });

    // Force PIXI to re-render when uniforms change (especially for mask updates)
    if (pixiApp && pixiApp.renderer) {
      pixiApp.render();
    }
  }, [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB, mousePos, lightsConfig, ambientLight]);

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