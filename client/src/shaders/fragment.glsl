precision mediump float;
varying vec2 vTextureCoord;
varying vec2 vWorldPos; // Actual world position from vertex shader
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
// Self-shadow avoidance for occluder map
uniform vec2 uReceiverMin; // AABB min bounds of current sprite
uniform vec2 uReceiverMax; // AABB max bounds of current sprite
uniform vec2 uCanvasSize;
uniform vec3 uColor;
uniform float uAmbientLight;
uniform vec3 uAmbientColor;
uniform float uRotation; // Sprite rotation for UV transformation

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
uniform vec4 uShadowCaster0; // x, y, width, height of first shadow caster
uniform vec4 uShadowCaster1; // x, y, width, height of second shadow caster  
uniform vec4 uShadowCaster2; // x, y, width, height of third shadow caster
uniform bool uShadowCaster0Enabled;
uniform bool uShadowCaster1Enabled;
uniform bool uShadowCaster2Enabled;
uniform sampler2D uShadowCaster0Texture; // Diffuse texture for first caster
uniform sampler2D uShadowCaster1Texture; // Diffuse texture for second caster
uniform sampler2D uShadowCaster2Texture; // Diffuse texture for third caster
uniform float uShadowStrength; // Global shadow strength
uniform bool uShadowsEnabled;
uniform float uShadowMaxLength; // Maximum shadow length to prevent extremely long shadows
// Removed shadow sharpness feature

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
            
            // Binary shadow detection - clean and artifact-free
            float shadowValue = 1.0;
            
            float normalizedDistance = shadowLength / uShadowMaxLength;
            float distanceFade = exp(-normalizedDistance * 2.0);
            
            // shadowValue now contains the soft/sharp shadow information
            float finalShadowStrength = uShadowStrength * shadowValue * distanceFade * maxLengthFade;
            
            return 1.0 - clamp(finalShadowStrength, 0.0, uShadowStrength);
          }
        }
      }
    }
  }
  
  return 1.0; // Not in shadow
}

// Directional light shadow calculation using occluder map - specialized for parallel rays
float calculateDirectionalShadowOccluderMap(vec2 lightDirection, vec2 pixelPos) {
  if (!uShadowsEnabled) return 1.0;
  
  // For directional lights, cast ray backwards from pixel position in light direction
  // This simulates parallel rays from infinite distance (sun/moon lighting)
  vec2 rayDir = normalize(lightDirection); // Ray direction same as light direction
  
  // Raycast backwards from the pixel position to find occluders
  float stepSize = 2.0; // Pixel steps along the ray
  float maxDistance = 500.0; // Reasonable maximum distance for occluder search
  
  // Use constant loop bounds for WebGL compatibility
  for (int i = 1; i < 200; i++) {
    float distance = float(i) * stepSize;
    
    // Break early if we've gone too far
    if (distance >= maxDistance) {
      break;
    }
    
    vec2 samplePos = pixelPos + rayDir * distance;
    
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
      float shadowLength = distance; // Distance from occluder to receiver (pixel)
      
      // Limit shadow by actual shadow length
      if (shadowLength > uShadowMaxLength) {
        return 1.0; // Shadow is longer than max allowed
      }
      
      // Gradual fade-out towards max shadow length to avoid hard cutoffs
      float maxLengthFade = 1.0 - smoothstep(uShadowMaxLength * 0.7, uShadowMaxLength, shadowLength);
      if (maxLengthFade <= 0.0) return 1.0; // Completely faded out
      
      // Binary shadow detection - clean and artifact-free
      float shadowValue = 1.0;
      
      // Calculate final shadow strength with distance-based softness
      float normalizedDistance = shadowLength / uShadowMaxLength;
      float distanceFade = exp(-normalizedDistance * 2.0);
      
      float finalShadowStrength = uShadowStrength * shadowValue * distanceFade * maxLengthFade;
      
      return 1.0 - clamp(finalShadowStrength, 0.0, uShadowStrength);
    }
  }
  
  return 1.0; // Not in shadow
}

// Occluder map shadow calculation - with proper self-shadow avoidance
float calculateShadowOccluderMap(vec2 lightPos, vec2 pixelPos) {
  if (!uShadowsEnabled) return 1.0;
  
  vec2 rayDir = pixelPos - lightPos;
  float rayLength = length(rayDir);
  
  if (rayLength < 0.001) return 1.0; // Same position as light
  
  rayDir /= rayLength; // Normalize
  
  // Calculate self-interval: where ray intersects current sprite's AABB
  vec2 invDir = vec2(
    abs(rayDir.x) > 0.0001 ? 1.0 / rayDir.x : 1000000.0,
    abs(rayDir.y) > 0.0001 ? 1.0 / rayDir.y : 1000000.0
  );
  
  vec2 t1 = (uReceiverMin - lightPos) * invDir;
  vec2 t2 = (uReceiverMax - lightPos) * invDir;
  
  vec2 tNear = min(t1, t2);
  vec2 tFar = max(t1, t2);
  
  float tEnterSelf = max(max(tNear.x, tNear.y), 0.0);
  float tExitSelf = min(min(tFar.x, tFar.y), rayLength);
  
  // Check if light is inside receiver sprite bounds
  bool lightInsideReceiver = (lightPos.x >= uReceiverMin.x && lightPos.x <= uReceiverMax.x && 
                             lightPos.y >= uReceiverMin.y && lightPos.y <= uReceiverMax.y);
  
  // SMART FIX: Only increase start distance for reasonably-sized sprites, not huge backgrounds
  // This preserves shadow casting while fixing self-shadow issues
  float startDistance = 1.0; // Normal start distance for shadows
  
  // Calculate sprite size to avoid applying fix to background sprites
  vec2 spriteSize = uReceiverMax - uReceiverMin;
  float spriteArea = spriteSize.x * spriteSize.y;
  bool isBackgroundSprite = spriteArea > 400000.0; // Background is ~480,000 pixels
  
  if (lightInsideReceiver && !isBackgroundSprite) {
    // Light is inside this regular-sized sprite - start ray marching from outside the sprite
    startDistance = max(tExitSelf + 2.0, 2.0);
  }
  
  // Ray marching with self-shadow avoidance
  float stepSize = 1.0; // Sample every pixel
  float eps = 1.5; // Small epsilon for edge cases
  
  for (int i = 1; i < 500; i++) {
    float distance = startDistance + float(i - 1) * stepSize;
    
    // Stop when we reach the pixel
    if (distance >= rayLength - eps) break;
    
    // Skip samples within self-interval (avoid self-occlusion) - but NOT for background sprites
    if (!isBackgroundSprite && distance > tEnterSelf - eps && distance < tExitSelf + eps) {
      continue;
    }
    
    vec2 samplePos = lightPos + rayDir * distance;
    vec2 occluderUV = samplePos / uCanvasSize;
    
    // Skip out of bounds samples
    if (occluderUV.x < 0.0 || occluderUV.x > 1.0 || occluderUV.y < 0.0 || occluderUV.y > 1.0) {
      continue;
    }
    
    // Sample occluder map - if we hit an occluder, we're in shadow
    float occluderAlpha = texture2D(uOccluderMap, occluderUV).a;
    if (occluderAlpha > 0.5) {
      return 0.0; // BINARY SHADOW: In shadow
    }
  }
  
  return 1.0; // Not in shadow
}

// Directional light shadow calculation - uses parallel rays for consistent shadows
float calculateDirectionalShadow(vec4 caster, vec2 pixelPos, vec2 lightDirection) {
  if (!uShadowsEnabled) return 1.0;
  
  // Simple directional shadow: check if pixel is "behind" the caster relative to light direction
  vec2 casterPos = caster.xy;
  vec2 casterSize = caster.zw;
  vec2 casterCenter = casterPos + casterSize * 0.5;
  
  // Normalize light direction for consistent calculations
  vec2 lightDir2D = normalize(lightDirection.xy);
  
  // Check if pixel is in the shadow area cast by this caster
  // For directional lights, shadows extend infinitely in the light direction
  vec2 toPixel = pixelPos - casterCenter;
  
  // Project pixel position onto light direction
  float projectionOnLight = dot(toPixel, lightDir2D);
  
  // If pixel is "behind" the caster (in shadow direction), check if it's within shadow bounds
  if (projectionOnLight > 0.0) {
    // Get perpendicular distance from shadow ray
    vec2 perpDir = vec2(-lightDir2D.y, lightDir2D.x);
    float perpDistance = abs(dot(toPixel, perpDir));
    
    // Shadow width is based on caster size
    float shadowWidth = max(casterSize.x, casterSize.y) * 0.5;
    
    // If within shadow cone, pixel is in shadow
    if (perpDistance <= shadowWidth) {
      return uShadowStrength; // In shadow
    }
  }
  
  return 1.0; // Not in shadow
}

// Unified directional light shadow calculation with auto-switching
float calculateDirectionalShadowUnified(vec2 lightDirection, vec2 pixelPos) {
  if (!uShadowsEnabled) return 1.0;
  
  if (uUseOccluderMap) {
    // Use unlimited occluder map approach for directional lights
    return calculateDirectionalShadowOccluderMap(lightDirection, pixelPos);
  } else {
    // Use fast per-caster uniform approach (≤3 casters) with virtual light position
    float infiniteDistance = 10000.0; // Very large distance
    vec2 virtualLightPos = pixelPos - lightDirection * infiniteDistance;
    
    float shadowFactor = 1.0;
    
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(virtualLightPos, pixelPos, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(virtualLightPos, pixelPos, uShadowCaster1, uShadowCaster1Texture);
    }
    if (uShadowCaster2Enabled) {
      shadowFactor *= calculateShadow(virtualLightPos, pixelPos, uShadowCaster2, uShadowCaster2Texture);
    }
    
    return shadowFactor;
  }
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

// UV rotation function - rotates UV coordinates around center (0.5, 0.5)
vec2 rotateUV(vec2 uv, float rotation) {
  // Translate to center
  vec2 centered = uv - 0.5;
  
  // Apply rotation matrix
  float cosRot = cos(rotation);
  float sinRot = sin(rotation);
  vec2 rotated = vec2(
    centered.x * cosRot - centered.y * sinRot,
    centered.x * sinRot + centered.y * cosRot
  );
  
  // Translate back
  return rotated + 0.5;
}

void main(void) {
  // Apply rotation to UV coordinates BEFORE texture sampling (physically correct)
  vec2 uv = rotateUV(vTextureCoord, uRotation);
  
  // Sample textures with rotated UV coordinates (rotation affects lighting calculation)
  vec4 diffuseColor = texture2D(uDiffuse, uv);
  vec3 normal = texture2D(uNormal, uv).rgb * 2.0 - 1.0;
  
  // Use actual world position from vertex shader (includes container transforms)
  vec2 worldPos = vWorldPos;
  vec3 worldPos3D = vec3(worldPos.x, worldPos.y, 0.0);
  
  // Debug: Log world position for first point light (if enabled)
  #ifdef DEBUG_POSITIONS
  if (gl_FragCoord.x < 50.0 && gl_FragCoord.y < 50.0) {
    // This would need console output, but WebGL doesn't support it directly
  }
  #endif
  
  // Multi-pass rendering: handle base vs lighting passes
  vec3 finalColor;
  
  // Calculate global shadow factor - available to all lighting calculations
  float globalShadowFactor = 1.0;
  
  if (uPassMode == 0) {
    // Base pass: ambient lighting only
    finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
    
    // Skip all dynamic lights in base pass
    gl_FragColor = vec4(finalColor * uColor, diffuseColor.a);
    return;
  } else {
    
    // Start with ambient light only (no global shadow system)
    finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
  }
  
  // Point Light 0
  if (uPoint0Enabled) {
    vec3 lightPos3D = uPoint0Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    lightDir3D.y = -lightDir3D.y; // Y-flip for coordinate system consistency
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    
    // Restore quadratic attenuation
    float attenuation = 1.0 - clamp(lightDistance / uPoint0Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    
    // FIX: Handle severely corrupted normals only (preserve legitimate normal maps)
    vec3 safeNormal = normal;
    
    // Only replace SEVERELY corrupted normals (much more lenient)
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0); // Flat surface normal
    }
    
    float normalDot = max(dot(safeNormal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint0Intensity * attenuation;
    
    // Calculate shadow for THIS light - temporarily remove intensity check
    float shadowFactor = 1.0;
    if (uPoint0CastsShadows) {
      shadowFactor = calculateShadowUnified(uPoint0Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint0HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint0Mask, worldPos.xy, uPoint0Position.xy, uPoint0MaskOffset, uPoint0MaskRotation, uPoint0MaskScale, uPoint0MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint0Color * intensity;
  }
  
  // Point Light 1
  if (uPoint1Enabled) {
    vec3 lightPos3D = uPoint1Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    lightDir3D.y = -lightDir3D.y; // Y-flip for coordinate system consistency
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint1Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint1Intensity * attenuation;
    
    // Calculate shadow for THIS light - temporarily remove intensity check
    float shadowFactor = 1.0;
    if (uPoint1CastsShadows) {
      shadowFactor = calculateShadowUnified(uPoint1Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint1HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint1Mask, worldPos.xy, uPoint1Position.xy, uPoint1MaskOffset, uPoint1MaskRotation, uPoint1MaskScale, uPoint1MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint1Color * intensity;
  }
  
  // Point Light 2
  if (uPoint2Enabled) {
    vec3 lightPos3D = uPoint2Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    lightDir3D.y = -lightDir3D.y; // Y-flip for coordinate system consistency
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint2Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint2Intensity * attenuation;
    
    // Calculate shadow ONLY if this light reaches this pixel (has intensity > 0)
    float shadowFactor = 1.0;
    if (uPoint2CastsShadows && intensity > 0.0) {
      shadowFactor = calculateShadowUnified(uPoint2Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint2HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint2Mask, worldPos.xy, uPoint2Position.xy, uPoint2MaskOffset, uPoint2MaskRotation, uPoint2MaskScale, uPoint2MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint2Color * intensity;
  }
  
  // Point Light 3
  if (uPoint3Enabled) {
    vec3 lightPos3D = uPoint3Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    lightDir3D.y = -lightDir3D.y; // Y-flip for coordinate system consistency
    
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint3Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint3Intensity * attenuation;
    
    // Calculate shadow ONLY if this light reaches this pixel (has intensity > 0)
    float shadowFactor = 1.0;
    if (uPoint3CastsShadows && intensity > 0.0) {
      shadowFactor = calculateShadowUnified(uPoint3Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uPoint3HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uPoint3Mask, worldPos.xy, uPoint3Position.xy, uPoint3MaskOffset, uPoint3MaskRotation, uPoint3MaskScale, uPoint3MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint3Color * intensity;
  }
  
  // Directional Light 0
  if (uDir0Enabled) {
    // Directional lights: parallel rays from infinite distance with normal mapping
    vec3 lightDir = normalize(vec3(uDir0Direction.x, -uDir0Direction.y, -uDir0Direction.z)); // Fix X-axis direction
    
    // Normal mapping with safe validation
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0); // Flat surface normal
    }
    
    float normalDot = max(dot(safeNormal, lightDir), 0.0);
    float intensity = normalDot * uDir0Intensity;
    
    // Calculate shadow for directional light (infinite range, always calculate shadows)
    float shadowFactor = 1.0;
    if (uDir0CastsShadows) {
      shadowFactor = calculateDirectionalShadowUnified(uDir0Direction.xy, worldPos.xy);
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uDir0Color * intensity;
  }
  
  // Directional Light 1
  if (uDir1Enabled) {
    // Directional lights: parallel rays from infinite distance with normal mapping
    vec3 lightDir = normalize(vec3(uDir1Direction.x, -uDir1Direction.y, -uDir1Direction.z)); // Fix X-axis direction
    
    // Normal mapping with safe validation
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0); // Flat surface normal
    }
    
    float normalDot = max(dot(safeNormal, lightDir), 0.0);
    float intensity = normalDot * uDir1Intensity;
    
    // Calculate shadow for directional light (infinite range, always calculate shadows)
    float shadowFactor = 1.0;
    if (uDir1CastsShadows) {
      shadowFactor = calculateDirectionalShadowUnified(uDir1Direction.xy, worldPos.xy);
    }
    
    // Apply THIS light's shadow
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
    
    // Lambert lighting with safe normal validation  
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0);
    }
    float lambert = max(dot(safeNormal, L), 0.0);
    float intensity = lambert * uSpot0Intensity * atten * spotFactor;
    
    // Calculate shadow for THIS light - temporarily remove intensity check
    float shadowFactor = 1.0;
    if (uSpot0CastsShadows) {
      shadowFactor = calculateShadowUnified(uSpot0Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot0HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot0Mask, worldPos.xy, uSpot0Position.xy, uSpot0MaskOffset, uSpot0MaskRotation, uSpot0MaskScale, uSpot0MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
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
    
    // Lambert lighting with safe normal validation  
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0);
    }
    float lambert = max(dot(safeNormal, L), 0.0);
    float intensity = lambert * uSpot1Intensity * atten * spotFactor;
    
    // Calculate shadow ONLY if this light reaches this pixel (has intensity > 0)
    float shadowFactor = 1.0;
    if (uSpot1CastsShadows && intensity > 0.0) {
      shadowFactor = calculateShadowUnified(uSpot1Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot1HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot1Mask, worldPos.xy, uSpot1Position.xy, uSpot1MaskOffset, uSpot1MaskRotation, uSpot1MaskScale, uSpot1MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
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
    
    // Lambert lighting with safe normal validation  
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0);
    }
    float lambert = max(dot(safeNormal, L), 0.0);
    float intensity = lambert * uSpot2Intensity * atten * spotFactor;
    
    // Calculate shadow ONLY if this light reaches this pixel (has intensity > 0)
    float shadowFactor = 1.0;
    if (uSpot2CastsShadows && intensity > 0.0) {
      shadowFactor = calculateShadowUnified(uSpot2Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot2HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot2Mask, worldPos.xy, uSpot2Position.xy, uSpot2MaskOffset, uSpot2MaskRotation, uSpot2MaskScale, uSpot2MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
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
    
    // Lambert lighting with safe normal validation  
    vec3 safeNormal = normal;
    if (length(safeNormal) < 0.3 || length(safeNormal) > 2.0) {
      safeNormal = vec3(0.0, 0.0, 1.0);
    }
    float lambert = max(dot(safeNormal, L), 0.0);
    float intensity = lambert * uSpot3Intensity * atten * spotFactor;
    
    // Calculate shadow ONLY if this light reaches this pixel (has intensity > 0)
    float shadowFactor = 1.0;
    if (uSpot3CastsShadows && intensity > 0.0) {
      shadowFactor = calculateShadowUnified(uSpot3Position.xy, worldPos.xy);
    }
    
    // Apply mask ONLY in fully lit areas (shadowFactor == 1.0)
    if (uSpot3HasMask && shadowFactor >= 0.99) {
      float maskValue = sampleMask(uSpot3Mask, worldPos.xy, uSpot3Position.xy, uSpot3MaskOffset, uSpot3MaskRotation, uSpot3MaskScale, uSpot3MaskSize);
      intensity *= maskValue; // Apply mask only where there's no shadow
    }
    
    // Apply THIS light's shadow
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uSpot3Color * intensity;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}