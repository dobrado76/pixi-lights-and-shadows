import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Light, ShadowConfig } from '@/lib/lights';
import { ShaderParams } from '@/App';
import { useCustomGeometry } from '@/hooks/useCustomGeometry';
import { SceneManager, SceneSprite } from '@/components/Sprite';

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

const PixiDemo2: React.FC<PixiDemo2Props> = ({ 
  shaderParams, 
  lightsConfig, 
  ambientLight, 
  shadowConfig, 
  sceneConfig,
  onGeometryUpdate,
  onShaderUpdate,
  onMeshUpdate 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Scene management
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // Shader collections for deferred rendering
  const occluderRenderTarget = useRef<PIXI.RenderTexture | null>(null);
  const occluderContainer = useRef<PIXI.Container | null>(null);
  const pooledSprites = useRef<PIXI.Sprite[]>([]);

  // Build occluder map from all visible sprites that cast shadows
  const buildOccluderMap = (app: PIXI.Application, sceneManager: SceneManager): PIXI.RenderTexture | null => {
    if (!occluderRenderTarget.current || !occluderContainer.current) return null;
    
    const shadowCasters = sceneManager.getShadowCasters();
    
    // Ensure we have enough pooled sprites
    while (pooledSprites.current.length < shadowCasters.length) {
      pooledSprites.current.push(new PIXI.Sprite());
    }
    
    // Clear container and reset sprites
    occluderContainer.current.removeChildren();
    pooledSprites.current.forEach(sprite => {
      sprite.texture = PIXI.Texture.EMPTY;
      sprite.visible = false;
    });
    
    // Add shadow casters to occluder map
    shadowCasters.forEach((sprite, index) => {
      if (index < pooledSprites.current.length && sprite.diffuseTexture) {
        const occluderSprite = pooledSprites.current[index];
        occluderSprite.texture = sprite.diffuseTexture;
        
        const bounds = sprite.getBounds();
        occluderSprite.x = bounds.x;
        occluderSprite.y = bounds.y;
        occluderSprite.width = bounds.width;
        occluderSprite.height = bounds.height;
        occluderSprite.visible = true;
        
        occluderContainer.current!.addChild(occluderSprite);
      }
    });
    
    // Render to occluder texture
    app.renderer.render(occluderContainer.current, { 
      renderTexture: occluderRenderTarget.current, 
      clear: true 
    });
    
    return occluderRenderTarget.current;
  };
  
  // Deferred rendering G-Buffer render targets
  const gBufferAlbedoRef = useRef<PIXI.RenderTexture | null>(null);     // RGB: Albedo/Diffuse
  const gBufferNormalRef = useRef<PIXI.RenderTexture | null>(null);     // RGB: World-space normals
  const gBufferPositionRef = useRef<PIXI.RenderTexture | null>(null);   // RG: World position
  const lightAccumulationRef = useRef<PIXI.RenderTexture | null>(null); // RGB: Accumulated lighting
  const finalCompositeRef = useRef<PIXI.RenderTexture | null>(null);    // Final result

  // Containers for deferred rendering passes
  const geometryPassContainerRef = useRef<PIXI.Container | null>(null);
  const lightingPassContainerRef = useRef<PIXI.Container | null>(null);
  const finalCompositeContainerRef = useRef<PIXI.Container | null>(null);

  // Individual render targets for geometry and lighting passes
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
   * GEOMETRY PASS: For now, just render sprites normally to albedo buffer
   * TODO: Implement proper G-Buffer multi-render-target approach
   */
  const renderGeometryPass = () => {
    if (!pixiApp || !gBufferAlbedoRef.current || !geometryPassContainerRef.current) return;
    
    // Clear albedo buffer
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: true
    });
    
    // For now, just render sprites as regular PIXI sprites to the albedo buffer
    const sprites = sceneManagerRef.current?.getSprites() || [];
    
    // Clear and rebuild geometry container
    geometryPassContainerRef.current.removeChildren();
    
    let visibleSpriteCount = 0;
    sprites.forEach((sprite: SceneSprite, index: number) => {
      // Skip disabled sprites - this is critical for proper deferred rendering
      if (!sprite.definition.visible || !sprite.diffuseTexture) {
        console.log(`⏭️ Skipping sprite ${sprite.id}: visible=${sprite.definition.visible}, hasTexture=${!!sprite.diffuseTexture}`);
        return;
      }
      
      // Create simple PIXI sprite for geometry pass
      const pixiSprite = new PIXI.Sprite(sprite.diffuseTexture);
      const bounds = sprite.getBounds();
      
      pixiSprite.x = bounds.x;
      pixiSprite.y = bounds.y;
      pixiSprite.width = bounds.width;
      pixiSprite.height = bounds.height;
      pixiSprite.rotation = 0; // SceneSprite doesn't have rotation property yet
      
      geometryPassContainerRef.current!.addChild(pixiSprite);
      visibleSpriteCount++;
      console.log(`✅ Added sprite ${sprite.id} at (${bounds.x}, ${bounds.y}) size ${bounds.width}x${bounds.height}`);
    });
    
    console.log(`📊 Geometry pass: ${visibleSpriteCount} visible sprites added to container`);
    
    // Render sprites to albedo buffer
    pixiApp.renderer.render(geometryPassContainerRef.current, { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: false 
    });
    
    console.log('📐 Geometry pass rendered sprites to albedo buffer');
  };

  /**
   * LIGHTING PASS: Apply lighting calculations on screen-space G-Buffer data
   * This is where the deferred lighting magic happens - single pass for all lights
   */
  const renderLightingPass = async () => {
    if (!pixiApp || !gBufferAlbedoRef.current || !lightAccumulationRef.current) return;
    
    // Create full-screen quad that samples from G-Buffers and applies lighting
    const fullScreenQuad = new PIXI.Sprite(gBufferAlbedoRef.current);
    fullScreenQuad.width = shaderParams.canvasWidth;
    fullScreenQuad.height = shaderParams.canvasHeight;
    fullScreenQuad.x = 0;
    fullScreenQuad.y = 0;
    
    // Load the proper lighting-pass shader for screen-space lighting calculations
    const lightingVertexShader = `
      precision mediump float;
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;
      uniform mat3 translationMatrix;
      uniform mat3 projectionMatrix;
      varying vec2 vTextureCoord;
      void main() {
        vTextureCoord = aTextureCoord;
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
      }
    `;
    
    // Use the lighting-pass shader content directly (no fetch needed)
    const lightingFragmentShader = `
      precision mediump float;
      varying vec2 vTextureCoord;
      
      // G-Buffer inputs
      uniform sampler2D uGBufferAlbedo;
      uniform sampler2D uGBufferNormal;
      uniform sampler2D uGBufferPosition;
      
      // Scene parameters
      uniform vec2 uCanvasSize;
      uniform float uAmbientLight;
      uniform vec3 uAmbientColor;
      
      // Light arrays for screen-space lighting
      uniform int uNumPointLights;
      uniform vec3 uPointLightPositions[8];
      uniform vec3 uPointLightColors[8]; 
      uniform float uPointLightIntensities[8];
      uniform float uPointLightRadii[8];
      
      // Shadow system
      uniform bool uShadowsEnabled;
      uniform float uShadowStrength;
      uniform sampler2D uShadowMap;
      
      void main(void) {
        vec2 screenUV = vTextureCoord;
        
        // Sample G-Buffer data
        vec3 albedo = texture2D(uGBufferAlbedo, screenUV).rgb;
        
        // Skip empty pixels (background)
        if (albedo.r == 0.0 && albedo.g == 0.0 && albedo.b == 0.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
        
        // Start with reasonable ambient lighting so sprites are visible
        vec3 finalColor = albedo * (uAmbientLight * 0.8);
        
        // Add all enabled point lights with dramatic effect
        for (int i = 0; i < 8; i++) {
          if (i >= uNumPointLights) break;
          
          vec3 lightPos = uPointLightPositions[i];
          vec3 lightColor = uPointLightColors[i];
          float intensity = uPointLightIntensities[i];
          float radius = uPointLightRadii[i];
          
          // Screen-space distance calculation
          vec2 worldPos = screenUV * uCanvasSize;
          float distance = length(lightPos.xy - worldPos);
          
          if (distance < radius) {
            // Dramatic attenuation curve
            float attenuation = 1.0 - pow(distance / radius, 2.0);
            attenuation = clamp(attenuation, 0.0, 1.0);
            
            // Add dramatic lighting with boosted intensity
            finalColor += albedo * lightColor * intensity * attenuation * 2.0;
          }
        }
        
        // Ensure adequate brightness for visibility
        finalColor = finalColor * 2.0;
        finalColor = clamp(finalColor, 0.0, 2.0); // Allow brighter values
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    
    const shader = PIXI.Shader.from(lightingVertexShader, lightingFragmentShader, {
      // G-Buffer inputs
      uGBufferAlbedo: gBufferAlbedoRef.current,
      uGBufferNormal: gBufferNormalRef.current || gBufferAlbedoRef.current, // Fallback if no normal buffer
      uGBufferPosition: gBufferPositionRef.current || gBufferAlbedoRef.current, // Fallback if no position buffer
      
      // Scene parameters
      uCanvasSize: [shaderParams.canvasWidth, shaderParams.canvasHeight],
      uAmbientLight: ambientLight,
      uAmbientColor: [1.0, 1.0, 1.0], // White ambient
      
      // Lights - set up point lights from config
      uNumPointLights: Math.min(lightsConfig.filter(l => l.enabled && l.type === 'point').length, 8),
      uPointLightPositions: lightsConfig.filter(l => l.enabled && l.type === 'point').slice(0, 8).map(l => [l.position.x, l.position.y, l.position.z]).flat(),
      uPointLightColors: lightsConfig.filter(l => l.enabled && l.type === 'point').slice(0, 8).map(l => [l.color.r, l.color.g, l.color.b]).flat(),
      uPointLightIntensities: lightsConfig.filter(l => l.enabled && l.type === 'point').slice(0, 8).map(l => l.intensity),
      uPointLightRadii: lightsConfig.filter(l => l.enabled && l.type === 'point').slice(0, 8).map(l => l.radius || 100),
      
      // Shadow system
      uShadowsEnabled: shadowConfig.enabled,
      uShadowStrength: shadowConfig.strength,
      uShadowMap: gBufferAlbedoRef.current // Use albedo as shadow map for now
    });
        
        shader.uniforms.uUseOccluderMap = true; // Always use occluder map in deferred renderer
        // Create and render occluder map for ray casting shadows
        if (pixiApp && sceneManagerRef.current) {
          // Build occluder map from all visible sprites
          const occluderMap = buildOccluderMap(pixiApp, sceneManagerRef.current);
          if (occluderMap) {
            shader.uniforms.uOccluderMap = occluderMap;
          }
        }
    
    const lightingMesh = new PIXI.Mesh(geometry, shader);
    
    // Clear and render lighting to accumulation buffer
    pixiApp.renderer.render(new PIXI.Container(), { 
      renderTexture: lightAccumulationRef.current, 
      clear: true 
    });
    
    // Render lighting mesh to accumulation buffer
    pixiApp.renderer.render(lightingMesh, { 
      renderTexture: lightAccumulationRef.current, 
      clear: false 
    });
    
    console.log('💡 Lighting pass completed with screen-space calculations');
  };

  /**
   * FINAL COMPOSITION: Display the result on screen
   */
  const renderFinalComposite = () => {
    if (!pixiApp || !lightAccumulationRef.current) return;
    
    // Apply the lighting result with a simple pass-through shader
    const displaySprite = new PIXI.Sprite(lightAccumulationRef.current);
    displaySprite.width = shaderParams.canvasWidth;
    displaySprite.height = shaderParams.canvasHeight;
    displaySprite.x = 0;
    displaySprite.y = 0;
    
    pixiApp.stage.removeChildren();
    pixiApp.stage.addChild(displaySprite);
    
    console.log('🎨 Final composite - displaying lighting accumulation result');
  };

  /**
   * TRUE Deferred renderer: Geometry pass → Lighting pass
   */
  const renderDeferredPipeline = () => {
    if (!pixiApp || !sceneManagerRef.current) return;
    
    console.log('🔄 Starting TRUE deferred rendering pipeline...');
    
    const sprites = sceneManagerRef.current.getSprites();
    if (sprites.length === 0) {
      console.log('❌ No sprites found for deferred rendering');
      return;
    }
    
    // Initialize G-Buffers if needed
    if (!gBufferAlbedoRef.current) {
      initializeDeferredBuffers();
    }
    
    // Step 1: GEOMETRY PASS - Render all sprites to G-Buffers
    renderGeometryPass();
    
    // Step 2: LIGHTING PASS - Apply lighting to screen-size G-Buffer (like one giant sprite)
    renderLightingPass();
    
    // Step 3: FINAL COMPOSITE - Display the final result to screen
    renderFinalComposite();
    
    console.log(`✅ TRUE deferred rendering complete - ${sprites.length} sprites rendered to G-Buffers with screen-space lighting`);
  };

  // Initialize PIXI Application (prevent double initialization)
  useEffect(() => {
    if (!canvasRef.current || pixiApp) return; // Prevent double init

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
        });
      }

      console.log('✅ PIXI Application created successfully');
      console.log('Renderer type:', app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas');
      
      setPixiApp(app);
      canvasRef.current.appendChild(app.view as HTMLCanvasElement);
      
      onGeometryUpdate('✅ PIXI app initialized');
      
    } catch (error) {
      console.error('Error setting up deferred demo:', error);
      onGeometryUpdate('❌ PIXI app error');
      onShaderUpdate('❌ Shader error');
      onMeshUpdate('❌ Mesh error');
    }
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
        
        console.log('✅ Scene loaded, checking sprites...');
        const sprites = sceneManagerRef.current.getSprites();
        console.log(`Found ${sprites.length} sprites for deferred rendering`);
        
        if (sprites.length > 0) {
          // Start rendering pipeline after scene is loaded
          renderDeferredPipeline();
          
          onGeometryUpdate('✅ Deferred geometry loaded');
          onShaderUpdate('✅ Deferred shaders compiled');  
          onMeshUpdate('✅ Deferred meshes created');
        } else {
          console.log('❌ No sprites available for deferred rendering');
        }
        
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
    if (!pixiApp || !sceneManagerRef.current) return;
    
    // Re-render pipeline when lights change  
    renderDeferredPipeline();
  }, [lightsConfig, ambientLight, shadowConfig, shaderParams, mousePos]); // Include mousePos

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
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [pixiApp]);

  return <div ref={canvasRef} style={{ border: '2px solid #4B5563', borderRadius: '8px' }} />;
};

export default PixiDemo2;