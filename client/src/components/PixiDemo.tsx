import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, useApp } from '@pixi/react';
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

const PixiDemoContent = ({ 
  shaderParams, 
  onGeometryUpdate, 
  onShaderUpdate, 
  onMeshUpdate 
}: PixiDemoProps) => {
  const app = useApp();
  const meshRef = useRef<PIXI.Mesh | null>(null);
  const timeRef = useRef(0);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  
  const geometry = useCustomGeometry(400, 300);
  
  // Load real texture assets
  const textures = useMemo(() => {
    const diffuseTexture = PIXI.Texture.from('/BGTextureTest.jpg');
    const normalTexture = PIXI.Texture.from('/BGTextureNORM.jpg');
    return { diffuseTexture, normalTexture };
  }, []);
  
  const shader = useMemo(() => {
    onShaderUpdate?.('Normal-mapped lighting shader created for real textures');
    
    // Create lighting shader that uses both diffuse and normal maps
    const lightingFragmentShader = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uDiffuse;
      uniform sampler2D uNormal;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor;
      uniform float uWaveAmplitude;
      uniform float uWaveFrequency;
      uniform vec2 uLightPos;

      void main(void) {
        vec2 uv = vTextureCoord;
        
        // Create subtle wave distortion
        float wave = sin(uv.x * uWaveFrequency + uTime) * uWaveAmplitude;
        uv.y += wave;
        
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
    
    return PIXI.Shader.from(vertexShaderSource, lightingFragmentShader, {
      uDiffuse: textures.diffuseTexture,
      uNormal: textures.normalTexture,
      uTime: 0,
      uResolution: [400, 300],
      uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
      uWaveAmplitude: shaderParams.waveAmplitude,
      uWaveFrequency: shaderParams.waveFrequency,
      uLightPos: [mousePos.x, mousePos.y]
    });
  }, [shaderParams, textures, mousePos]);
  
  const mesh = useMemo(() => {
    onMeshUpdate?.('PIXI.Mesh created with real textures and normal mapping');
    const meshInstance = new PIXI.Mesh(geometry, shader as any);
    meshInstance.x = 0;
    meshInstance.y = 0;
    return meshInstance;
  }, [geometry, shader, onMeshUpdate]);
  
  // Mouse tracking for light position
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const canvas = app.view as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setMousePos({ x, y });
    };
    
    const canvas = app.view as HTMLCanvasElement;
    canvas.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [app]);
  
  useEffect(() => {
    const vertexCount = geometry.attributes?.aVertexPosition?.buffer?.data?.length ? 
      geometry.attributes.aVertexPosition.buffer.data.length / 2 : 4;
    onGeometryUpdate?.(`Geometry created: ${vertexCount} vertices with real texture mapping`);
    
    if (!app) return;
    
    app.stage.addChild(mesh);
    meshRef.current = mesh;
    
    const ticker = () => {
      timeRef.current += 0.02;
      if (shader && shader.uniforms) {
        shader.uniforms.uTime = timeRef.current;
        shader.uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
        shader.uniforms.uWaveAmplitude = shaderParams.waveAmplitude;
        shader.uniforms.uWaveFrequency = shaderParams.waveFrequency;
        shader.uniforms.uLightPos = [mousePos.x, mousePos.y];
      }
    };
    
    app.ticker.add(ticker);
    
    return () => {
      app.ticker.remove(ticker);
      if (meshRef.current) {
        app.stage.removeChild(meshRef.current);
      }
    };
  }, [mesh, shader, shaderParams, geometry, onGeometryUpdate, app, mousePos]);
  
  return null;
};

const PixiDemo = (props: PixiDemoProps) => {
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
      data-testid="pixi-stage"
    >
      <PixiDemoContent {...props} />
    </Stage>
  );
};

export default PixiDemo;