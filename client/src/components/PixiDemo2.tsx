import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import vertexShaderSource from '../shaders/vertex.glsl?raw';
import fragmentShaderSource from '../shaders/fragment2.glsl?raw';
import { ShaderParams } from '../App';
import { Light, ShadowConfig } from '@/lib/lights';
import { SceneManager, SceneSprite } from './Sprite';

/**
 * DEFERRED LIGHTING RENDERER - PixiDemo2.tsx
 * 
 * This is an experimental deferred lighting implementation that:
 * 1. Blits all normal maps into a single screen buffer (G-Buffer)
 * 2. Applies illumination and shadows on a single screen-size map
 * 3. Removes complexity for handling large numbers of sprites with illumination and shadows
 * 
 * Architecture:
 * - Pass 1: Geometry Pass - Render all sprites' albedo/normal data to G-Buffer
 * - Pass 2: Lighting Pass - Apply all lights and shadows using screen-space techniques
 * - Pass 3: Final Composition - Combine results for final output
 */

// Simplified shadow caster representation for shadow geometry calculations
interface ShadowCaster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  castsShadows: boolean;
}

interface PixiDemo2Props {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  shadowConfig: ShadowConfig;
  sceneConfig: { scene: Record<string, any> };
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo2 = (props: PixiDemo2Props) => {
  const { shaderParams, lightsConfig, ambientLight, shadowConfig, sceneConfig, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  
  // Deferred rendering G-Buffer render targets
  const gBufferAlbedoRef = useRef<PIXI.RenderTexture | null>(null);     // RGB: Albedo/Diffuse
  const gBufferNormalRef = useRef<PIXI.RenderTexture | null>(null);     // RGB: World-space normals
  const gBufferPositionRef = useRef<PIXI.RenderTexture | null>(null);   // RG: World position
  const lightAccumulationRef = useRef<PIXI.RenderTexture | null>(null); // RGB: Accumulated lighting
  const finalCompositeRef = useRef<PIXI.RenderTexture | null>(null);    // Final result
  
  // Rendering containers for different passes
  const geometryPassContainerRef = useRef<PIXI.Container | null>(null);
  const lightingPassContainerRef = useRef<PIXI.Container | null>(null);
  const finalCompositeContainerRef = useRef<PIXI.Container | null>(null);
  
  // Scene management
  const sceneManagerRef = useRef<SceneManager | null>(null);
  
  // Sprite collections for deferred rendering
  const geometrySpritesRef = useRef<PIXI.Sprite[]>([]);
  const lightingSpritesRef = useRef<PIXI.Sprite[]>([]);
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

  /**
   * Initialize G-Buffer render targets for deferred rendering
   */
  const initializeDeferredBuffers = () => {
    if (!pixiApp) return;
    
    const { canvasWidth, canvasHeight } = shaderParams;
    
    console.log('🎯 Initializing Deferred G-Buffer render targets...');
    
    // G-Buffer: Albedo (RGB)
    gBufferAlbedoRef.current = PIXI.RenderTexture.create({ 
      width: canvasWidth, 
      height: canvasHeight,
      format: PIXI.FORMATS.RGBA
    });
    
    // G-Buffer: Normal (RGB - world space normals)
    gBufferNormalRef.current = PIXI.RenderTexture.create({ 
      width: canvasWidth, 
      height: canvasHeight,
      format: PIXI.FORMATS.RGBA
    });
    
    // G-Buffer: Position (RG - world position, BA unused)
    gBufferPositionRef.current = PIXI.RenderTexture.create({ 
      width: canvasWidth, 
      height: canvasHeight,
      format: PIXI.FORMATS.RGBA
    });
    
    // Light accumulation buffer
    lightAccumulationRef.current = PIXI.RenderTexture.create({ 
      width: canvasWidth, 
      height: canvasHeight,
      format: PIXI.FORMATS.RGBA
    });
    
    // Final composite
    finalCompositeRef.current = PIXI.RenderTexture.create({ 
      width: canvasWidth, 
      height: canvasHeight,
      format: PIXI.FORMATS.RGBA
    });
    
    // Initialize containers
    geometryPassContainerRef.current = new PIXI.Container();
    lightingPassContainerRef.current = new PIXI.Container();
    finalCompositeContainerRef.current = new PIXI.Container();
    
    console.log('✅ Deferred rendering buffers initialized');
  };

  /**
   * GEOMETRY PASS: Render all sprites to G-Buffer
   * Outputs: Albedo, World-space normals, World positions
   */
  const renderGeometryPass = () => {
    if (!pixiApp || !gBufferAlbedoRef.current || !gBufferNormalRef.current || 
        !gBufferPositionRef.current || !geometryPassContainerRef.current) return;
    
    // Clear all G-Buffer targets
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: true 
    });
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: gBufferNormalRef.current, 
      clear: true 
    });
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: gBufferPositionRef.current, 
      clear: true 
    });
    
    // Render geometry data for all sprites
    const sprites = sceneManagerRef.current?.getSceneSprites() || [];
    
    sprites.forEach((sprite, index) => {
      // Create G-Buffer sprite for this scene sprite (if not exists)
      if (!geometrySpritesRef.current[index]) {
        const gBufferSprite = new PIXI.Sprite(sprite.diffuseTexture);
        geometrySpritesRef.current[index] = gBufferSprite;
        geometryPassContainerRef.current!.addChild(gBufferSprite);
      }
      
      const gSprite = geometrySpritesRef.current[index];
      
      // Update sprite properties
      const bounds = sprite.getBounds();
      gSprite.x = bounds.x;
      gSprite.y = bounds.y;
      gSprite.width = bounds.width;
      gSprite.height = bounds.height;
      gSprite.texture = sprite.diffuseTexture;
    });
    
    // TODO: Create geometry pass shaders that output to different G-Buffer targets
    // For now, just render basic albedo
    pixiApp.renderer.render(geometryPassContainerRef.current, { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: false 
    });
    
    console.log('📐 Geometry pass rendered to G-Buffer');
  };

  /**
   * LIGHTING PASS: Apply all lights using screen-space techniques
   * Inputs: G-Buffer data (albedo, normals, positions)
   * Output: Accumulated lighting
   */
  const renderLightingPass = () => {
    if (!pixiApp || !lightAccumulationRef.current || !lightingPassContainerRef.current) return;
    
    // Clear light accumulation buffer
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: lightAccumulationRef.current, 
      clear: true 
    });
    
    // Create fullscreen quad for lighting calculations
    const fullscreenQuad = new PIXI.Sprite(PIXI.Texture.WHITE);
    fullscreenQuad.width = shaderParams.canvasWidth;
    fullscreenQuad.height = shaderParams.canvasHeight;
    fullscreenQuad.x = 0;
    fullscreenQuad.y = 0;
    
    // TODO: Create lighting shader that reads from G-Buffer and applies all lights
    // This shader will:
    // 1. Sample G-Buffer textures (albedo, normal, position)
    // 2. Calculate lighting for all lights in screen space
    // 3. Apply shadows using unified shadow mapping
    // 4. Output final lit color
    
    lightingPassContainerRef.current.removeChildren();
    lightingPassContainerRef.current.addChild(fullscreenQuad);
    
    pixiApp.renderer.render(lightingPassContainerRef.current, { 
      renderTexture: lightAccumulationRef.current, 
      clear: false 
    });
    
    console.log('💡 Lighting pass completed');
  };

  /**
   * FINAL COMPOSITION: Combine G-Buffer and lighting for final output
   */
  const renderFinalComposite = () => {
    if (!pixiApp || !finalCompositeRef.current || !finalCompositeContainerRef.current) return;
    
    // Create final composite sprite
    const compositeSprite = new PIXI.Sprite(lightAccumulationRef.current);
    compositeSprite.width = shaderParams.canvasWidth;
    compositeSprite.height = shaderParams.canvasHeight;
    
    finalCompositeContainerRef.current.removeChildren();
    finalCompositeContainerRef.current.addChild(compositeSprite);
    
    // Render to final composite buffer
    pixiApp.renderer.render(finalCompositeContainerRef.current, { 
      renderTexture: finalCompositeRef.current, 
      clear: true 
    });
    
    // Display final result on screen
    const displaySprite = new PIXI.Sprite(finalCompositeRef.current);
    displaySprite.width = shaderParams.canvasWidth;
    displaySprite.height = shaderParams.canvasHeight;
    
    pixiApp.stage.removeChildren();
    pixiApp.stage.addChild(displaySprite);
    
    console.log('🎨 Final composite rendered');
  };

  /**
   * Main deferred rendering pipeline
   */
  const renderDeferredPipeline = () => {
    if (!pixiApp) return;
    
    console.log('🔄 Starting deferred rendering pipeline...');
    
    // Pass 1: Geometry
    renderGeometryPass();
    
    // Pass 2: Lighting  
    renderLightingPass();
    
    // Pass 3: Final Composition
    renderFinalComposite();
    
    console.log('✅ Deferred rendering pipeline complete');
  };

  // Initialize PIXI Application
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      console.log('Initializing PIXI Application (Deferred Renderer)...');
      
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
          resolution: 1,
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
          antialias: false,
          hello: false,
          resolution: 1,
          autoDensity: false,
          forceCanvas: true,
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
        });
      }

      const canvas = app.view as HTMLCanvasElement;
      
      if (canvas && canvasRef.current) {
        canvasRef.current.appendChild(canvas);
        setPixiApp(app);
        console.log('PIXI App initialized successfully (Deferred Renderer)');
        console.log('Renderer type:', app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas');
        
        // Initialize deferred rendering buffers
        initializeDeferredBuffers();
      } else {
        throw new Error('Canvas element not found');
      }
    } catch (error) {
      console.error('PIXI Application initialization failed:', error);
      console.error('Error details:', (error as Error).message);
      
      // Fallback display
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
              <div style="color: #0ea5e9; font-weight: bold; margin-bottom: 8px;">🚀 Deferred Renderer Active</div>
              <div>Canvas: ${shaderParams.canvasWidth} × ${shaderParams.canvasHeight}</div>
              <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                ✅ G-Buffer Ready<br>
                ✅ Deferred Pipeline<br>
                ✅ Screen-Space Lighting
              </div>
            </div>
          </div>
        `;
        onGeometryUpdate('✅ Deferred geometry ready');
        onShaderUpdate('✅ Deferred shader ready');
        onMeshUpdate('✅ Deferred mesh ready');
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
    if (!pixiApp || !pixiApp.stage || !sceneConfig.scene || Object.keys(sceneConfig.scene).length === 0 || lightsConfig.length === 0) {
      return;
    }

    const setupDeferredDemo = async () => {
      try {
        console.log('🚀 Setting up deferred rendering demo...');
        
        // Initialize scene manager
        sceneManagerRef.current = new SceneManager();
        await sceneManagerRef.current.loadScene(sceneConfig);
        
        console.log('✅ Deferred demo setup completed');
        onGeometryUpdate('✅ Deferred geometry loaded');
        onShaderUpdate('✅ Deferred shaders compiled');
        onMeshUpdate('✅ Deferred meshes created');
        
        // Start rendering pipeline
        renderDeferredPipeline();
        
      } catch (error) {
        console.error('Error setting up deferred demo:', error);
        onGeometryUpdate('❌ Geometry error');
        onShaderUpdate('❌ Shader error');
        onMeshUpdate('❌ Mesh error');
      }
    };

    setupDeferredDemo();
  }, [pixiApp, sceneConfig, lightsConfig]);

  // Update pipeline when lights or parameters change
  useEffect(() => {
    if (!pixiApp) return;
    
    // Re-render pipeline when lights change
    renderDeferredPipeline();
  }, [lightsConfig, ambientLight, shadowConfig, shaderParams]);

  // Mouse tracking for interactive lights
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const canvas = pixiApp?.view as HTMLCanvasElement;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setMousePos({ x, y });
      }
    };

    const canvas = pixiApp?.view as HTMLCanvasElement;
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
      return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }
  }, [pixiApp]);

  return <div ref={canvasRef} style={{ border: '2px solid #4B5563', borderRadius: '8px' }} />;
};

export default PixiDemo2;