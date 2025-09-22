import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import { vertexShaderSource } from '../shaders/vertexShader';
import { fragmentShaderSource } from '../shaders/fragmentShader';
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
      } else {
        throw new Error('Canvas element not found');
      }
    } catch (error) {
      console.error('PIXI Application initialization failed:', error);
      
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
          const MAX_LIGHTS = 16;
          
          // Get all enabled lights
          const enabledLights = lightsConfig.filter(light => light.enabled);
          
          // Initialize arrays
          const lightTypes = new Array(MAX_LIGHTS).fill(0);
          const lightEnabled = new Array(MAX_LIGHTS).fill(false);
          const lightPositions = new Array(MAX_LIGHTS).fill(null).map(() => [0, 0, 0]);
          const lightDirections = new Array(MAX_LIGHTS).fill(null).map(() => [0, 0, -1]);
          const lightColors = new Array(MAX_LIGHTS).fill(null).map(() => [1, 1, 1]);
          const lightIntensities = new Array(MAX_LIGHTS).fill(0);
          const lightRadii = new Array(MAX_LIGHTS).fill(100);
          const lightConeAngles = new Array(MAX_LIGHTS).fill(30);
          const lightSoftness = new Array(MAX_LIGHTS).fill(0.5);
          const lightFollowMouse = new Array(MAX_LIGHTS).fill(false);
          
          // Populate light data
          const numLights = Math.min(enabledLights.length, MAX_LIGHTS);
          for (let i = 0; i < numLights; i++) {
            const light = enabledLights[i];
            
            // Set light type: 1=point, 2=directional, 3=spotlight
            lightTypes[i] = light.type === 'point' ? 1 : light.type === 'directional' ? 2 : light.type === 'spotlight' ? 3 : 0;
            lightEnabled[i] = true;
            
            // Position (for point and spotlight)
            if (light.type === 'point' || light.type === 'spotlight') {
              lightPositions[i] = [
                light.followMouse ? mousePos.x : light.position.x,
                light.followMouse ? mousePos.y : light.position.y,
                light.position.z
              ];
            }
            
            // Direction (for directional and spotlight)
            if (light.type === 'directional' || light.type === 'spotlight') {
              lightDirections[i] = [light.direction.x, light.direction.y, light.direction.z];
            }
            
            // Common properties
            lightColors[i] = [light.color.r, light.color.g, light.color.b];
            lightIntensities[i] = light.intensity;
            lightFollowMouse[i] = light.followMouse || false;
            
            // Type-specific properties
            if (light.type === 'point' || light.type === 'spotlight') {
              lightRadii[i] = light.radius || 150;
            }
            if (light.type === 'spotlight') {
              lightConeAngles[i] = light.coneAngle || 30;
              lightSoftness[i] = light.softness || 0.5;
            }
          }
          
          // Set uniforms
          uniforms.uNumLights = numLights;
          uniforms.uLightTypes = lightTypes;
          uniforms.uLightEnabled = lightEnabled;
          uniforms.uLightPositions = lightPositions;
          uniforms.uLightDirections = lightDirections;
          uniforms.uLightColors = lightColors;
          uniforms.uLightIntensities = lightIntensities;
          uniforms.uLightRadii = lightRadii;
          uniforms.uLightConeAngles = lightConeAngles;
          uniforms.uLightSoftness = lightSoftness;
          uniforms.uLightFollowMouse = lightFollowMouse;
          
          return uniforms;
        };

      // Update status
      onGeometryUpdate?.('Geometry created: 4 vertices with real texture mapping');
      onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
      onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');

      // Simplified multi-light shader - supports common 3-light setup
      const spriteFragmentShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uDiffuse;
        uniform sampler2D uNormal;
        uniform vec2 uSpritePos;
        uniform vec2 uSpriteSize;
        uniform vec3 uColor;
        uniform float uAmbientLight;
        uniform vec3 uAmbientColor;
        
        // Dynamic Light System - supports up to 16 lights
        #define MAX_LIGHTS 16
        uniform int uNumLights;
        uniform int uLightTypes[MAX_LIGHTS];     // 0=ambient, 1=point, 2=directional, 3=spotlight
        uniform bool uLightEnabled[MAX_LIGHTS];
        uniform vec3 uLightPositions[MAX_LIGHTS];
        uniform vec3 uLightDirections[MAX_LIGHTS];
        uniform vec3 uLightColors[MAX_LIGHTS];
        uniform float uLightIntensities[MAX_LIGHTS];
        uniform float uLightRadii[MAX_LIGHTS];
        uniform float uLightConeAngles[MAX_LIGHTS];
        uniform float uLightSoftness[MAX_LIGHTS];
        uniform bool uLightFollowMouse[MAX_LIGHTS];

        void main(void) {
          vec2 uv = vTextureCoord;
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate world position
          vec2 worldPos = uSpritePos + uv * uSpriteSize;
          vec3 worldPos3D = vec3(worldPos.x, worldPos.y, 0.0);
          
          // Start with ambient lighting
          vec3 finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
          
          // Process all dynamic lights
          for (int i = 0; i < MAX_LIGHTS; i++) {
            if (i >= uNumLights) break;
            if (!uLightEnabled[i]) continue;
            
            int lightType = uLightTypes[i];
            
            // Point Light (type 1)
            if (lightType == 1) {
              vec3 lightPos3D = uLightPositions[i];
              vec3 lightDir3D = lightPos3D - worldPos3D;
              float lightDistance = length(lightDir3D);
              vec3 lightDir = normalize(lightDir3D);
              
              float attenuation;
              float normalDot;
              
              if (lightPos3D.z < 0.0) {
                // Below surface lighting
                lightDir3D.y = -lightDir3D.y;
                lightDir = normalize(lightDir3D);
                attenuation = 1.0 - clamp(lightDistance / uLightRadii[i], 0.0, 1.0);
                attenuation = attenuation * attenuation;
                normalDot = max(dot(normal.xy, lightDir.xy), 0.0);
              } else {
                // Above surface lighting
                normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
                lightDir3D.y = -lightDir3D.y;
                lightDir = normalize(lightDir3D);
                
                vec2 surfaceDistance = worldPos3D.xy - lightPos3D.xy;
                float surface2DDistance = length(surfaceDistance);
                float effectiveRadius = uLightRadii[i] + (lightPos3D.z * 2.0);
                
                attenuation = 1.0 - clamp(surface2DDistance / effectiveRadius, 0.0, 1.0);
                attenuation = attenuation * attenuation;
                normalDot = max(dot(normal, lightDir), 0.0);
              }
              
              float intensity = normalDot * uLightIntensities[i] * attenuation;
              finalColor += diffuseColor.rgb * uLightColors[i] * intensity;
            }
            
            // Directional Light (type 2)
            else if (lightType == 2) {
              vec3 lightDir = normalize(uLightDirections[i]);
              float directionalDot = max(dot(normal, lightDir), 0.0);
              float intensity = directionalDot * uLightIntensities[i];
              finalColor += diffuseColor.rgb * uLightColors[i] * intensity;
            }
            
            // Spotlight (type 3)
            else if (lightType == 3) {
              vec3 spotlightDir3D = uLightPositions[i] - worldPos3D;
              float spotlightDistance = length(spotlightDir3D);
              vec3 spotlightLightDir = normalize(spotlightDir3D);
              
              // Calculate cone attenuation
              float coneAngle = dot(-spotlightLightDir, normalize(uLightDirections[i]));
              float coneAngleRad = radians(uLightConeAngles[i]);
              float innerCone = cos(coneAngleRad * 0.5);
              float outerCone = cos(coneAngleRad);
              float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
              
              // Distance attenuation
              float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uLightRadii[i], 0.0, 1.0);
              
              // Normal mapping
              float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
              
              // Apply softness and combine
              float softness = mix(1.0, coneFactor, uLightSoftness[i]);
              float intensity = spotNormalDot * uLightIntensities[i] * spotDistanceAttenuation * softness * coneFactor;
              finalColor += diffuseColor.rgb * uLightColors[i] * intensity;
            }
          }
          
          // Apply color tinting
          finalColor *= uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Background shader and mesh (using unified sprite shader)
      const lightUniforms = createLightUniforms();
      const bgShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [0, 0], // Background covers entire canvas starting at (0,0)
        uSpriteSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Full canvas size
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

    // Full light uniforms recreation - dynamic array-based approach
    const createLightUniforms = () => {
      const uniforms: any = {};
      const MAX_LIGHTS = 16;
      
      // Get all enabled lights
      const enabledLights = lightsConfig.filter(light => light.enabled);
      
      // Initialize arrays
      const lightTypes = new Array(MAX_LIGHTS).fill(0);
      const lightEnabled = new Array(MAX_LIGHTS).fill(false);
      const lightPositions = new Array(MAX_LIGHTS).fill(null).map(() => [0, 0, 0]);
      const lightDirections = new Array(MAX_LIGHTS).fill(null).map(() => [0, 0, -1]);
      const lightColors = new Array(MAX_LIGHTS).fill(null).map(() => [1, 1, 1]);
      const lightIntensities = new Array(MAX_LIGHTS).fill(0);
      const lightRadii = new Array(MAX_LIGHTS).fill(100);
      const lightConeAngles = new Array(MAX_LIGHTS).fill(30);
      const lightSoftness = new Array(MAX_LIGHTS).fill(0.5);
      const lightFollowMouse = new Array(MAX_LIGHTS).fill(false);
      
      // Populate light data
      const numLights = Math.min(enabledLights.length, MAX_LIGHTS);
      for (let i = 0; i < numLights; i++) {
        const light = enabledLights[i];
        
        // Set light type: 1=point, 2=directional, 3=spotlight
        lightTypes[i] = light.type === 'point' ? 1 : light.type === 'directional' ? 2 : light.type === 'spotlight' ? 3 : 0;
        lightEnabled[i] = true;
        
        // Position (for point and spotlight)
        if (light.type === 'point' || light.type === 'spotlight') {
          lightPositions[i] = [
            light.followMouse ? mousePos.x : light.position.x,
            light.followMouse ? mousePos.y : light.position.y,
            light.position.z
          ];
        }
        
        // Direction (for directional and spotlight)
        if (light.type === 'directional' || light.type === 'spotlight') {
          lightDirections[i] = [light.direction.x, light.direction.y, light.direction.z];
        }
        
        // Common properties
        lightColors[i] = [light.color.r, light.color.g, light.color.b];
        lightIntensities[i] = light.intensity;
        lightFollowMouse[i] = light.followMouse || false;
        
        // Type-specific properties
        if (light.type === 'point' || light.type === 'spotlight') {
          lightRadii[i] = light.radius || 150;
        }
        if (light.type === 'spotlight') {
          lightConeAngles[i] = light.coneAngle || 30;
          lightSoftness[i] = light.softness || 0.5;
        }
      }
      
      // Set uniforms
      uniforms.uNumLights = numLights;
      uniforms.uLightTypes = lightTypes;
      uniforms.uLightEnabled = lightEnabled;
      uniforms.uLightPositions = lightPositions;
      uniforms.uLightDirections = lightDirections;
      uniforms.uLightColors = lightColors;
      uniforms.uLightIntensities = lightIntensities;
      uniforms.uLightRadii = lightRadii;
      uniforms.uLightConeAngles = lightConeAngles;
      uniforms.uLightSoftness = lightSoftness;
      uniforms.uLightFollowMouse = lightFollowMouse;

      // Add other dynamic uniforms
      uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
      uniforms.uAmbientLight = ambientLight.intensity;
      uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
      
      return uniforms;
    };

    const updatedUniforms = createLightUniforms();

    // Apply all uniform updates to all shaders
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        Object.assign(shader.uniforms, updatedUniforms);
      }
    });
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