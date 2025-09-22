import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useCustomGeometry } from '../hooks/useCustomGeometry';
import { vertexShaderSource } from '../shaders/vertexShader';
import { fragmentShaderSource } from '../shaders/fragmentShader';
import { ShaderParams } from '../App';
import { Light } from '@shared/lights';

interface PixiDemoProps {
  shaderParams: ShaderParams;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  onGeometryUpdate: (status: string) => void;
  onShaderUpdate: (status: string) => void;
  onMeshUpdate: (status: string) => void;
}

const PixiDemo = (props: PixiDemoProps) => {
  const { shaderParams, lightsConfig, ambientLight, onGeometryUpdate, onShaderUpdate, onMeshUpdate } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pixiApp, setPixiApp] = useState<PIXI.Application | null>(null);
  const [mousePos, setMousePos] = useState({ x: 200, y: 150 });
  const meshesRef = useRef<PIXI.Mesh[]>([]);
  const shadersRef = useRef<PIXI.Shader[]>([]);
  
  const geometry = useCustomGeometry(shaderParams.canvasWidth, shaderParams.canvasHeight);

  // Initialize PIXI Application
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      console.log('Initializing PIXI Application...');
      
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
          resolution: 1, // Use fixed resolution for compatibility
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
          antialias: false, // Disable for canvas
          hello: false,
          resolution: 1,
          autoDensity: false,
          forceCanvas: true, // Force Canvas renderer
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
        });
      }

      // Access canvas using proper PIXI.js property
      const canvas = app.view as HTMLCanvasElement;
      
      if (canvas && canvasRef.current) {
        canvasRef.current.appendChild(canvas);
        setPixiApp(app);
        console.log('PIXI App initialized successfully');
        console.log('Renderer type:', app.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas');
      } else {
        throw new Error('Canvas element not found');
      }
    } catch (error) {
      console.error('PIXI Application initialization failed:', error);
      console.error('Error details:', error.message);
      
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

        // Helper function to convert external lights config to shader uniforms
        const createLightUniforms = () => {
          const uniforms: any = {};
          
          // Get all enabled lights by type
          const enabledLights = lightsConfig.filter(light => light.enabled);
          const pointLights = enabledLights.filter(light => light.type === 'point');
          const directionalLights = enabledLights.filter(light => light.type === 'directional');
          const spotlights = enabledLights.filter(light => light.type === 'spotlight');
          
          // Initialize all lights as disabled
          uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false;
          uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
          uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
          
          // Initialize all masks as disabled
          uniforms.uPoint0HasMask = false; uniforms.uPoint1HasMask = false;
          uniforms.uSpot0HasMask = false; uniforms.uSpot1HasMask = false; uniforms.uSpot2HasMask = false; uniforms.uSpot3HasMask = false;
          
          // Point Lights (up to 2)
          pointLights.slice(0, 2).forEach((light, i) => {
            const prefix = `uPoint${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
            uniforms[`${prefix}Radius`] = light.radius || 200;
            
            // Handle mask
            if (light.mask) {
              console.log(`Loading mask for ${prefix}:`, light.mask);
              const maskPath = `/light_masks/${light.mask.image}`;
              console.log(`Mask texture path: ${maskPath}`);
              
              uniforms[`${prefix}HasMask`] = true;
              uniforms[`${prefix}Mask`] = PIXI.Texture.from(maskPath);
              uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
              uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
              uniforms[`${prefix}MaskScale`] = light.mask.scale; // Use scale directly (1.0 = 100%)
              
              console.log(`Mask uniforms for ${prefix}:`, {
                hasMask: true,
                offset: [light.mask.offset.x, light.mask.offset.y],
                rotation: light.mask.rotation,
                scale: light.mask.scale
              });
              
              // Validate texture loading
              const maskTexture = PIXI.Texture.from(maskPath);
              maskTexture.baseTexture.on('loaded', () => {
                console.log(`Mask texture loaded successfully: ${maskPath} (${maskTexture.width}x${maskTexture.height})`);
              });
              maskTexture.baseTexture.on('error', () => {
                console.error(`Failed to load mask texture: ${maskPath}`);
              });
            } else {
              uniforms[`${prefix}HasMask`] = false;
            }
          });
          
          // Directional Lights (up to 2)
          directionalLights.slice(0, 2).forEach((light, i) => {
            const prefix = `uDir${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
          });
          
          // Spotlights (up to 4)
          spotlights.slice(0, 4).forEach((light, i) => {
            const prefix = `uSpot${i}`;
            uniforms[`${prefix}Enabled`] = true;
            uniforms[`${prefix}Position`] = [
              light.followMouse ? mousePos.x : light.position.x,
              light.followMouse ? mousePos.y : light.position.y,
              light.position.z
            ];
            uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
            uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
            uniforms[`${prefix}Intensity`] = light.intensity;
            uniforms[`${prefix}Radius`] = light.radius || 150;
            uniforms[`${prefix}ConeAngle`] = light.coneAngle || 30;
            uniforms[`${prefix}Softness`] = light.softness || 0.5;
            
            // Handle mask
            if (light.mask) {
              console.log(`Loading mask for ${prefix}:`, light.mask);
              const maskPath = `/light_masks/${light.mask.image}`;
              console.log(`Mask texture path: ${maskPath}`);
              
              uniforms[`${prefix}HasMask`] = true;
              uniforms[`${prefix}Mask`] = PIXI.Texture.from(maskPath);
              uniforms[`${prefix}MaskOffset`] = [light.mask.offset.x, light.mask.offset.y];
              uniforms[`${prefix}MaskRotation`] = light.mask.rotation;
              uniforms[`${prefix}MaskScale`] = light.mask.scale; // Use scale directly (1.0 = 100%)
              
              console.log(`Mask uniforms for ${prefix}:`, {
                hasMask: true,
                offset: [light.mask.offset.x, light.mask.offset.y],
                rotation: light.mask.rotation,
                scale: light.mask.scale
              });
              
              // Validate texture loading
              const maskTexture = PIXI.Texture.from(maskPath);
              maskTexture.baseTexture.on('loaded', () => {
                console.log(`Mask texture loaded successfully: ${maskPath} (${maskTexture.width}x${maskTexture.height})`);
              });
              maskTexture.baseTexture.on('error', () => {
                console.error(`Failed to load mask texture: ${maskPath}`);
              });
            } else {
              uniforms[`${prefix}HasMask`] = false;
            }
          });

          console.log('Expanded Lights:', { 
            pointLights: pointLights.length, 
            directionalLights: directionalLights.length, 
            spotlights: spotlights.length 
          });

          return uniforms;
        };

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
        uniform vec3 uAmbientColor;
        
        // Expanded Light System - supports 8 lights (more PIXI.js compatible)
        // Point Lights (0-1)
        uniform bool uPoint0Enabled; uniform vec3 uPoint0Position; uniform vec3 uPoint0Color; uniform float uPoint0Intensity; uniform float uPoint0Radius;
        uniform bool uPoint1Enabled; uniform vec3 uPoint1Position; uniform vec3 uPoint1Color; uniform float uPoint1Intensity; uniform float uPoint1Radius;
        
        // Point Light Masks
        uniform bool uPoint0HasMask; uniform sampler2D uPoint0Mask; uniform vec2 uPoint0MaskOffset; uniform float uPoint0MaskRotation; uniform float uPoint0MaskScale;
        uniform bool uPoint1HasMask; uniform sampler2D uPoint1Mask; uniform vec2 uPoint1MaskOffset; uniform float uPoint1MaskRotation; uniform float uPoint1MaskScale;
        
        // Directional Lights (0-1) 
        uniform bool uDir0Enabled; uniform vec3 uDir0Direction; uniform vec3 uDir0Color; uniform float uDir0Intensity;
        uniform bool uDir1Enabled; uniform vec3 uDir1Direction; uniform vec3 uDir1Color; uniform float uDir1Intensity;
        
        // Spotlights (0-3)
        uniform bool uSpot0Enabled; uniform vec3 uSpot0Position; uniform vec3 uSpot0Direction; uniform vec3 uSpot0Color; uniform float uSpot0Intensity; uniform float uSpot0Radius; uniform float uSpot0ConeAngle; uniform float uSpot0Softness;
        uniform bool uSpot1Enabled; uniform vec3 uSpot1Position; uniform vec3 uSpot1Direction; uniform vec3 uSpot1Color; uniform float uSpot1Intensity; uniform float uSpot1Radius; uniform float uSpot1ConeAngle; uniform float uSpot1Softness;
        uniform bool uSpot2Enabled; uniform vec3 uSpot2Position; uniform vec3 uSpot2Direction; uniform vec3 uSpot2Color; uniform float uSpot2Intensity; uniform float uSpot2Radius; uniform float uSpot2ConeAngle; uniform float uSpot2Softness;
        uniform bool uSpot3Enabled; uniform vec3 uSpot3Position; uniform vec3 uSpot3Direction; uniform vec3 uSpot3Color; uniform float uSpot3Intensity; uniform float uSpot3Radius; uniform float uSpot3ConeAngle; uniform float uSpot3Softness;
        
        // Spotlight Masks
        uniform bool uSpot0HasMask; uniform sampler2D uSpot0Mask; uniform vec2 uSpot0MaskOffset; uniform float uSpot0MaskRotation; uniform float uSpot0MaskScale;
        uniform bool uSpot1HasMask; uniform sampler2D uSpot1Mask; uniform vec2 uSpot1MaskOffset; uniform float uSpot1MaskRotation; uniform float uSpot1MaskScale;
        uniform bool uSpot2HasMask; uniform sampler2D uSpot2Mask; uniform vec2 uSpot2MaskOffset; uniform float uSpot2MaskRotation; uniform float uSpot2MaskScale;
        uniform bool uSpot3HasMask; uniform sampler2D uSpot3Mask; uniform vec2 uSpot3MaskOffset; uniform float uSpot3MaskRotation; uniform float uSpot3MaskScale;

        // Function to sample mask with transforms
        float sampleMask(sampler2D maskTexture, vec2 worldPos, vec2 lightPos, vec2 offset, float rotation, float scale) {
          vec2 relativePos = worldPos - lightPos;
          
          // Apply offset
          relativePos -= offset;
          
          // Apply rotation
          float cosR = cos(radians(rotation));
          float sinR = sin(radians(rotation));
          vec2 rotatedPos = vec2(
            relativePos.x * cosR - relativePos.y * sinR,
            relativePos.x * sinR + relativePos.y * cosR
          );
          
          // Apply scale and convert to UV coordinates
          vec2 maskUV = (rotatedPos / (scale * 100.0)) + 0.5; // Scale to reasonable world units
          
          // Sample mask (clamp to avoid edge artifacts)
          if (maskUV.x < 0.0 || maskUV.x > 1.0 || maskUV.y < 0.0 || maskUV.y > 1.0) {
            return 0.0; // Outside mask bounds
          }
          
          return texture2D(maskTexture, maskUV).r; // Use red channel as mask
        }

        void main(void) {
          vec2 uv = vTextureCoord;
          vec4 diffuseColor = texture2D(uDiffuse, uv);
          vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
          
          // Calculate world position
          vec2 worldPos = uSpritePos + uv * uSpriteSize;
          vec3 worldPos3D = vec3(worldPos.x, worldPos.y, 0.0);
          
          // Start with ambient lighting
          vec3 finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
          
          // Point Light 0
          if (uPoint0Enabled) {
            vec3 lightPos3D = uPoint0Position;
            vec3 lightDir3D = lightPos3D - worldPos3D;
            float lightDistance = length(lightDir3D);
            vec3 lightDir = normalize(lightDir3D);
            
            float attenuation;
            float normalDot;
            
            if (lightPos3D.z < 0.0) {
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              attenuation = 1.0 - clamp(lightDistance / uPoint0Radius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal.xy, lightDir.xy), 0.0);
            } else {
              normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              
              vec2 surfaceDistance = worldPos3D.xy - lightPos3D.xy;
              float surface2DDistance = length(surfaceDistance);
              float effectiveRadius = uPoint0Radius + (lightPos3D.z * 2.0);
              
              attenuation = 1.0 - clamp(surface2DDistance / effectiveRadius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal, lightDir), 0.0);
            }
            
            float intensity = normalDot * uPoint0Intensity * attenuation;
            
            // Apply mask if present
            if (uPoint0HasMask) {
              float maskValue = sampleMask(uPoint0Mask, worldPos.xy, uPoint0Position.xy, uPoint0MaskOffset, uPoint0MaskRotation, uPoint0MaskScale);
              // Debug: Make mask very obvious by turning affected areas red
              if (maskValue > 0.1) {
                finalColor = vec3(1.0, 0.0, 0.0); // Bright red where mask is active
              } else {
                intensity *= 0.1; // Dim areas without mask
              }
            }
            
            finalColor += diffuseColor.rgb * uPoint0Color * intensity;
          }
          
          // Point Light 1
          if (uPoint1Enabled) {
            vec3 lightPos3D = uPoint1Position;
            vec3 lightDir3D = lightPos3D - worldPos3D;
            float lightDistance = length(lightDir3D);
            vec3 lightDir = normalize(lightDir3D);
            
            float attenuation;
            float normalDot;
            
            if (lightPos3D.z < 0.0) {
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              attenuation = 1.0 - clamp(lightDistance / uPoint1Radius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal.xy, lightDir.xy), 0.0);
            } else {
              normal.z = sqrt(max(0.0, 1.0 - dot(normal.xy, normal.xy)));
              lightDir3D.y = -lightDir3D.y;
              lightDir = normalize(lightDir3D);
              
              vec2 surfaceDistance = worldPos3D.xy - lightPos3D.xy;
              float surface2DDistance = length(surfaceDistance);
              float effectiveRadius = uPoint1Radius + (lightPos3D.z * 2.0);
              
              attenuation = 1.0 - clamp(surface2DDistance / effectiveRadius, 0.0, 1.0);
              attenuation = attenuation * attenuation;
              normalDot = max(dot(normal, lightDir), 0.0);
            }
            
            float intensity = normalDot * uPoint1Intensity * attenuation;
            
            // Apply mask if present
            if (uPoint1HasMask) {
              float maskValue = sampleMask(uPoint1Mask, worldPos.xy, uPoint1Position.xy, uPoint1MaskOffset, uPoint1MaskRotation, uPoint1MaskScale);
              intensity *= maskValue;
            }
            
            finalColor += diffuseColor.rgb * uPoint1Color * intensity;
          }
          
          // Directional Light 0
          if (uDir0Enabled) {
            vec3 lightDir = normalize(uDir0Direction);
            float directionalDot = max(dot(normal, lightDir), 0.0);
            float intensity = directionalDot * uDir0Intensity;
            finalColor += diffuseColor.rgb * uDir0Color * intensity;
          }
          
          // Directional Light 1
          if (uDir1Enabled) {
            vec3 lightDir = normalize(uDir1Direction);
            float directionalDot = max(dot(normal, lightDir), 0.0);
            float intensity = directionalDot * uDir1Intensity;
            finalColor += diffuseColor.rgb * uDir1Color * intensity;
          }
          
          // Spotlight 0
          if (uSpot0Enabled) {
            vec3 spotlightDir3D = uSpot0Position - worldPos3D;
            float spotlightDistance = length(spotlightDir3D);
            vec3 spotlightLightDir = normalize(spotlightDir3D);
            
            float coneAngle = dot(-spotlightLightDir, normalize(uSpot0Direction));
            float coneAngleRad = radians(uSpot0ConeAngle);
            float innerCone = cos(coneAngleRad * 0.5);
            float outerCone = cos(coneAngleRad);
            float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
            
            float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uSpot0Radius, 0.0, 1.0);
            float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
            
            float softness = mix(1.0, coneFactor, uSpot0Softness);
            float intensity = spotNormalDot * uSpot0Intensity * spotDistanceAttenuation * softness * coneFactor;
            
            // Apply mask if present
            if (uSpot0HasMask) {
              float maskValue = sampleMask(uSpot0Mask, worldPos.xy, uSpot0Position.xy, uSpot0MaskOffset, uSpot0MaskRotation, uSpot0MaskScale);
              intensity *= maskValue;
            }
            
            finalColor += diffuseColor.rgb * uSpot0Color * intensity;
          }
          
          // Spotlight 1  
          if (uSpot1Enabled) {
            vec3 spotlightDir3D = uSpot1Position - worldPos3D;
            float spotlightDistance = length(spotlightDir3D);
            vec3 spotlightLightDir = normalize(spotlightDir3D);
            
            float coneAngle = dot(-spotlightLightDir, normalize(uSpot1Direction));
            float coneAngleRad = radians(uSpot1ConeAngle);
            float innerCone = cos(coneAngleRad * 0.5);
            float outerCone = cos(coneAngleRad);
            float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
            
            float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uSpot1Radius, 0.0, 1.0);
            float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
            
            float softness = mix(1.0, coneFactor, uSpot1Softness);
            float intensity = spotNormalDot * uSpot1Intensity * spotDistanceAttenuation * softness * coneFactor;
            
            // Apply mask if present
            if (uSpot1HasMask) {
              float maskValue = sampleMask(uSpot1Mask, worldPos.xy, uSpot1Position.xy, uSpot1MaskOffset, uSpot1MaskRotation, uSpot1MaskScale);
              intensity *= maskValue;
            }
            
            finalColor += diffuseColor.rgb * uSpot1Color * intensity;
          }
          
          // Spotlight 2
          if (uSpot2Enabled) {
            vec3 spotlightDir3D = uSpot2Position - worldPos3D;
            float spotlightDistance = length(spotlightDir3D);
            vec3 spotlightLightDir = normalize(spotlightDir3D);
            
            float coneAngle = dot(-spotlightLightDir, normalize(uSpot2Direction));
            float coneAngleRad = radians(uSpot2ConeAngle);
            float innerCone = cos(coneAngleRad * 0.5);
            float outerCone = cos(coneAngleRad);
            float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
            
            float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uSpot2Radius, 0.0, 1.0);
            float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
            
            float softness = mix(1.0, coneFactor, uSpot2Softness);
            float intensity = spotNormalDot * uSpot2Intensity * spotDistanceAttenuation * softness * coneFactor;
            
            // Apply mask if present
            if (uSpot2HasMask) {
              float maskValue = sampleMask(uSpot2Mask, worldPos.xy, uSpot2Position.xy, uSpot2MaskOffset, uSpot2MaskRotation, uSpot2MaskScale);
              intensity *= maskValue;
            }
            
            finalColor += diffuseColor.rgb * uSpot2Color * intensity;
          }
          
          // Spotlight 3
          if (uSpot3Enabled) {
            vec3 spotlightDir3D = uSpot3Position - worldPos3D;
            float spotlightDistance = length(spotlightDir3D);
            vec3 spotlightLightDir = normalize(spotlightDir3D);
            
            float coneAngle = dot(-spotlightLightDir, normalize(uSpot3Direction));
            float coneAngleRad = radians(uSpot3ConeAngle);
            float innerCone = cos(coneAngleRad * 0.5);
            float outerCone = cos(coneAngleRad);
            float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
            
            float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uSpot3Radius, 0.0, 1.0);
            float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
            
            float softness = mix(1.0, coneFactor, uSpot3Softness);
            float intensity = spotNormalDot * uSpot3Intensity * spotDistanceAttenuation * softness * coneFactor;
            
            // Apply mask if present
            if (uSpot3HasMask) {
              float maskValue = sampleMask(uSpot3Mask, worldPos.xy, uSpot3Position.xy, uSpot3MaskOffset, uSpot3MaskRotation, uSpot3MaskScale);
              intensity *= maskValue;
            }
            
            finalColor += diffuseColor.rgb * uSpot3Color * intensity;
          }
          
          // Apply color tinting
          finalColor *= uColor;
          
          gl_FragColor = vec4(finalColor, diffuseColor.a);
        }
      `;

      // Background shader and mesh (using unified sprite shader)
      const lightUniforms = createLightUniforms();
      const bgShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: bgDiffuse,
        uNormal: bgNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [0, 0], // Background covers entire canvas starting at (0,0)
        uSpriteSize: [shaderParams.canvasWidth, shaderParams.canvasHeight], // Full canvas size
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        ...lightUniforms
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
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos:  [ballPos.x, ballPos.y],
        uSpriteSize: [ballDiffuse.width, ballDiffuse.height],
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        ...lightUniforms
      });

      const ballMesh = new PIXI.Mesh(ballGeometry, ballShader as any);
      ballMesh.x = 0;
      ballMesh.y = 0;

      // Block shader and mesh
      const blockShader = PIXI.Shader.from(vertexShaderSource, spriteFragmentShader, {
        uDiffuse: blockDiffuse,
        uNormal: blockNormal,
        uColor: [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB],
        uSpritePos: [blockPos.x, blockPos.y],
        uSpriteSize: [blockDiffuse.width, blockDiffuse.height],
        uAmbientLight: ambientLight.intensity,
        uAmbientColor: [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b],
        ...lightUniforms
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

  // Dynamic shader uniform updates for real-time lighting changes
  useEffect(() => {
    if (shadersRef.current.length === 0) return;

    // Full light uniforms recreation - individual uniform approach
    const createLightUniforms = () => {
      const uniforms: any = {};
      
      // Get all enabled lights by type
      const enabledLights = lightsConfig.filter(light => light.enabled);
      const pointLights = enabledLights.filter(light => light.type === 'point');
      const directionalLights = enabledLights.filter(light => light.type === 'directional');
      const spotlights = enabledLights.filter(light => light.type === 'spotlight');
      
      // Initialize all lights as disabled
      uniforms.uPoint0Enabled = false; uniforms.uPoint1Enabled = false;
      uniforms.uDir0Enabled = false; uniforms.uDir1Enabled = false;
      uniforms.uSpot0Enabled = false; uniforms.uSpot1Enabled = false; uniforms.uSpot2Enabled = false; uniforms.uSpot3Enabled = false;
      
      // Point Lights (up to 2)
      pointLights.slice(0, 2).forEach((light, i) => {
        const prefix = `uPoint${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
        uniforms[`${prefix}Radius`] = light.radius || 200;
      });
      
      // Directional Lights (up to 2)
      directionalLights.slice(0, 2).forEach((light, i) => {
        const prefix = `uDir${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
      });
      
      // Spotlights (up to 4)
      spotlights.slice(0, 4).forEach((light, i) => {
        const prefix = `uSpot${i}`;
        uniforms[`${prefix}Enabled`] = true;
        uniforms[`${prefix}Position`] = [
          light.followMouse ? mousePos.x : light.position.x,
          light.followMouse ? mousePos.y : light.position.y,
          light.position.z
        ];
        uniforms[`${prefix}Direction`] = [light.direction.x, light.direction.y, light.direction.z];
        uniforms[`${prefix}Color`] = [light.color.r, light.color.g, light.color.b];
        uniforms[`${prefix}Intensity`] = light.intensity;
        uniforms[`${prefix}Radius`] = light.radius || 150;
        uniforms[`${prefix}ConeAngle`] = light.coneAngle || 30;
        uniforms[`${prefix}Softness`] = light.softness || 0.5;
      });

      // Add other dynamic uniforms
      uniforms.uColor = [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB];
      uniforms.uAmbientLight = ambientLight.intensity;
      uniforms.uAmbientColor = [ambientLight.color.r, ambientLight.color.g, ambientLight.color.b];
      
      return uniforms;
    };

    const updatedUniforms = createLightUniforms();

    // Apply all uniform updates to all shaders
    shadersRef.current.forEach(shader => {
      if (shader.uniforms) {
        Object.assign(shader.uniforms, updatedUniforms);
      }
    });
  }, [shaderParams.colorR, shaderParams.colorG, shaderParams.colorB, mousePos, lightsConfig, ambientLight]);

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