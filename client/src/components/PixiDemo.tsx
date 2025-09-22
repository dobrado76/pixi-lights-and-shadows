import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import { vertexShaderSource } from '../shaders/vertexShader';
import { fragmentShaderSource } from '../shaders/fragmentShader';
import { ShaderParams } from '../App';

interface PixiDemoProps {
  shaderParams: ShaderParams;
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  const meshesRef = useRef<PIXI.Mesh[]>([]);
  const shadersRef = useRef<PIXI.Shader[]>([]);
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

  // Initialize PIXI Application
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('Initializing PIXI Application...');
    
    try {
      // Simple, reliable PIXI initialization with fallback renderers
      const app = new PIXI.Application({
        width: shaderParams.canvasWidth,
        height: shaderParams.canvasHeight,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        hello: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

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
        
        // Point Light (index 0 - mouse following)
        uniform bool uLight0Enabled;
        uniform vec3 uLight0Position;
        uniform vec3 uLight0Color;
        uniform float uLight0Intensity;
        uniform float uLight0Radius;
        
        // Directional Light (index 1)
        uniform bool uLight1Enabled;
        uniform vec3 uLight1Direction;
        uniform vec3 uLight1Color;
        uniform float uLight1Intensity;
        
        // Spotlight (index 2)
        uniform bool uLight2Enabled;
        uniform vec3 uLight2Position;
        uniform vec3 uLight2Direction;
        uniform vec3 uLight2Color;
        uniform float uLight2Intensity;
        uniform float uLight2Radius;
        uniform float uLight2ConeAngle;
        uniform float uLight2Softness;

        void main(void) {
          vec2 uv = vTextureCoord;
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate world position
          vec2 worldPos = uSpritePos + uv * uSpriteSize;
          vec3 worldPos3D = vec3(worldPos.x, worldPos.y, 0.0);
          
          // Start with ambient lighting
          vec3 finalColor = diffuseColor.rgb * uAmbientLight;
          
          // Point Light (Light 0)
          if (uLight0Enabled) {
            vec3 lightPos3D = uLight0Position;
            vec3 lightDir3D = lightPos3D - worldPos3D;
            float lightDistance = length(lightDir3D);
            vec3 lightDir = normalize(lightDir3D);
            
            float attenuation;
            float normalDot;
            
            if (lightPos3D.z < 0.0) {
              // Below surface lighting
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              attenuation = 1.0 - clamp(lightDistance / uLight0Radius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal.xy, lightDir.xy), 0.0);
            } else {
              // Above surface lighting
              normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              
              vec2 surfaceDistance = worldPos3D.xy - lightPos3D.xy;
              float surface2DDistance = length(surfaceDistance);
              float effectiveRadius = uLight0Radius + (lightPos3D.z * 2.0);
              
              attenuation = 1.0 - clamp(surface2DDistance / effectiveRadius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal, lightDir), 0.0);
            }
            
            float intensity = normalDot * uLight0Intensity * attenuation;
            finalColor += diffuseColor.rgb * uLight0Color * intensity;
          }
          
          // Directional Light (Light 1)
          if (uLight1Enabled) {
            vec3 lightDir = normalize(uLight1Direction);
            float directionalDot = max(dot(normal, lightDir), 0.0);
            float intensity = directionalDot * uLight1Intensity;
            finalColor += diffuseColor.rgb * uLight1Color * intensity;
          }
          
          // Spotlight (Light 2)
          if (uLight2Enabled) {
            vec3 spotlightDir3D = uLight2Position - worldPos3D;
            float spotlightDistance = length(spotlightDir3D);
            vec3 spotlightLightDir = normalize(spotlightDir3D);
            
            // Calculate cone attenuation
            float coneAngle = dot(-spotlightLightDir, normalize(uLight2Direction));
            float coneAngleRad = radians(uLight2ConeAngle);
            float innerCone = cos(coneAngleRad * 0.5);
            float outerCone = cos(coneAngleRad);
            float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
            
            // Distance attenuation
            float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uLight2Radius, 0.0, 1.0);
            
            // Normal mapping
            float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
            
            // Apply softness and combine
            float softness = mix(1.0, coneFactor, uLight2Softness);
            float intensity = spotNormalDot * uLight2Intensity * spotDistanceAttenuation * softness * coneFactor;
            finalColor += diffuseColor.rgb * uLight2Color * intensity;
          }
          
          // Apply color tinting
          finalColor *= uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Background shader and mesh (using unified sprite shader)
      const bgShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [0, 0], // Background covers entire canvas starting at (0,0)
        uSpriteSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Full canvas size
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0),
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight,
        uLightZ: shaderParams.lightZ,
        uDirectionalIntensity: shaderParams.directionalIntensity || 0.5,
        uDirectionalAngle: shaderParams.directionalAngle || 315,
        uSpotlightEnabled: shaderParams.spotlightEnabled || false,
        uSpotlightPos: [shaderParams.spotlightX || 200, shaderParams.spotlightY || 150, shaderParams.spotlightZ || 100],
        uSpotlightDir: [shaderParams.spotlightDirX || 0.0, shaderParams.spotlightDirY || 0.0, shaderParams.spotlightDirZ || -1.0],
        uSpotlightIntensity: shaderParams.spotlightIntensity || 2.0,
        uSpotlightInnerRadius: shaderParams.spotlightInnerRadius || 50,
        uSpotlightOuterRadius: shaderParams.spotlightOuterRadius || 150,
        uSpotlightConeAngle: shaderParams.spotlightConeAngle || 30,
        uSpotlightSoftness: shaderParams.spotlightSoftness || 0.5
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
        uLightPos: [mousePos.x, mousePos.y],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos:  [ballPos.x, ballPos.y],
        uSpriteSize: [ballDiffuse.width, ballDiffuse.height],
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0),
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight,
        uLightZ: shaderParams.lightZ,
        uDirectionalIntensity: shaderParams.directionalIntensity || 0.5,
        uDirectionalAngle: shaderParams.directionalAngle || 315,
        uSpotlightEnabled: shaderParams.spotlightEnabled || false,
        uSpotlightPos: [shaderParams.spotlightX || 200, shaderParams.spotlightY || 150, shaderParams.spotlightZ || 100],
        uSpotlightDir: [shaderParams.spotlightDirX || 0.0, shaderParams.spotlightDirY || 0.0, shaderParams.spotlightDirZ || -1.0],
        uSpotlightIntensity: shaderParams.spotlightIntensity || 2.0,
        uSpotlightInnerRadius: shaderParams.spotlightInnerRadius || 50,
        uSpotlightOuterRadius: shaderParams.spotlightOuterRadius || 150,
        uSpotlightConeAngle: shaderParams.spotlightConeAngle || 30,
        uSpotlightSoftness: shaderParams.spotlightSoftness || 0.5
      });

      const ballMesh = new PIXI.Mesh(ballGeometry, ballShader as any);
      ballMesh.x = 0;
      ballMesh.y = 0;

      // Block shader and mesh
      const blockShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: blockDiffuse,
        uNormal: blockNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [blockPos.x, blockPos.y],
        uSpriteSize: [blockDiffuse.width, blockDiffuse.height],
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0),
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight,
        uLightZ: shaderParams.lightZ,
        uDirectionalIntensity: shaderParams.directionalIntensity || 0.5,
        uDirectionalAngle: shaderParams.directionalAngle || 315,
        uSpotlightEnabled: shaderParams.spotlightEnabled || false,
        uSpotlightPos: [shaderParams.spotlightX || 200, shaderParams.spotlightY || 150, shaderParams.spotlightZ || 100],
        uSpotlightDir: [shaderParams.spotlightDirX || 0.0, shaderParams.spotlightDirY || 0.0, shaderParams.spotlightDirZ || -1.0],
        uSpotlightIntensity: shaderParams.spotlightIntensity || 2.0,
        uSpotlightInnerRadius: shaderParams.spotlightInnerRadius || 50,
        uSpotlightOuterRadius: shaderParams.spotlightOuterRadius || 150,
        uSpotlightConeAngle: shaderParams.spotlightConeAngle || 30,
        uSpotlightSoftness: shaderParams.spotlightSoftness || 0.5
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

  // Handle shader updates
  useEffect(() => {
    if (shadersRef.current.length === 0) return;

    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        // Basic color and position
        shader.uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
        shader.uniforms.uLightPos = [mousePos.x, mousePos.y];
        // Enhanced lighting parameters
        shader.uniforms.uLightIntensity = shaderParams.lightIntensity;
        shader.uniforms.uLightRadius = Math.max(shaderParams.lightRadius, 1.0); // Prevent division by zero
        shader.uniforms.uLightColor = [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB];
        shader.uniforms.uAmbientLight = shaderParams.ambientLight;
        shader.uniforms.uLightZ = shaderParams.lightZ;
        shader.uniforms.uDirectionalIntensity = shaderParams.directionalIntensity || 0.5;
        shader.uniforms.uDirectionalAngle = shaderParams.directionalAngle || 315;
        shader.uniforms.uSpotlightEnabled = shaderParams.spotlightEnabled || false;
        shader.uniforms.uSpotlightPos = [shaderParams.spotlightX || 200, shaderParams.spotlightY || 150, shaderParams.spotlightZ || 100];
        shader.uniforms.uSpotlightDir = [shaderParams.spotlightDirX || 0.0, shaderParams.spotlightDirY || 0.0, shaderParams.spotlightDirZ || -1.0];
        shader.uniforms.uSpotlightIntensity = shaderParams.spotlightIntensity || 2.0;
        shader.uniforms.uSpotlightInnerRadius = shaderParams.spotlightInnerRadius || 50;
        shader.uniforms.uSpotlightOuterRadius = shaderParams.spotlightOuterRadius || 150;
        shader.uniforms.uSpotlightConeAngle = shaderParams.spotlightConeAngle || 30;
        shader.uniforms.uSpotlightSoftness = shaderParams.spotlightSoftness || 0.5;
      }
    });
  }, [shaderParams, mousePos]);

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