import { useEffect, useMemo, useState } from 'react';
import { Stage } from '@pixi/react';
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
  const [appInstance, setAppInstance] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  
  const geometry = useCustomGeometry(400, 300);
  
  // Load real texture assets
  const textures = useMemo(() => {
    const bgDiffuse = PIXI.Texture.from('/BGTextureTest.jpg');
    const bgNormal = PIXI.Texture.from('/BGTextureNORM.jpg');
    const ballDiffuse = PIXI.Texture.from('/ball.png');
    const ballNormal = PIXI.Texture.from('/ballN.png');
    const blockDiffuse = PIXI.Texture.from('/block.png');
    const blockNormal = PIXI.Texture.from('/blockNormalMap.jpg');
    
    return { 
      bgDiffuse, bgNormal, 
      ballDiffuse, ballNormal, 
      blockDiffuse, blockNormal 
    };
  }, []);
  
  // Initialize PIXI app when stage mounts
  const onAppInit = (app: PIXI.Application) => {
    setAppInstance(app);
    console.log('PIXI App initialized:', app);
  };
  
  // Setup demo when app is ready
  useEffect(() => {
    if (!appInstance || !appInstance.stage) {
      console.log('Waiting for PIXI app to initialize...');
      return;
    }
    
    console.log('Setting up PIXI demo with real textures...');
    
    try {
      onGeometryUpdate?.(`Geometry created: 4 vertices with real texture mapping`);
      onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
      onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');
      
      // Create simple lighting shader
      const lightingFragmentShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uDiffuse;
        uniform sampler2D uNormal;
        uniform vec2 uLightPos;
        uniform vec2 uResolution;
        uniform vec3 uColor;
        uniform float uTime;

        void main(void) {
          vec2 uv = vTextureCoord;
          
          // Sample textures
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate light direction
          vec2 lightPos = uLightPos / uResolution;
          vec2 lightDir = normalize(lightPos - uv);
          
          // Simple normal mapping calculation
          float lightIntensity = max(dot(normal.xy, lightDir), 0.0) + 0.3;
          lightIntensity = mix(0.4, 1.0, lightIntensity);
          
          // Apply lighting and color tinting
          vec3 finalColor = diffuseColor.rgb * uColor * lightIntensity;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;
      
      // Background shader
      const bgShader = PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
        uDiffuse: textures.bgDiffuse,
        uNormal: textures.bgNormal,
        uTime: 0,
        uResolution: [400, 300],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uLightPos: [mousePos.x, mousePos.y]
      });
      
      // Background mesh (fullscreen)
      const bgMesh = new PIXI.Mesh(geometry, bgShader as any);
      bgMesh.x = 0;
      bgMesh.y = 0;
      
      // Create smaller geometry for sprites
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
        uDiffuse: textures.ballDiffuse,
        uNormal: textures.ballNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uResolution: [400, 300],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uTime: 0
      });
      
      const ballMesh = new PIXI.Mesh(spriteGeometry, ballShader as any);
      ballMesh.x = 100;
      ballMesh.y = 100;
      
      // Block shader and mesh
      const blockShader = PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
        uDiffuse: textures.blockDiffuse,
        uNormal: textures.blockNormal,
        uLightPos: [mousePos.x, mousePos.y],
        uResolution: [400, 300],
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uTime: 0
      });
      
      const blockMesh = new PIXI.Mesh(spriteGeometry, blockShader as any);
      blockMesh.x = 250;
      blockMesh.y = 150;
      
      // Add all meshes to stage
      appInstance.stage.addChild(bgMesh);
      appInstance.stage.addChild(ballMesh);
      appInstance.stage.addChild(blockMesh);
      
      // Animation loop
      const ticker = () => {
        // Update all shaders
        if (bgShader.uniforms) {
          bgShader.uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
          bgShader.uniforms.uLightPos = [mousePos.x, mousePos.y];
          bgShader.uniforms.uTime += 0.02;
        }
        
        if (ballShader.uniforms) {
          ballShader.uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
          ballShader.uniforms.uLightPos = [mousePos.x, mousePos.y];
        }
        
        if (blockShader.uniforms) {
          blockShader.uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
          blockShader.uniforms.uLightPos = [mousePos.x, mousePos.y];
        }
      };
      
      appInstance.ticker.add(ticker);
      
      // Mouse tracking
      const handleMouseMove = (event: MouseEvent) => {
        const canvas = appInstance.view as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setMousePos({ x, y });
      };
      
      const canvas = appInstance.view as HTMLCanvasElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      
      // Cleanup function
      return () => {
        appInstance.ticker.remove(ticker);
        appInstance.stage.removeChild(bgMesh);
        appInstance.stage.removeChild(ballMesh);
        appInstance.stage.removeChild(blockMesh);
        canvas.removeEventListener('mousemove', handleMouseMove);
      };
      
    } catch (error) {
      console.error('Error setting up PIXI demo:', error);
    }
    
  }, [appInstance, geometry, textures]);

  return (
    <Stage
      width={400}
      height={300}
      options={{
        backgroundColor: 0x1a1a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }}
      onMount={onAppInit}
      data-testid="pixi-stage"
    />
  );
};

export default PixiDemo;