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

// Expanded Light System - supports 8 lights (more PIXI.js compatible)
// Point Lights (0-1)
uniform bool uPoint0Enabled; uniform vec3 uPoint0Position; uniform vec3 uPoint0Color; uniform float uPoint0Intensity; uniform float uPoint0Radius;
uniform bool uPoint1Enabled; uniform vec3 uPoint1Position; uniform vec3 uPoint1Color; uniform float uPoint1Intensity; uniform float uPoint1Radius;

// Point Light Masks
uniform bool uPoint0HasMask; uniform sampler2D uPoint0Mask; uniform vec2 uPoint0MaskOffset; uniform float uPoint0MaskRotation; uniform float uPoint0MaskScale; uniform vec2 uPoint0MaskSize;
uniform bool uPoint1HasMask; uniform sampler2D uPoint1Mask; uniform vec2 uPoint1MaskOffset; uniform float uPoint1MaskRotation; uniform float uPoint1MaskScale; uniform vec2 uPoint1MaskSize;

// Directional Lights (0-1) 
uniform bool uDir0Enabled; uniform vec3 uDir0Direction; uniform vec3 uDir0Color; uniform float uDir0Intensity;
uniform bool uDir1Enabled; uniform vec3 uDir1Direction; uniform vec3 uDir1Color; uniform float uDir1Intensity;

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
      normalDot = max(dot(normal, lightDir), 0.0);
    } else {
      attenuation = 1.0 - clamp(lightDistance / uPoint0Radius, 0.0, 1.0);
      attenuation = attenuation * attenuation;
      normalDot = max(dot(normal, lightDir), 0.0);
    }
    
    float intensity = normalDot * uPoint0Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint0HasMask) {
      float maskValue = sampleMask(uPoint0Mask, worldPos.xy, uPoint0Position.xy, uPoint0MaskOffset, uPoint0MaskRotation, uPoint0MaskScale, uPoint0MaskSize);
      intensity *= maskValue; // Multiply light intensity by mask
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
      normalDot = max(dot(normal, lightDir), 0.0);
    } else {
      attenuation = 1.0 - clamp(lightDistance / uPoint1Radius, 0.0, 1.0);
      attenuation = attenuation * attenuation;
      normalDot = max(dot(normal, lightDir), 0.0);
    }
    
    float intensity = normalDot * uPoint1Intensity * attenuation;
    
    // Apply mask if present
    if (uPoint1HasMask) {
      float maskValue = sampleMask(uPoint1Mask, worldPos.xy, uPoint1Position.xy, uPoint1MaskOffset, uPoint1MaskRotation, uPoint1MaskScale, uPoint1MaskSize);
      intensity *= maskValue;
    }
    
    finalColor += diffuseColor.rgb * uPoint1Color * intensity;
  }
  
  // Directional Light 0
  if (uDir0Enabled) {
    vec3 lightDir = normalize(-uDir0Direction);
    float normalDot = max(dot(normal, lightDir), 0.0);
    float intensity = normalDot * uDir0Intensity;
    finalColor += diffuseColor.rgb * uDir0Color * intensity;
  }
  
  // Directional Light 1
  if (uDir1Enabled) {
    vec3 lightDir = normalize(-uDir1Direction);
    float normalDot = max(dot(normal, lightDir), 0.0);
    float intensity = normalDot * uDir1Intensity;
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
    
    finalColor += diffuseColor.rgb * uSpot3Color * intensity;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}