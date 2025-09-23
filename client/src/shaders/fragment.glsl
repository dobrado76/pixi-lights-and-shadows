precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec2 uCanvasSize;
uniform vec3 uColor;
uniform float uAmbientLight;
uniform vec3 uAmbientColor;

// Multi-pass rendering control
uniform int uPassMode; // 0 = base pass (ambient only), 1 = lighting pass (incremental)

// Expanded Light System - supports 8 lights (more PIXI.js compatible)
// Point Lights (0-3)
uniform bool uPoint0Enabled; uniform vec3 uPoint0Position; uniform vec3 uPoint0Color; uniform float uPoint0Intensity; uniform float uPoint0Radius;
uniform bool uPoint1Enabled; uniform vec3 uPoint1Position; uniform vec3 uPoint1Color; uniform float uPoint1Intensity; uniform float uPoint1Radius;
uniform bool uPoint2Enabled; uniform vec3 uPoint2Position; uniform vec3 uPoint2Color; uniform float uPoint2Intensity; uniform float uPoint2Radius;
uniform bool uPoint3Enabled; uniform vec3 uPoint3Position; uniform vec3 uPoint3Color; uniform float uPoint3Intensity; uniform float uPoint3Radius;

// Point Light Masks
uniform bool uPoint0HasMask; uniform sampler2D uPoint0Mask; uniform vec2 uPoint0MaskOffset; uniform float uPoint0MaskRotation; uniform float uPoint0MaskScale; uniform vec2 uPoint0MaskSize;
uniform bool uPoint1HasMask; uniform sampler2D uPoint1Mask; uniform vec2 uPoint1MaskOffset; uniform float uPoint1MaskRotation; uniform float uPoint1MaskScale; uniform vec2 uPoint1MaskSize;
uniform bool uPoint2HasMask; uniform sampler2D uPoint2Mask; uniform vec2 uPoint2MaskOffset; uniform float uPoint2MaskRotation; uniform float uPoint2MaskScale; uniform vec2 uPoint2MaskSize;
uniform bool uPoint3HasMask; uniform sampler2D uPoint3Mask; uniform vec2 uPoint3MaskOffset; uniform float uPoint3MaskRotation; uniform float uPoint3MaskScale; uniform vec2 uPoint3MaskSize;

// Point Light Shadow Casting Flags
uniform bool uPoint0CastsShadows; uniform bool uPoint1CastsShadows; uniform bool uPoint2CastsShadows; uniform bool uPoint3CastsShadows;

// Directional Lights (0-1) 
uniform bool uDir0Enabled; uniform vec3 uDir0Direction; uniform vec3 uDir0Color; uniform float uDir0Intensity;
uniform bool uDir1Enabled; uniform vec3 uDir1Direction; uniform vec3 uDir1Color; uniform float uDir1Intensity;

// Directional Light Shadow Casting Flags
uniform bool uDir0CastsShadows; uniform bool uDir1CastsShadows;

// Spotlights (0-3)
uniform bool uSpot0Enabled; uniform vec3 uSpot0Position; uniform vec3 uSpot0Direction; uniform vec3 uSpot0Color; uniform float uSpot0Intensity; uniform float uSpot0Radius; uniform float uSpot0ConeAngle; uniform float uSpot0Softness;
uniform bool uSpot1Enabled; uniform vec3 uSpot1Position; uniform vec3 uSpot1Direction; uniform vec3 uSpot1Color; uniform float uSpot1Intensity; uniform float uSpot1Radius; uniform float uSpot1ConeAngle; uniform float uSpot1Softness;
uniform bool uSpot2Enabled; uniform vec3 uSpot2Position; uniform vec3 uSpot2Direction; uniform vec3 uSpot2Color; uniform float uSpot2Intensity; uniform float uSpot2Radius; uniform float uSpot2ConeAngle; uniform float uSpot2Softness;
uniform bool uSpot3Enabled; uniform vec3 uSpot3Position; uniform vec3 uSpot3Direction; uniform vec3 uSpot3Color; uniform float uSpot3Intensity; uniform float uSpot3Radius; uniform float uSpot3ConeAngle; uniform float uSpot3Softness;

// Spotlight Masks
uniform bool uSpot0HasMask; uniform sampler2D uSpot0Mask; uniform vec2 uSpot0MaskOffset; uniform float uSpot0MaskRotation; uniform float uSpot0MaskScale; uniform vec2 uSpot0MaskSize;
uniform bool uSpot1HasMask; uniform sampler2D uSpot1Mask; uniform vec2 uSpot1MaskOffset; uniform float uSpot1MaskRotation; uniform float uSpot1MaskScale; uniform vec2 uSpot1MaskSize;
uniform bool uSpot2HasMask; uniform sampler2D uSpot2Mask; uniform vec2 uSpot2MaskOffset; uniform float uSpot2MaskRotation; uniform float uSpot2MaskScale; uniform vec2 uSpot2MaskSize;
uniform bool uSpot3HasMask; uniform sampler2D uSpot3Mask; uniform vec2 uSpot3MaskOffset; uniform float uSpot3MaskRotation; uniform float uSpot3MaskScale; uniform vec2 uSpot3MaskSize;

// Spotlight Shadow Casting Flags
uniform bool uSpot0CastsShadows; uniform bool uSpot1CastsShadows; uniform bool uSpot2CastsShadows; uniform bool uSpot3CastsShadows;

// Shadow Caster Uniforms - integrated shadow calculation
uniform vec4 uShadowCaster0; // x, y, width, height of first shadow caster (ball)
uniform vec4 uShadowCaster1; // x, y, width, height of second shadow caster (block)
uniform vec4 uShadowCaster2; // x, y, width, height of third shadow caster (block2)
uniform bool uShadowCaster0Enabled;
uniform bool uShadowCaster1Enabled;
uniform bool uShadowCaster2Enabled;
uniform sampler2D uShadowCaster0Texture; // Diffuse texture for first caster
uniform sampler2D uShadowCaster1Texture; // Diffuse texture for second caster
uniform sampler2D uShadowCaster2Texture; // Diffuse texture for third caster
uniform float uShadowStrength; // Global shadow strength
uniform bool uShadowsEnabled;
uniform float uShadowMaxLength; // Maximum shadow length to prevent extremely long shadows
uniform float uShadowSharpness; // Shadow sharpness (0=soft, 1=sharp)

// Occluder Map System (for unlimited shadow casters)
uniform bool uUseOccluderMap; // Switch between per-caster and occluder map
uniform sampler2D uOccluderMap; // Binary alpha map of all shadow casters

// Function to sample mask with transforms
float sampleMask(sampler2D maskTexture, vec2 worldPos, vec2 lightPos, vec2 offset, float rotation, float scale, vec2 maskSize) {
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
  
  // Apply scale and convert to UV coordinates - MASK-SIZE-BASED
  // Scale 1.0 = mask displays at its actual pixel size
  vec2 maskUV = (rotatedPos / (scale * maskSize)) + 0.5;
  
  // Sample mask (clamp to avoid edge artifacts)
  if (maskUV.x < 0.0 || maskUV.x > 1.0 || maskUV.y < 0.0 || maskUV.y > 1.0) {
    return 0.0; // Outside mask bounds
  }
  
  return texture2D(maskTexture, maskUV).r; // Use red channel as mask
}

// Shadow calculation function - uses shadow mask with self-occlusion avoidance
float calculateShadow(vec2 lightPos, vec2 pixelPos, vec4 caster, sampler2D shadowMask) {
  if (!uShadowsEnabled) return 1.0;
  
  // Extract caster bounds
  vec2 casterMin = caster.xy;
  vec2 casterMax = caster.xy + caster.zw;
  
  // Skip self-occlusion: check if current pixel is inside this caster
  vec2 pixelUV = (pixelPos - casterMin) / (casterMax - casterMin);
  if (pixelUV.x >= 0.0 && pixelUV.x <= 1.0 && pixelUV.y >= 0.0 && pixelUV.y <= 1.0) {
    float pixelAlpha = texture2D(shadowMask, pixelUV).a;
    if (pixelAlpha > 0.0) {
      return 1.0; // Don't shadow pixels that are part of this caster
    }
  }
  
  // Direction from light to pixel
  vec2 rayDir = pixelPos - lightPos;
  float rayLength = length(rayDir);
  
  // Avoid division by zero
  if (rayLength < 0.001) return 1.0;
  
  // Note: Don't limit rayLength here - we need to check actual shadow length after finding occluder
  
  rayDir /= rayLength; // Normalize
  
  // Check intersection using slab method
  vec2 invDir = vec2(
    abs(rayDir.x) > 0.0001 ? 1.0 / rayDir.x : 1000000.0,
    abs(rayDir.y) > 0.0001 ? 1.0 / rayDir.y : 1000000.0
  );
  
  vec2 t1 = (casterMin - lightPos) * invDir;
  vec2 t2 = (casterMax - lightPos) * invDir;
  
  vec2 tNear = min(t1, t2);
  vec2 tFar = max(t1, t2);
  
  float tEnter = max(max(tNear.x, tNear.y), 0.0);
  float tExit = min(min(tFar.x, tFar.y), rayLength);
  
  // Check if ray intersects caster bounds
  if (tEnter < tExit && tExit > 0.0) {
    // Sample multiple points along the ray segment inside the caster
    float bias = 0.01; // Small bias to avoid boundary artifacts
    float sampleStart = tEnter + bias;
    float sampleEnd = tExit - bias;
    
    if (sampleStart < sampleEnd) {
      // Take 3 samples along the segment
      float samples[3];
      samples[0] = mix(sampleStart, sampleEnd, 0.2);
      samples[1] = mix(sampleStart, sampleEnd, 0.5);
      samples[2] = mix(sampleStart, sampleEnd, 0.8);
      
      for (int i = 0; i < 3; i++) {
        vec2 samplePoint = lightPos + rayDir * samples[i];
        vec2 maskUV = (samplePoint - casterMin) / (casterMax - casterMin);
        
        // Ensure UV coordinates are within bounds
        if (maskUV.x >= 0.0 && maskUV.x <= 1.0 && maskUV.y >= 0.0 && maskUV.y <= 1.0) {
          float maskValue = texture2D(shadowMask, maskUV).a;
          
          // Binary shadow mask: alpha > 0 = solid (cast shadow)
          if (maskValue > 0.0) {
            // Distance-based soft shadows: shadows get softer further from caster
            float hitDistance = samples[i]; // Distance from light to occluder
            float shadowLength = rayLength - hitDistance; // Actual shadow length (occluder to receiver)
            
            // Limit shadow by actual shadow length, not distance from light
            if (shadowLength > uShadowMaxLength) {
              return 1.0; // Shadow is longer than max allowed
            }
            
            // Gradual fade-out towards max shadow length to avoid hard cutoffs
            float maxLengthFade = 1.0 - smoothstep(uShadowMaxLength * 0.7, uShadowMaxLength, shadowLength);
            if (maxLengthFade <= 0.0) return 1.0; // Completely faded out
            
            // Real sharpness control: use edge sampling with variable blur
            float shadowValue = 1.0; // Start with full shadow
            
            // Sharpness controls edge blur: sharp = no blur, soft = blur edges
            float blurRadius = mix(2.0, 0.0, uShadowSharpness); // 0=blur, 1=no blur
            
            if (blurRadius > 0.0) {
              // Sample around the edge to create soft falloff
              float edgeSamples = 0.0;
              float totalSamples = 0.0;
              
              for (int bx = -1; bx <= 1; bx++) {
                for (int by = -1; by <= 1; by++) {
                  vec2 blurOffset = vec2(float(bx), float(by)) * blurRadius;
                  vec2 blurSamplePoint = samplePoint + blurOffset;
                  vec2 blurMaskUV = (blurSamplePoint - casterMin) / (casterMax - casterMin);
                  
                  if (blurMaskUV.x >= 0.0 && blurMaskUV.x <= 1.0 && blurMaskUV.y >= 0.0 && blurMaskUV.y <= 1.0) {
                    float blurMaskValue = texture2D(shadowMask, blurMaskUV).a;
                    edgeSamples += (blurMaskValue > 0.0) ? 1.0 : 0.0;
                    totalSamples += 1.0;
                  }
                }
              }
              
              shadowValue = (totalSamples > 0.0) ? edgeSamples / totalSamples : 1.0;
            }
            
            float normalizedDistance = shadowLength / uShadowMaxLength;
            float distanceFade = exp(-normalizedDistance * 2.0);
            float finalShadowStrength = uShadowStrength * shadowValue * distanceFade * maxLengthFade;
            
            return 1.0 - clamp(finalShadowStrength, 0.0, uShadowStrength);
          }
        }
      }
    }
  }
  
  return 1.0; // Not in shadow
}

// Occluder map shadow calculation - raycasts through binary alpha texture
float calculateShadowOccluderMap(vec2 lightPos, vec2 pixelPos) {
  if (!uShadowsEnabled) return 1.0;
  
  vec2 rayDir = pixelPos - lightPos;
  float rayLength = length(rayDir);
  
  if (rayLength < 0.001) return 1.0;
  
  rayDir /= rayLength; // Normalize
  
  // Raycast through the occluder map with fixed iteration count
  float stepSize = 2.0; // Pixel steps along the ray
  float maxDistance = rayLength; // Don't limit by uShadowMaxLength here - limit by shadow length instead
  
  // Use constant loop bounds for WebGL compatibility
  for (int i = 1; i < 200; i++) {
    float distance = float(i) * stepSize;
    
    // Break early if we've gone past the ray length
    if (distance >= maxDistance) {
      break;
    }
    
    vec2 samplePos = lightPos + rayDir * distance;
    
    // Convert world position to UV coordinates
    vec2 occluderUV = samplePos / uCanvasSize;
    
    // Check bounds
    if (occluderUV.x < 0.0 || occluderUV.x > 1.0 || occluderUV.y < 0.0 || occluderUV.y > 1.0) {
      continue;
    }
    
    // Sample occluder map alpha
    float occluderAlpha = texture2D(uOccluderMap, occluderUV).a;
    
    // If we hit an occluder, cast shadow with distance-based softness
    if (occluderAlpha > 0.0) {
      float hitDistance = distance; // Distance from light to occluder
      float shadowLength = rayLength - hitDistance; // Actual shadow length (occluder to receiver)
      
      // Limit shadow by actual shadow length, not distance from light
      if (shadowLength > uShadowMaxLength) {
        return 1.0; // Shadow is longer than max allowed
      }
      
      // Gradual fade-out towards max shadow length to avoid hard cutoffs
      float maxLengthFade = 1.0 - smoothstep(uShadowMaxLength * 0.7, uShadowMaxLength, shadowLength);
      if (maxLengthFade <= 0.0) return 1.0; // Completely faded out
      
      // Real sharpness control: use PCF (Percentage-Closer Filtering) with variable sampling
      float shadowValue = 0.0;
      float sampleCount = 0.0;
      
      // Sharpness controls sample radius: sharp = tight sampling, soft = wide sampling
      float sampleRadius = mix(3.0, 0.5, uShadowSharpness); // 0=wide sampling, 1=tight sampling
      int numSamples = int(mix(9.0, 1.0, uShadowSharpness)); // 0=many samples, 1=few samples
      
      // Simple PCF pattern around the hit point
      for (int sx = -1; sx <= 1; sx++) {
        for (int sy = -1; sy <= 1; sy++) {
          if (int(sampleCount) >= numSamples) break;
          
          vec2 offset = vec2(float(sx), float(sy)) * sampleRadius;
          vec2 samplePos = lightPos + rayDir * distance + offset;
          vec2 sampleUV = samplePos / uCanvasSize;
          
          if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
            float sampleAlpha = texture2D(uOccluderMap, sampleUV).a;
            shadowValue += (sampleAlpha > 0.0) ? 1.0 : 0.0;
            sampleCount += 1.0;
          }
        }
      }
      
      // Calculate final shadow strength
      float shadowRatio = (sampleCount > 0.0) ? shadowValue / sampleCount : 0.0;
      float normalizedDistance = shadowLength / uShadowMaxLength;
      float distanceFade = exp(-normalizedDistance * 2.0);
      float finalShadowStrength = uShadowStrength * shadowRatio * distanceFade * maxLengthFade;
      
      return 1.0 - clamp(finalShadowStrength, 0.0, uShadowStrength);
    }
  }
  
  return 1.0; // No occlusion found
}

// Unified shadow calculation with auto-switching
float calculateShadowUnified(vec2 lightPos, vec2 pixelPos) {
  if (!uShadowsEnabled) return 1.0;
  
  if (uUseOccluderMap) {
    // Use unlimited occluder map approach
    return calculateShadowOccluderMap(lightPos, pixelPos);
  } else {
    // Use fast per-caster uniform approach (≤4 casters)
    float shadowFactor = 1.0;
    
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(lightPos, pixelPos, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(lightPos, pixelPos, uShadowCaster1, uShadowCaster1Texture);
    }
    if (uShadowCaster2Enabled) {
      shadowFactor *= calculateShadow(lightPos, pixelPos, uShadowCaster2, uShadowCaster2Texture);
    }
    
    return shadowFactor;
  }
}

void main(void) {
  vec2 uv = vTextureCoord;
  vec4 diffuseColor = texture2D(uDiffuse, uv);
  vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
  
  // Calculate world position
  vec2 worldPos = uSpritePos + uv * uSpriteSize;
  vec3 worldPos3D = vec3(worldPos.x, worldPos.y, 0.0);
  
  // Multi-pass rendering: handle base vs lighting passes
  vec3 finalColor;
  
  if (uPassMode == 0) {
    // Base pass: ambient lighting only
    finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
    
    // Skip all dynamic lights in base pass
    gl_FragColor = vec4(finalColor * uColor, diffuseColor.a);
    return;
  } else {
    // Lighting pass: start with ambient light (for single-pass) or zero (for multi-pass incremental)
    // Single-pass mode needs ambient + dynamic lights combined
    finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
  }
  
  // Point Light 0
  if (uPoint0Enabled) {
    vec3 lightPos3D = uPoint0Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    
    // Fix Y direction flip - coordinate system correction
    lightDir3D.y = -lightDir3D.y;
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint0Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint0Intensity * attenuation;
    
    // Apply shadow calculation FIRST - blocks light completely in shadowed areas
    float shadowFactor = 1.0;
    if (uPoint0CastsShadows) {
      shadowFactor *= calculateShadowUnified(lightPos3D.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint0HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint0Mask, worldPos.xy, uPoint0Position.xy, uPoint0MaskOffset, uPoint0MaskRotation, uPoint0MaskScale, uPoint0MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint0Color * intensity;
  }
  
  // Point Light 1
  if (uPoint1Enabled) {
    vec3 lightPos3D = uPoint1Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    
    // Fix Y direction flip - coordinate system correction
    lightDir3D.y = -lightDir3D.y;
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint1Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint1Intensity * attenuation;
    
    // Apply shadow calculation FIRST - blocks light completely in shadowed areas
    float shadowFactor = 1.0;
    if (uPoint1CastsShadows) {
      shadowFactor *= calculateShadowUnified(uPoint1Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint1HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint1Mask, worldPos.xy, uPoint1Position.xy, uPoint1MaskOffset, uPoint1MaskRotation, uPoint1MaskScale, uPoint1MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint1Color * intensity;
  }
  
  // Point Light 2
  if (uPoint2Enabled) {
    vec3 lightPos3D = uPoint2Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    
    // Fix Y direction flip - coordinate system correction
    lightDir3D.y = -lightDir3D.y;
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint2Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint2Intensity * attenuation;
    
    // Apply shadow calculation FIRST - blocks light completely in shadowed areas
    float shadowFactor = 1.0;
    if (uPoint2CastsShadows) {
      shadowFactor *= calculateShadowUnified(lightPos3D.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint2HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint2Mask, worldPos.xy, uPoint2Position.xy, uPoint2MaskOffset, uPoint2MaskRotation, uPoint2MaskScale, uPoint2MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint2Color * intensity;
  }
  
  // Point Light 3
  if (uPoint3Enabled) {
    vec3 lightPos3D = uPoint3Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    
    // Fix Y direction flip - coordinate system correction
    lightDir3D.y = -lightDir3D.y;
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint3Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint3Intensity * attenuation;
    
    // Apply shadow calculation FIRST - blocks light completely in shadowed areas
    float shadowFactor = 1.0;
    if (uPoint3CastsShadows) {
      shadowFactor *= calculateShadowUnified(lightPos3D.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint3HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint3Mask, worldPos.xy, uPoint3Position.xy, uPoint3MaskOffset, uPoint3MaskRotation, uPoint3MaskScale, uPoint3MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint3Color * intensity;
  }
  
  // Directional Light 0
  if (uDir0Enabled) {
    // Convert direction from UI space (+Y down) to shader space - use as incoming light direction
    vec3 dir = normalize(vec3(uDir0Direction.x, -uDir0Direction.y, uDir0Direction.z));
    vec3 L = dir; // Incoming light direction (same as direction vector)
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uDir0Intensity;
    
    // Apply shadow calculation for directional light (simulates sun/moon from infinite distance)
    float shadowFactor = 1.0;
    if (uDir0CastsShadows) {
      // Compute virtual light position as if light comes from infinite distance
      // This makes all shadow rays parallel, simulating sun/moon lighting
      float infiniteDistance = 10000.0; // Very large distance
      vec2 virtualLightPos = worldPos.xy + uDir0Direction.xy * infiniteDistance;
      shadowFactor *= calculateShadowUnified(virtualLightPos, worldPos.xy);
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uDir0Color * intensity;
  }
  
  // Directional Light 1
  if (uDir1Enabled) {
    // Convert direction from UI space (+Y down) to shader space - use as incoming light direction  
    vec3 dir = normalize(vec3(uDir1Direction.x, -uDir1Direction.y, uDir1Direction.z));
    vec3 L = dir; // Incoming light direction (same as direction vector)
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uDir1Intensity;
    
    // Apply shadow calculation for directional light (simulates sun/moon from infinite distance)
    float shadowFactor = 1.0;
    if (uDir1CastsShadows) {
      // Compute virtual light position as if light comes from infinite distance
      // This makes all shadow rays parallel, simulating sun/moon lighting
      float infiniteDistance = 10000.0; // Very large distance
      vec2 virtualLightPos = worldPos.xy + uDir1Direction.xy * infiniteDistance;
      shadowFactor *= calculateShadowUnified(virtualLightPos, worldPos.xy);
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uDir1Color * intensity;
  }
  
  // Spotlight 0
  if (uSpot0Enabled) {
    // Calculate light-to-fragment vector with Y-flip for coordinate system
    vec3 L3 = uSpot0Position - worldPos3D;
    L3.y = -L3.y;
    float dist = length(L3);
    vec3 L = normalize(L3);
    
    // Distance attenuation with quadratic falloff
    float atten = 1.0 - clamp(dist / uSpot0Radius, 0.0, 1.0);
    atten *= atten;
    
    // Convert spotlight direction from UI space (+Y down) to shader space
    vec3 S = normalize(vec3(uSpot0Direction.x, -uSpot0Direction.y, uSpot0Direction.z));
    
    // Cone calculation with softness
    float cosAng = dot(-L, S);
    float outer = cos(radians(uSpot0ConeAngle));
    float inner = cos(radians(uSpot0ConeAngle * (1.0 - uSpot0Softness)));
    float spotFactor = smoothstep(outer, inner, cosAng);
    
    // Lambert lighting
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uSpot0Intensity * atten * spotFactor;
    
    // Apply shadow calculation FIRST for spotlight
    float shadowFactor = 1.0;
    if (uSpot0CastsShadows) {
      shadowFactor *= calculateShadowUnified(uSpot0Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot0HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot0Mask, worldPos.xy, uSpot0Position.xy, uSpot0MaskOffset, uSpot0MaskRotation, uSpot0MaskScale, uSpot0MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uSpot0Color * intensity;
  }
  
  // Spotlight 1
  if (uSpot1Enabled) {
    // Calculate light-to-fragment vector with Y-flip for coordinate system
    vec3 L3 = uSpot1Position - worldPos3D;
    L3.y = -L3.y;
    float dist = length(L3);
    vec3 L = normalize(L3);
    
    // Distance attenuation with quadratic falloff
    float atten = 1.0 - clamp(dist / uSpot1Radius, 0.0, 1.0);
    atten *= atten;
    
    // Convert spotlight direction from UI space (+Y down) to shader space
    vec3 S = normalize(vec3(uSpot1Direction.x, -uSpot1Direction.y, uSpot1Direction.z));
    
    // Cone calculation with softness
    float cosAng = dot(-L, S);
    float outer = cos(radians(uSpot1ConeAngle));
    float inner = cos(radians(uSpot1ConeAngle * (1.0 - uSpot1Softness)));
    float spotFactor = smoothstep(outer, inner, cosAng);
    
    // Lambert lighting
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uSpot1Intensity * atten * spotFactor;
    
    // Apply shadow calculation FIRST for spotlight
    float shadowFactor = 1.0;
    if (uSpot1CastsShadows) {
      shadowFactor *= calculateShadowUnified(uSpot1Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot1HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot1Mask, worldPos.xy, uSpot1Position.xy, uSpot1MaskOffset, uSpot1MaskRotation, uSpot1MaskScale, uSpot1MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uSpot1Color * intensity;
  }
  
  // Spotlight 2
  if (uSpot2Enabled) {
    // Calculate light-to-fragment vector with Y-flip for coordinate system
    vec3 L3 = uSpot2Position - worldPos3D;
    L3.y = -L3.y;
    float dist = length(L3);
    vec3 L = normalize(L3);
    
    // Distance attenuation with quadratic falloff
    float atten = 1.0 - clamp(dist / uSpot2Radius, 0.0, 1.0);
    atten *= atten;
    
    // Convert spotlight direction from UI space (+Y down) to shader space
    vec3 S = normalize(vec3(uSpot2Direction.x, -uSpot2Direction.y, uSpot2Direction.z));
    
    // Cone calculation with softness
    float cosAng = dot(-L, S);
    float outer = cos(radians(uSpot2ConeAngle));
    float inner = cos(radians(uSpot2ConeAngle * (1.0 - uSpot2Softness)));
    float spotFactor = smoothstep(outer, inner, cosAng);
    
    // Lambert lighting
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uSpot2Intensity * atten * spotFactor;
    
    // Apply shadow calculation FIRST for spotlight
    float shadowFactor = 1.0;
    if (uSpot2CastsShadows) {
      shadowFactor *= calculateShadowUnified(uSpot2Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot2HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot2Mask, worldPos.xy, uSpot2Position.xy, uSpot2MaskOffset, uSpot2MaskRotation, uSpot2MaskScale, uSpot2MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uSpot2Color * intensity;
  }
  
  // Spotlight 3
  if (uSpot3Enabled) {
    // Calculate light-to-fragment vector with Y-flip for coordinate system
    vec3 L3 = uSpot3Position - worldPos3D;
    L3.y = -L3.y;
    float dist = length(L3);
    vec3 L = normalize(L3);
    
    // Distance attenuation with quadratic falloff
    float atten = 1.0 - clamp(dist / uSpot3Radius, 0.0, 1.0);
    atten *= atten;
    
    // Convert spotlight direction from UI space (+Y down) to shader space
    vec3 S = normalize(vec3(uSpot3Direction.x, -uSpot3Direction.y, uSpot3Direction.z));
    
    // Cone calculation with softness
    float cosAng = dot(-L, S);
    float outer = cos(radians(uSpot3ConeAngle));
    float inner = cos(radians(uSpot3ConeAngle * (1.0 - uSpot3Softness)));
    float spotFactor = smoothstep(outer, inner, cosAng);
    
    // Lambert lighting
    float lambert = max(dot(normal, L), 0.0);
    float intensity = lambert * uSpot3Intensity * atten * spotFactor;
    
    // Apply shadow calculation FIRST for spotlight
    float shadowFactor = 1.0;
    if (uSpot3CastsShadows) {
      shadowFactor *= calculateShadowUnified(uSpot3Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot3HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot3Mask, worldPos.xy, uSpot3Position.xy, uSpot3MaskOffset, uSpot3MaskRotation, uSpot3MaskScale, uSpot3MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uSpot3Color * intensity;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}