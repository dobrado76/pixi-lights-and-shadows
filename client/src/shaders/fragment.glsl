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
uniform bool uShadowCaster0Enabled;
uniform bool uShadowCaster1Enabled;
uniform sampler2D uShadowCaster0Texture; // Diffuse texture for first caster
uniform sampler2D uShadowCaster1Texture; // Diffuse texture for second caster
uniform float uShadowStrength; // Global shadow strength
uniform bool uShadowsEnabled;

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

// Shadow calculation function - uses shadow mask (alpha channel or custom mask)
float calculateShadow(vec2 lightPos, vec2 pixelPos, vec4 caster, sampler2D shadowMask) {
  if (!uShadowsEnabled) return 1.0;
  
  // Extract caster bounds
  vec2 casterMin = caster.xy;
  vec2 casterMax = caster.xy + caster.zw;
  
  // Direction from light to pixel
  vec2 rayDir = pixelPos - lightPos;
  float rayLength = length(rayDir);
  
  // Avoid division by zero
  if (rayLength < 0.001) return 1.0;
  
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
  
  float tMin = max(max(tNear.x, tNear.y), 0.0);
  float tMax = min(min(tFar.x, tFar.y), rayLength);
  
  // Check if ray intersects caster bounds
  if (tMin <= tMax && tMax > 0.0) {
    // Sample shadow mask at the entry point of the ray into the caster
    vec2 entryPoint = lightPos + rayDir * tMin;
    vec2 maskUV = (entryPoint - casterMin) / (casterMax - casterMin);
    
    // Ensure UV coordinates are within bounds
    if (maskUV.x >= 0.0 && maskUV.x <= 1.0 && maskUV.y >= 0.0 && maskUV.y <= 1.0) {
      // Sample shadow mask - use alpha channel for shadow determination
      float maskValue = texture2D(shadowMask, maskUV).a;
      
      // Binary shadow mask: alpha > 0 = solid (cast shadow), alpha = 0 = transparent (no shadow)
      if (maskValue > 0.0) {
        return 1.0 - uShadowStrength; // Solid pixel found, cast shadow
      }
    }
  }
  
  return 1.0; // Not in shadow
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
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint0Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint0Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint0HasMask) {
      float maskValue = sampleMask(uPoint0Mask, worldPos.xy, uPoint0Position.xy, uPoint0MaskOffset, uPoint0MaskRotation, uPoint0MaskScale, uPoint0MaskSize);
      intensity *= maskValue; // Multiply light intensity by mask
    }
    
    // Apply shadow calculation with texture masking
    float shadowFactor = 1.0;
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
    }
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint0Color * intensity;
  }
  
  // Point Light 1
  if (uPoint1Enabled) {
    vec3 lightPos3D = uPoint1Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint1Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint1Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint1HasMask) {
      float maskValue = sampleMask(uPoint1Mask, worldPos.xy, uPoint1Position.xy, uPoint1MaskOffset, uPoint1MaskRotation, uPoint1MaskScale, uPoint1MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation with texture masking
    float shadowFactor = 1.0;
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(uPoint1Position.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(uPoint1Position.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
    }
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint1Color * intensity;
  }
  
  // Point Light 2
  if (uPoint2Enabled) {
    vec3 lightPos3D = uPoint2Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint2Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint2Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint2HasMask) {
      float maskValue = sampleMask(uPoint2Mask, worldPos.xy, uPoint2Position.xy, uPoint2MaskOffset, uPoint2MaskRotation, uPoint2MaskScale, uPoint2MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation with texture masking
    float shadowFactor = 1.0;
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
    }
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint2Color * intensity;
  }
  
  // Point Light 3
  if (uPoint3Enabled) {
    vec3 lightPos3D = uPoint3Position;
    vec3 lightDir3D = lightPos3D - worldPos3D;
    float lightDistance = length(lightDir3D);
    vec3 lightDir = normalize(lightDir3D);
    
    // Removed Y-flip branch that was causing triangular light shapes
    float attenuation = 1.0 - clamp(lightDistance / uPoint3Radius, 0.0, 1.0);
    attenuation = attenuation * attenuation;
    float normalDot = max(dot(normal, lightDir), 0.0);
    
    float intensity = normalDot * uPoint3Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint3HasMask) {
      float maskValue = sampleMask(uPoint3Mask, worldPos.xy, uPoint3Position.xy, uPoint3MaskOffset, uPoint3MaskRotation, uPoint3MaskScale, uPoint3MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation with texture masking
    float shadowFactor = 1.0;
    if (uShadowCaster0Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
    }
    if (uShadowCaster1Enabled) {
      shadowFactor *= calculateShadow(lightPos3D.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
    }
    intensity *= shadowFactor;
    
    finalColor += diffuseColor.rgb * uPoint3Color * intensity;
  }
  
  // Directional Light 0
  if (uDir0Enabled) {
    vec3 lightDir = normalize(-uDir0Direction);
    float normalDot = max(dot(normal, lightDir), 0.0);
    float intensity = normalDot * uDir0Intensity;
    
    // Directional light shadows disabled for now (user request)
    
    finalColor += diffuseColor.rgb * uDir0Color * intensity;
  }
  
  // Directional Light 1
  if (uDir1Enabled) {
    vec3 lightDir = normalize(-uDir1Direction);
    float normalDot = max(dot(normal, lightDir), 0.0);
    float intensity = normalDot * uDir1Intensity;
    
    // Directional light shadows disabled for now (user request)
    
    finalColor += diffuseColor.rgb * uDir1Color * intensity;
  }
  
  // Spotlight 0
  if (uSpot0Enabled) {
    vec3 spotlightLightPos3D = uSpot0Position;
    vec3 spotlightLightDir3D = spotlightLightPos3D - worldPos3D;
    float spotlightDistance = length(spotlightLightDir3D);
    vec3 spotlightLightDir = normalize(spotlightLightDir3D);
    
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
      float maskValue = sampleMask(uSpot0Mask, worldPos.xy, uSpot0Position.xy, uSpot0MaskOffset, uSpot0MaskRotation, uSpot0MaskScale, uSpot0MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation for spotlight
    if (uSpot0CastsShadows) {
      float shadowFactor = 1.0;
      if (uShadowCaster0Enabled) {
        shadowFactor *= calculateShadow(uSpot0Position.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
      }
      if (uShadowCaster1Enabled) {
        shadowFactor *= calculateShadow(uSpot0Position.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
      }
      intensity *= shadowFactor;
    }
    
    finalColor += diffuseColor.rgb * uSpot0Color * intensity;
  }
  
  // Spotlight 1
  if (uSpot1Enabled) {
    vec3 spotlightLightPos3D = uSpot1Position;
    vec3 spotlightLightDir3D = spotlightLightPos3D - worldPos3D;
    float spotlightDistance = length(spotlightLightDir3D);
    vec3 spotlightLightDir = normalize(spotlightLightDir3D);
    
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
      float maskValue = sampleMask(uSpot1Mask, worldPos.xy, uSpot1Position.xy, uSpot1MaskOffset, uSpot1MaskRotation, uSpot1MaskScale, uSpot1MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation for spotlight
    if (uSpot1CastsShadows) {
      float shadowFactor = 1.0;
      if (uShadowCaster0Enabled) {
        shadowFactor *= calculateShadow(uSpot1Position.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
      }
      if (uShadowCaster1Enabled) {
        shadowFactor *= calculateShadow(uSpot1Position.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
      }
      intensity *= shadowFactor;
    }
    
    finalColor += diffuseColor.rgb * uSpot1Color * intensity;
  }
  
  // Spotlight 2
  if (uSpot2Enabled) {
    vec3 spotlightLightPos3D = uSpot2Position;
    vec3 spotlightLightDir3D = spotlightLightPos3D - worldPos3D;
    float spotlightDistance = length(spotlightLightDir3D);
    vec3 spotlightLightDir = normalize(spotlightLightDir3D);
    
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
      float maskValue = sampleMask(uSpot2Mask, worldPos.xy, uSpot2Position.xy, uSpot2MaskOffset, uSpot2MaskRotation, uSpot2MaskScale, uSpot2MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation for spotlight
    if (uSpot2CastsShadows) {
      float shadowFactor = 1.0;
      if (uShadowCaster0Enabled) {
        shadowFactor *= calculateShadow(uSpot2Position.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
      }
      if (uShadowCaster1Enabled) {
        shadowFactor *= calculateShadow(uSpot2Position.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
      }
      intensity *= shadowFactor;
    }
    
    finalColor += diffuseColor.rgb * uSpot2Color * intensity;
  }
  
  // Spotlight 3
  if (uSpot3Enabled) {
    vec3 spotlightLightPos3D = uSpot3Position;
    vec3 spotlightLightDir3D = spotlightLightPos3D - worldPos3D;
    float spotlightDistance = length(spotlightLightDir3D);
    vec3 spotlightLightDir = normalize(spotlightLightDir3D);
    
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
      float maskValue = sampleMask(uSpot3Mask, worldPos.xy, uSpot3Position.xy, uSpot3MaskOffset, uSpot3MaskRotation, uSpot3MaskScale, uSpot3MaskSize);
      intensity *= maskValue;
    }
    
    // Apply shadow calculation for spotlight
    if (uSpot3CastsShadows) {
      float shadowFactor = 1.0;
      if (uShadowCaster0Enabled) {
        shadowFactor *= calculateShadow(uSpot3Position.xy, worldPos.xy, uShadowCaster0, uShadowCaster0Texture);
      }
      if (uShadowCaster1Enabled) {
        shadowFactor *= calculateShadow(uSpot3Position.xy, worldPos.xy, uShadowCaster1, uShadowCaster1Texture);
      }
      intensity *= shadowFactor;
    }
    
    finalColor += diffuseColor.rgb * uSpot3Color * intensity;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}