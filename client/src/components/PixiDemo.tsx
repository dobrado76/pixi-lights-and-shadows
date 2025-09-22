import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import { vertexShaderSource } from '../shaders/vertexShader';
import { fragmentShaderSource } from '../shaders/fragmentShader';
import { ShaderParams } from '../App';
import { appendErrors } from 'react-hook-form';

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
  
  const geometry = useCustomGeometry(400, 300);

  // Initialize PIXI Application
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('Initializing PIXI Application...');
    
    try {
      const app = new PIXI.Application({
        width: 400,
        height: 300,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        // Explicit renderer preferences for better compatibility
        preference: 'webgl2',
        powerPreference: 'default',
        // Fallback options for headless/testing environments
        forceCanvas: false,
        preserveDrawingBuffer: false,
        clearBeforeRender: true,
        hello: false, // Disable PIXI greeting in console
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

    try {
      // Load textures
      const bgDiffuse = PIXI.Texture.from('/BGTextureTest.jpg');
      const bgNormal = PIXI.Texture.from('/BGTextureNORM.jpg');
      const ballDiffuse = PIXI.Texture.from('/ball.png');
      const ballNormal = PIXI.Texture.from('/ballN.png');
      const blockDiffuse = PIXI.Texture.from('/block.png');
      const blockNormal = PIXI.Texture.from('/blockNormalMap.jpg');

      // Update status
      onGeometryUpdate?.('Geometry created: 4 vertices with real texture mapping');
      onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
      onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');

      // Enhanced lighting shader with new parameters
      const lightingFragmentShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uDiffuse;
        uniform sampler2D uNormal;
        uniform vec2 uLightPos;
        uniform vec2 uResolution;
        uniform vec3 uColor;
        uniform float uTime;
        // Enhanced lighting uniforms
        uniform float uLightIntensity;
        uniform float uLightRadius;
        uniform vec3 uLightColor;
        uniform float uAmbientLight;

        void main(void) {
          vec2 uv = vTextureCoord;
          
          // Sample textures
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate light position in UV space
          vec2 lightPos = uLightPos / uResolution;
          vec2 lightDir = lightPos - uv;
          float lightDistance = length(lightDir * uResolution);
          lightDir = normalize(lightDir);
          
          // Enhanced lighting calculation with falloff
          float attenuation = 1.0 - clamp(lightDistance / uLightRadius, 0.0, 1.0);
          attenuation = attenuation * attenuation; // Quadratic falloff
          
          // Normal mapping calculation
          float normalDot = max(dot(normal.xy, lightDir), 0.0);
          float lightIntensity = normalDot * uLightIntensity * attenuation;
          
          // Combine ambient and direct lighting
          vec3 ambientContribution = diffuseColor.rgb * uAmbientLight;
          vec3 lightContribution = diffuseColor.rgb * uLightColor * lightIntensity;
          
          // Apply color tinting to final result
          vec3 finalColor = (ambientContribution + lightContribution) * uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Background shader and mesh
      const bgShader = PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uTime: 0,
        uResolution: [pixiApp.screen.width, pixiApp.screen.height],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uLightPos: [mousePos.x, mousePos.y],
        // Enhanced lighting uniforms
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0), // Prevent division by zero
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight
      });

      const bgMesh = new PIXI.Mesh(geometry, bgShader as any);
      bgMesh.x = 0;
      bgMesh.y = 0;

      // Create sprite geometry
      const spriteGeometry = new PIXI.Geometry();
      const spriteSize = 64;
      const spriteVertices = [0, 0, spriteSize, 0, spriteSize, spriteSize, 0, spriteSize];
      const spriteUvs = [0, 0, 1, 0, 1, 1, 0, 1];
      const spriteIndices = [0, 1, 2, 0, 2, 3];
      
      spriteGeometry.addAttribute('aVertexPosition', spriteVertices, 2);
      spriteGeometry.addAttribute('aTextureCoord', spriteUvs, 2);
      spriteGeometry.addIndex(spriteIndices);

      // Ball shader and mesh
      const ballShader = PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
        uDiffuse: ballDiffuse,
        uNormal: ballNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uResolution: [pixiApp.screen.width, pixiApp.screen.height],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uTime: 0,
        // Enhanced lighting uniforms
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0), // Prevent division by zero
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight
      });

      const ballMesh = new PIXI.Mesh(spriteGeometry, ballShader as any);
      ballMesh.x = 100;
      ballMesh.y = 100;

      // Block shader and mesh
      const blockShader = PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
        uDiffuse: blockDiffuse,
        uNormal: blockNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uResolution: [400, 300],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uTime: 0,
        // Enhanced lighting uniforms
        uLightIntensity: shaderParams.lightIntensity,
        uLightRadius: Math.max(shaderParams.lightRadius, 1.0), // Prevent division by zero
        uLightColor: [shaderParams.lightColorR, shaderParams.lightColorG, shaderParams.lightColorB],
        uAmbientLight: shaderParams.ambientLight
      });

      const blockMesh = new PIXI.Mesh(spriteGeometry, blockShader as any);
      blockMesh.x = 250;
      blockMesh.y = 150;

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
    }

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
      style={{ width: 400, height: 300, border: '1px solid #333' }}
      data-testid="pixi-stage"
    />
  );
};

export default PixiDemo;