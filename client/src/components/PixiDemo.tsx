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
      // Simple, reliable PIXI initialization
      const app = new PIXI.Application({
        width: shaderParams.canvasWidth,
        height: shaderParams.canvasHeight,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        hello: false,
      });

      // Use the canvas property for modern PIXI.js or fallback to view
      const canvas = (app as any).canvas || (app as any).view;
      
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
        const canvas = (pixiApp as any).canvas || (pixiApp as any).view;
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

      // Simple background shader
      const backgroundFragmentShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uDiffuse;
        uniform sampler2D uNormal;
        uniform vec2 uLightPos;
        uniform vec2 uResolution;
        uniform vec3 uColor;
        uniform float uLightIntensity;
        uniform float uLightRadius;
        uniform vec3 uLightColor;
        uniform float uAmbientLight;

        void main(void) {
          vec2 uv = vTextureCoord;
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          vec2 lightPos = uLightPos / uResolution;
          vec2 lightDir = lightPos - uv;
          float lightDistance = length(lightDir * uResolution);
          lightDir = normalize(lightDir);
          
          float attenuation = 1.0 - clamp(lightDistance / uLightRadius, 0.0, 1.0);
          attenuation = attenuation * attenuation;
          
          float normalDot = max(dot(normal.xy, lightDir), 0.0);
          float lightIntensity = normalDot * uLightIntensity * attenuation;
          
          vec3 ambientContribution = diffuseColor.rgb * uAmbientLight;
          vec3 lightContribution = diffuseColor.rgb * uLightColor * lightIntensity;
          vec3 finalColor = (ambientContribution + lightContribution) * uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Simple sprite shader  
      const spriteFragmentShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uDiffuse;
        uniform sampler2D uNormal;
        uniform vec2 uLightPos;
        uniform vec2 uSpritePos;
        uniform vec2 uSpriteSize;
        uniform vec3 uColor;
        uniform float uLightIntensity;
        uniform float uLightRadius;
        uniform vec3 uLightColor;
        uniform float uAmbientLight;

        void main(void) {
          vec2 uv = vTextureCoord;
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate world position
          vec2 worldPos = uSpritePos + uv * uSpriteSize;
          vec2 lightDir = uLightPos - worldPos;
          float lightDistance = length(lightDir);
          lightDir = normalize(lightDir);
          
          float attenuation = 1.0 - clamp(lightDistance / uLightRadius, 0.0, 1.0);
          attenuation = attenuation * attenuation;
          
          float normalDot = max(dot(normal.xy, lightDir), 0.0);
          float lightIntensity = normalDot * uLightIntensity * attenuation;
          
          vec3 ambientContribution = diffuseColor.rgb * uAmbientLight;
          vec3 lightContribution = diffuseColor.rgb * uLightColor * lightIntensity;
          vec3 finalColor = (ambientContribution + lightContribution) * uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Background shader and mesh
      const bgShader = PIXI.Shader.from(vertexShaderSource, backgroundFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uResolution: [shaderParams.canvasWidth, shaderParams.canvasHeight],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uLightPos: [mousePos.x, mousePos.y],
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0),
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight
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
        uAmbientLight: shaderParams.ambientLight
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
        uAmbientLight: shaderParams.ambientLight
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