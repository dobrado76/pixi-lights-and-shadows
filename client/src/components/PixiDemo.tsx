import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import vertexShaderSource from '../shaders/vertex.glsl?raw';
import fragmentShaderSource from '../shaders/fragment.glsl?raw';
import { ShaderParams } from '../App';
import { Light, ShadowConfig } from '@/lib/lights';
import { SceneManager, SceneSprite } from './Sprite';

/**
 * Core PIXI.js rendering component implementing unified screen-space lighting system.
 * Uses deferred rendering approach with unified normal map buffer for simplified lighting.
 */

interface PixiDemoProps {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  shadowConfig: ShadowConfig;
  sceneConfig: { scene: Record<string, any> };
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, lightsConfig, ambientLight, shadowConfig, sceneConfig, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  
  // Core rendering references
  const meshesRef = useRef<PIXI.Mesh[]>([]);
  const shadersRef = useRef<PIXI.Shader[]>([]);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  
  // Unified lighting system references
  const normalBufferRef = useRef<PIXI.RenderTexture | null>(null);
  const renderTargetRef = useRef<PIXI.RenderTexture | null>(null);
  const sceneContainerRef = useRef<PIXI.Container | null>(null);
  const displaySpriteRef = useRef<PIXI.Sprite | null>(null);

  // Load custom geometry
  useCustomGeometry((geometries) => {
    onGeometryUpdate('✅ Loaded custom geometries successfully');
  });

  // Initialize PIXI Application
  useEffect(() => {
    if (canvasRef.current && !pixiApp) {
      const app = new PIXI.Application({
        width: shaderParams.canvasWidth,
        height: shaderParams.canvasHeight,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current.appendChild(app.view as HTMLCanvasElement);

      // Initialize unified lighting buffers
      normalBufferRef.current = PIXI.RenderTexture.create({
        width: shaderParams.canvasWidth,
        height: shaderParams.canvasHeight
      });

      renderTargetRef.current = PIXI.RenderTexture.create({
        width: shaderParams.canvasWidth,
        height: shaderParams.canvasHeight
      });

      sceneContainerRef.current = new PIXI.Container();
      displaySpriteRef.current = new PIXI.Sprite(renderTargetRef.current);
      app.stage.addChild(displaySpriteRef.current);

      setPixiApp(app);
      onShaderUpdate('✅ PIXI app initialized with unified lighting system');

      return () => {
        app.destroy(true);
      };
    }
  }, [shaderParams.canvasWidth, shaderParams.canvasHeight]);

  // Initialize scene manager and sprites
  useEffect(() => {
    if (!pixiApp || !sceneConfig.scene || Object.keys(sceneConfig.scene).length === 0) return;

    console.log('🎭 SCENE LOADING: Creating scene manager...', Object.keys(sceneConfig.scene));
    
    if (sceneManagerRef.current) {
      sceneManagerRef.current.destroy();
    }

    sceneManagerRef.current = new SceneManager(pixiApp);
    
    Object.entries(sceneConfig.scene).forEach(([spriteName, spriteData]: [string, any]) => {
      const sprite = new SceneSprite(
        spriteName,
        spriteData,
        vertexShaderSource,
        fragmentShaderSource,
        sceneManagerRef.current!
      );
      
      meshesRef.current.push(sprite.mesh);
      shadersRef.current.push(sprite.mesh.shader as PIXI.Shader);
      
      if (sceneContainerRef.current) {
        sceneContainerRef.current.addChild(sprite.mesh);
      }
    });

    onMeshUpdate(`✅ Scene loaded: ${Object.keys(sceneConfig.scene).length} sprites`);
  }, [pixiApp, sceneConfig.scene, vertexShaderSource, fragmentShaderSource]);

  // Unified screen-space normal buffer builder
  const buildUnifiedNormalBuffer = () => {
    if (!pixiApp || !normalBufferRef.current || !sceneContainerRef.current) return;

    console.log('🔧 BUILDING unified normal buffer...');
    
    // Clear the normal buffer
    pixiApp.renderer.render(new PIXI.Container(), { renderTexture: normalBufferRef.current, clear: true });
    
    // Render all sprite normal maps to unified buffer
    meshesRef.current.forEach((mesh, index) => {
      if (mesh.shader && mesh.shader.uniforms) {
        // Set to normal-only mode
        mesh.shader.uniforms.uRenderMode = 1; // Normal buffer mode
        
        // Handle sprite transformations for unified buffer
        const sprite = sceneManagerRef.current?.getSprites()[index];
        if (sprite) {
          mesh.position.set(sprite.position.x, sprite.position.y);
          mesh.rotation = sprite.rotation;
          mesh.scale.set(sprite.scale.x, sprite.scale.y);
          mesh.pivot.set(sprite.pivot.x, sprite.pivot.y);
        }
      }
    });

    // Render to normal buffer
    pixiApp.renderer.render(sceneContainerRef.current, { renderTexture: normalBufferRef.current, clear: false });
    
    // Reset to lighting mode
    meshesRef.current.forEach(mesh => {
      if (mesh.shader && mesh.shader.uniforms) {
        mesh.shader.uniforms.uRenderMode = 0; // Lighting mode
      }
    });
  };

  // Unified lighting renderer 
  const renderUnifiedLighting = (lights: Light[]) => {
    if (!pixiApp || !normalBufferRef.current || !renderTargetRef.current || !sceneContainerRef.current) return;

    console.log('🌟 UNIFIED LIGHTING: Rendering with', lights.length, 'lights');

    // Step 1: Build unified normal buffer
    buildUnifiedNormalBuffer();

    // Step 2: Apply lighting uniforms to all shaders
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        // Pass unified normal buffer
        shader.uniforms.uNormalBuffer = normalBufferRef.current;
        
        // Lighting parameters
        shader.uniforms.uAmbientLight = ambientLight.intensity;
        shader.uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
        
        // Mouse-following light
        shader.uniforms.uMousePos = [mousePos.x, mousePos.y];
        
        // Process lights (simplified - just take first few lights)
        const enabledLights = lights.filter(light => light.enabled).slice(0, 4);
        enabledLights.forEach((light, index) => {
          const prefix = `uLight${index}`;
          shader.uniforms[`${prefix}Position`] = [
            light.followMouse ? mousePos.x : light.position.x,
            light.followMouse ? mousePos.y : light.position.y, 
            light.position.z
          ];
          shader.uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
          shader.uniforms[`${prefix}Intensity`] = light.intensity;
          shader.uniforms[`${prefix}Enabled`] = true;
        });
        
        // Disable unused lights
        for (let i = enabledLights.length; i < 4; i++) {
          shader.uniforms[`uLight${i}Enabled`] = false;
        }
      }
    });

    // Step 3: Render final result
    pixiApp.renderer.render(sceneContainerRef.current, { renderTexture: renderTargetRef.current, clear: true });
    
    if (displaySpriteRef.current) {
      displaySpriteRef.current.texture = renderTargetRef.current;
    }
  };

  // Unified lighting system - replaces complex per-sprite lighting
  useEffect(() => {
    console.log('🌟 UNIFIED LIGHTING UPDATE triggered!', {
      lightsCount: lightsConfig.length,
      timestamp: Date.now()
    });
    
    if (!pixiApp || !normalBufferRef.current || !renderTargetRef.current) return;
    
    // Call the unified lighting system instead of complex per-sprite logic
    renderUnifiedLighting(lightsConfig);
    
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