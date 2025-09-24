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
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 }); // Mouse position for followMouse lights
  
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
    
    sprites.forEach((sprite: SceneSprite, index: number) => {
      if (!sprite.diffuseTexture) return;
      
      // Create simple PIXI sprite for geometry pass
      const pixiSprite = new PIXI.Sprite(sprite.diffuseTexture);
      const bounds = sprite.getBounds();
      
      pixiSprite.x = bounds.x;
      pixiSprite.y = bounds.y;
      pixiSprite.width = bounds.width;
      pixiSprite.height = bounds.height;
      pixiSprite.rotation = 0; // SceneSprite doesn't have rotation property yet
      
      geometryPassContainerRef.current!.addChild(pixiSprite);
    });
    
    // Render sprites to albedo buffer
    pixiApp.renderer.render(geometryPassContainerRef.current, { 
      renderTexture: gBufferAlbedoRef.current, 
      clear: false 
    });
    
    console.log('📐 Geometry pass rendered sprites to albedo buffer');
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
      
      // For now, create a simple shader that just applies ambient light to the albedo
      const lightingShader = new PIXI.Shader(
        PIXI.Program.from(
          vertexShaderSource,
          `
          precision mediump float;
          varying vec2 vTextureCoord;
          uniform sampler2D uAlbedo;
          uniform vec3 uAmbientColor;
          uniform float uAmbientLight;
          
          void main(void) {
            vec3 albedo = texture2D(uAlbedo, vTextureCoord).rgb;
            vec3 ambient = albedo * uAmbientColor * uAmbientLight;
            gl_FragColor = vec4(ambient, 1.0);
          }
          `
        ),
        {
          uAlbedo: gBufferAlbedoRef.current,
          uAmbientLight: ambientLight.intensity,
          uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b]
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
   * FINAL COMPOSITION: Display the result on screen
   */
  const renderFinalComposite = () => {
    if (!pixiApp || !lightAccumulationRef.current) return;
    
    // For now, just display the lighting result directly
    const displaySprite = new PIXI.Sprite(lightAccumulationRef.current);
    displaySprite.width = shaderParams.canvasWidth;
    displaySprite.height = shaderParams.canvasHeight;
    displaySprite.x = 0;
    displaySprite.y = 0;
    
    pixiApp.stage.removeChildren();
    pixiApp.stage.addChild(displaySprite);
    
    console.log('🎨 Final composite - displaying lighting result');
  };

  /**
   * Deferred renderer with proper lighting and shadows
   */
  const renderDeferredPipeline = () => {
    if (!pixiApp || !sceneManagerRef.current) return;
    
    console.log('🔄 Starting deferred rendering pipeline...');
    
    const sprites = sceneManagerRef.current.getSprites();
    if (sprites.length === 0) {
      console.log('❌ No sprites found for deferred rendering');
      return;
    }
    
    // Clear stage and create lighting container
    pixiApp.stage.removeChildren();
    
    // Create a container for all lit sprites
    const litContainer = new PIXI.Container();
    pixiApp.stage.addChild(litContainer);
    
    let addedSprites = 0;
    sprites.forEach((sprite, index) => {
      // Only render visible sprites
      if (!sprite.definition.visible) {
        console.log(`Sprite ${index}: Skipped (not visible)`);
        return;
      }
      
      let displayObject;
      
      if (sprite.diffuseTexture) {
        // Create mesh with deferred lighting shader
        const geometry = new PIXI.PlaneGeometry(1, 1);
        
        // Prepare lighting data
        const enabledLights = lightsConfig.filter(l => l.enabled).slice(0, 4);
        const lightPositions = new Float32Array(12); // 4 lights * 3 components
        const lightColors = new Float32Array(12);    // 4 lights * 3 components  
        const lightIntensities = new Float32Array(4);
        const lightRadiuses = new Float32Array(4);   // Light radius for attenuation
        
        enabledLights.forEach((light, lightIndex) => {
          const baseIndex = lightIndex * 3;
          // Handle mouse-following lights
          lightPositions[baseIndex] = light.followMouse ? mousePos.x : light.position.x;
          lightPositions[baseIndex + 1] = light.followMouse ? mousePos.y : light.position.y;
          lightPositions[baseIndex + 2] = light.position.z;
          
          lightColors[baseIndex] = light.color.r;
          lightColors[baseIndex + 1] = light.color.g;
          lightColors[baseIndex + 2] = light.color.b;
          
          lightIntensities[lightIndex] = light.intensity;
          lightRadiuses[lightIndex] = light.radius || 200; // Default radius 200
        });
        
        const uniforms = {
          uSampler: sprite.diffuseTexture,
          uNormalMap: sprite.normalTexture || PIXI.Texture.WHITE,
          
          // Lighting uniforms
          uAmbientLight: [ambientLight.color.r * ambientLight.intensity, 
                         ambientLight.color.g * ambientLight.intensity, 
                         ambientLight.color.b * ambientLight.intensity],
          
          uLightPositions: lightPositions,
          uLightColors: lightColors,    
          uLightIntensities: lightIntensities,
          uLightRadiuses: lightRadiuses,
          uNumLights: enabledLights.length,
          
          // Material properties
          uNormalIntensity: shaderParams.normalMapIntensity,
          uSpecularPower: shaderParams.specularPower,
          uSpecularIntensity: shaderParams.specularIntensity,
          
          // Shadow settings
          uShadowStrength: shadowConfig.enabled ? shadowConfig.strength : 0.0,
        };
        
        // Deferred lighting shader
        const vertexShader = `
          attribute vec2 aVertexPosition;
          attribute vec2 aTextureCoord;
          
          uniform mat3 translationMatrix;
          uniform mat3 projectionMatrix;
          
          varying vec2 vTextureCoord;
          varying vec2 vWorldPos;
          
          void main(void) {
            vec3 position = translationMatrix * vec3(aVertexPosition, 1.0);
            gl_Position = vec4((projectionMatrix * position).xy, 0.0, 1.0);
            vTextureCoord = aTextureCoord;
            vWorldPos = position.xy;
          }
        `;
        
        const fragmentShader = `
          precision mediump float;
          
          varying vec2 vTextureCoord;
          varying vec2 vWorldPos;
          
          uniform sampler2D uSampler;
          uniform sampler2D uNormalMap;
          
          uniform vec3 uAmbientLight;
          uniform vec3 uLightPositions[4];
          uniform vec3 uLightColors[4];
          uniform float uLightIntensities[4];
          uniform float uLightRadiuses[4];
          uniform int uNumLights;
          
          uniform float uNormalIntensity;
          uniform float uSpecularPower;
          uniform float uSpecularIntensity;
          uniform float uShadowStrength;
          
          void main(void) {
            vec4 albedo = texture2D(uSampler, vTextureCoord);
            vec3 normal = normalize(texture2D(uNormalMap, vTextureCoord).rgb * 2.0 - 1.0);
            normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy))) * uNormalIntensity;
            normal = normalize(normal);
            
            vec3 finalColor = albedo.rgb * uAmbientLight;
            
            // Deferred lighting calculation for each light
            for (int i = 0; i < 4; i++) {
              if (i >= uNumLights) break;
              
              vec3 lightPos = uLightPositions[i];
              vec3 lightColor = uLightColors[i];
              float lightIntensity = uLightIntensities[i];
              float lightRadius = uLightRadiuses[i];
              
              vec3 lightDir = normalize(vec3(lightPos.xy - vWorldPos, lightPos.z));
              float distance = length(vec3(lightPos.xy - vWorldPos, lightPos.z));
              
              // Diffuse lighting
              float diffuse = max(dot(normal, lightDir), 0.0);
              
              // Distance attenuation using actual light radius
              float attenuation = 1.0 / (1.0 + distance * distance / (lightRadius * lightRadius));
              
              vec3 lightContrib = albedo.rgb * lightColor * diffuse * lightIntensity * attenuation;
              finalColor += lightContrib;
              
              // Specular highlight
              vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
              vec3 reflectDir = reflect(-lightDir, normal);
              float specular = pow(max(dot(viewDir, reflectDir), 0.0), uSpecularPower);
              finalColor += lightColor * specular * uSpecularIntensity * lightIntensity * attenuation;
              
              // Simple shadow approximation based on distance
              float shadow = 1.0 - (uShadowStrength * 0.3 * (1.0 - attenuation));
              finalColor *= shadow;
            }
            
            gl_FragColor = vec4(finalColor, albedo.a);
          }
        `;
        
        const shader = PIXI.Shader.from(vertexShader, fragmentShader, uniforms);
        displayObject = new PIXI.Mesh(geometry, shader);
        
        console.log(`Sprite ${index}: Using deferred lit mesh with ${enabledLights.length} lights`);
      } else {
        // Fallback to simple colored rectangle
        const graphics = new PIXI.Graphics();
        const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFFFFF, 0x888888, 0x444444];
        const color = colors[index % colors.length];
        
        graphics.beginFill(color);
        graphics.drawRect(0, 0, 50, 50);
        graphics.endFill();
        displayObject = graphics;
        console.log(`Sprite ${index}: Using colored rectangle fallback`);
      }
      
      const bounds = sprite.getBounds();
      displayObject.x = bounds.x;
      displayObject.y = bounds.y;
      displayObject.width = bounds.width;
      displayObject.height = bounds.height;
      
      console.log(`Sprite ${index}: pos(${bounds.x}, ${bounds.y}) size(${bounds.width}x${bounds.height}) visible(${sprite.definition.visible})`);
      
      litContainer.addChild(displayObject);
      addedSprites++;
    });
    
    console.log(`✅ Deferred rendering complete - ${addedSprites} lit sprites with ${lightsConfig.filter(l => l.enabled).length} lights`);
    
    // Force a render
    pixiApp.render();
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
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
        });
      }

      const canvas = app.view as HTMLCanvasElement;
      
      if (canvas && canvasRef.current) {
        // Clear any existing content to prevent duplicates
        canvasRef.current.innerHTML = '';
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
          console.error('No sprites loaded in scene');
          onGeometryUpdate('❌ No sprites found');
        }
        
        console.log('✅ Deferred demo setup completed');
        
      } catch (error) {
        console.error('Error setting up deferred demo:', error);
        onGeometryUpdate('❌ Geometry error');
        onShaderUpdate('❌ Shader error');
        onMeshUpdate('❌ Mesh error');
      }
    };

    setupDeferredDemo();
  }, [pixiApp, sceneConfig, lightsConfig]);

  // Mouse tracking for interactive lights
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
      return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }
  }, [pixiApp]);

  return <div ref={canvasRef} style={{ border: '2px solid #4B5563', borderRadius: '8px' }} />;
};

export default PixiDemo2;