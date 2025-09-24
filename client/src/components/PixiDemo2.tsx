import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import vertexShaderSource from '../shaders/vertex.glsl?raw';
import fragmentShaderSource from '../shaders/fragment2.glsl?raw';
import geometryPassShaderSource from '../shaders/geometry-pass.glsl?raw';
import lightingPassShaderSource from '../shaders/lighting-pass.glsl?raw';
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
  
  // Shader collections for deferred rendering
  const geometryPassShadersRef = useRef<PIXI.Shader[]>([]);
  const lightingPassShaderRef = useRef<PIXI.Shader | null>(null);
  
  // Sprite collections for deferred rendering
  const geometrySpritesRef = useRef<PIXI.Mesh[]>([]);
  const lightingQuadRef = useRef<PIXI.Mesh | null>(null);
  
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
   * GEOMETRY PASS: Render all sprites to G-Buffer using dedicated geometry shader
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
    
    // Render geometry data for all sprites using G-Buffer shaders
    const sprites = sceneManagerRef.current?.getSprites() || [];
    
    sprites.forEach((sprite: SceneSprite, index: number) => {
      // Create G-Buffer mesh for this scene sprite (if not exists)
      if (!geometrySpritesRef.current[index]) {
        const quad = geometry; // Use the custom geometry
        
        // Create geometry pass shader
        const geometryShader = new PIXI.Shader(
          PIXI.Program.from(vertexShaderSource, geometryPassShaderSource),
          {
            uDiffuse: sprite.diffuseTexture || PIXI.Texture.WHITE,
            uNormal: sprite.normalTexture || PIXI.Texture.WHITE,
            uSpritePos: [0, 0],
            uSpriteSize: [100, 100],
            uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight],
            uRotation: 0
          }
        );
        
        const gBufferMesh = new PIXI.Mesh(quad, geometryShader as any);
        geometrySpritesRef.current[index] = gBufferMesh;
        geometryPassContainerRef.current!.addChild(gBufferMesh);
        geometryPassShadersRef.current[index] = geometryShader;
      }
      
      const gMesh = geometrySpritesRef.current[index];
      const gShader = geometryPassShadersRef.current[index];
      
      // Update mesh properties and uniforms
      const bounds = sprite.getBounds();
      gMesh.x = bounds.x;
      gMesh.y = bounds.y;
      gMesh.width = bounds.width;
      gMesh.height = bounds.height;
      
      // Update shader uniforms for G-Buffer output
      if (gShader.uniforms) {
        gShader.uniforms.uDiffuse = sprite.diffuseTexture || PIXI.Texture.WHITE;
        gShader.uniforms.uNormal = sprite.normalTexture || PIXI.Texture.WHITE;
        gShader.uniforms.uSpritePos = [bounds.x, bounds.y];
        gShader.uniforms.uSpriteSize = [bounds.width, bounds.height];
        gShader.uniforms.uRotation = sprite.rotation || 0;
      }
    });
    
    // Render to albedo buffer (main G-Buffer output)
    pixiApp.renderer.render(geometryPassContainerRef.current, { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: false 
    });
    
    console.log('📐 Geometry pass rendered to G-Buffer with proper shaders');
  };

  /**
   * LIGHTING PASS: Apply all lights using screen-space techniques with dedicated lighting shader
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
    
    // Create or update fullscreen lighting quad
    if (!lightingQuadRef.current) {
      // Prepare light data for screen-space lighting
      const enabledLights = lightsConfig.filter(light => light.enabled && light.type === 'point');
      const lightPositions = enabledLights.map(light => [
        light.followMouse ? mousePos.x : light.position.x,
        light.followMouse ? mousePos.y : light.position.y,
        light.position.z || 10
      ]).flat();
      const lightColors = enabledLights.map(light => [light.color.r, light.color.g, light.color.b]).flat();
      const lightIntensities = enabledLights.map(light => light.intensity);
      const lightRadii = enabledLights.map(light => light.radius || 200);
      
      // Create lighting pass shader
      const lightingShader = new PIXI.Shader(
        PIXI.Program.from(vertexShaderSource, lightingPassShaderSource),
        {
          uGBufferAlbedo: gBufferAlbedoRef.current,
          uGBufferNormal: gBufferNormalRef.current,
          uGBufferPosition: gBufferPositionRef.current,
          uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight],
          uAmbientLight: ambientLight.intensity,
          uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
          uNumPointLights: enabledLights.length,
          uPointLightPositions: lightPositions,
          uPointLightColors: lightColors,
          uPointLightIntensities: lightIntensities,
          uPointLightRadii: lightRadii,
          uShadowsEnabled: shadowConfig.enabled,
          uShadowStrength: shadowConfig.strength,
          uShadowMap: gBufferAlbedoRef.current // Use albedo as shadow map for now
        }
      );
      
      const fullscreenQuad = new PIXI.Mesh(geometry, lightingShader as any);
      fullscreenQuad.width = shaderParams.canvasWidth;
      fullscreenQuad.height = shaderParams.canvasHeight;
      fullscreenQuad.x = 0;
      fullscreenQuad.y = 0;
      
      lightingQuadRef.current = fullscreenQuad;
      lightingPassShaderRef.current = lightingShader;
      lightingPassContainerRef.current.addChild(fullscreenQuad);
    } else {
      // Update existing lighting shader uniforms
      const enabledLights = lightsConfig.filter(light => light.enabled && light.type === 'point');
      const lightPositions = enabledLights.map(light => [
        light.followMouse ? mousePos.x : light.position.x,
        light.followMouse ? mousePos.y : light.position.y,
        light.position.z || 10
      ]).flat();
      const lightColors = enabledLights.map(light => [light.color.r, light.color.g, light.color.b]).flat();
      const lightIntensities = enabledLights.map(light => light.intensity);
      const lightRadii = enabledLights.map(light => light.radius || 200);
      
      if (lightingPassShaderRef.current?.uniforms) {
        const shader = lightingPassShaderRef.current;
        shader.uniforms.uGBufferAlbedo = gBufferAlbedoRef.current;
        shader.uniforms.uGBufferNormal = gBufferNormalRef.current;
        shader.uniforms.uGBufferPosition = gBufferPositionRef.current;
        shader.uniforms.uAmbientLight = ambientLight.intensity;
        shader.uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
        shader.uniforms.uNumPointLights = enabledLights.length;
        shader.uniforms.uPointLightPositions = lightPositions;
        shader.uniforms.uPointLightColors = lightColors;
        shader.uniforms.uPointLightIntensities = lightIntensities;
        shader.uniforms.uPointLightRadii = lightRadii;
        shader.uniforms.uShadowsEnabled = shadowConfig.enabled;
        shader.uniforms.uShadowStrength = shadowConfig.strength;
      }
    }
    
    // Render lighting pass to accumulation buffer
    pixiApp.renderer.render(lightingPassContainerRef.current, { 
      renderTexture: lightAccumulationRef.current, 
      clear: false 
    });
    
    console.log('💡 Lighting pass completed with screen-space calculations');
  };

  /**
   * FINAL COMPOSITION: Combine G-Buffer and lighting for final output
   */
  const renderFinalComposite = () => {
    if (!pixiApp || !finalCompositeRef.current || !finalCompositeContainerRef.current) return;
    
    // Create final composite sprite
    const compositeSprite = new PIXI.Sprite(lightAccumulationRef.current || PIXI.Texture.WHITE);
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