precision mediump float;
// Force refresh 2
varying vec2 vTextureCoord;
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec2 uCanvasSize;
uniform vec3 uColor;
uniform float uAmbientLight;
uniform vec3 uAmbientColor;

// Dynamic Light System - No hardcoded type limits, supports unlimited lights
uniform int uLightCount;
uniform int uLightTypes[32];        // 0=point, 1=directional, 2=spotlight
uniform vec3 uLightPositions[32];
uniform vec3 uLightDirections[32];
uniform vec3 uLightColors[32];
uniform float uLightIntensities[32];
uniform float uLightRadii[32];
uniform float uLightConeAngles[32];
uniform float uLightSoftness[32];

// Mask system - only for lights that actually have masks
uniform bool uLightHasMask[32];
uniform sampler2D uLightMasks[8];    // Separate mask textures for performance
uniform vec2 uLightMaskOffsets[32];
uniform float uLightMaskRotations[32];
uniform float uLightMaskScales[32];
uniform vec2 uLightMaskSizes[32];
uniform int uLightMaskTextureIndex[32]; // Which mask texture slot to use

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
  
  // Dynamic light processing loop - handles up to 32 lights efficiently
  for (int i = 0; i < 32; i++) {
    if (i >= uLightCount) break;
    
    vec3 lightContribution = vec3(0.0);
    
    if (uLightTypes[i] == 0) {
      // Point Light
      vec3 lightPos3D = uLightPositions[i];
      vec3 lightDir3D = lightPos3D - worldPos3D;
      float lightDistance = length(lightDir3D);
      vec3 lightDir = normalize(lightDir3D);
      
      float attenuation;
      float normalDot;
      
      if (lightPos3D.z < 0.0) {
        lightDir3D.y = -lightDir3D.y;
        lightDir = normalize(lightDir3D);
        attenuation = 1.0 - clamp(lightDistance / uLightRadii[i], 0.0, 1.0);
        attenuation = attenuation * attenuation;
        normalDot = max(dot(normal, lightDir), 0.0);
      } else {
        attenuation = 1.0 - clamp(lightDistance / uLightRadii[i], 0.0, 1.0);
        attenuation = attenuation * attenuation;
        normalDot = max(dot(normal, lightDir), 0.0);
      }
      
      float intensity = normalDot * uLightIntensities[i] * attenuation;
      
      // Apply mask if present
      if (uLightHasMask[i]) {
        int maskIndex = uLightMaskTextureIndex[i];
        if (maskIndex >= 0 && maskIndex < 8) {
          float maskValue = 0.0;
          // Use direct array access since we can't assign sampler2D to variables
          if (maskIndex == 0) maskValue = sampleMask(uLightMasks[0], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 1) maskValue = sampleMask(uLightMasks[1], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 2) maskValue = sampleMask(uLightMasks[2], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 3) maskValue = sampleMask(uLightMasks[3], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 4) maskValue = sampleMask(uLightMasks[4], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 5) maskValue = sampleMask(uLightMasks[5], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 6) maskValue = sampleMask(uLightMasks[6], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 7) maskValue = sampleMask(uLightMasks[7], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          intensity *= maskValue;
        }
      }
      
      lightContribution = diffuseColor.rgb * uLightColors[i] * intensity;
      
    } else if (uLightTypes[i] == 1) {
      // Directional Light
      vec3 lightDir = normalize(-uLightDirections[i]);
      float normalDot = max(dot(normal, lightDir), 0.0);
      float intensity = normalDot * uLightIntensities[i];
      lightContribution = diffuseColor.rgb * uLightColors[i] * intensity;
      
    } else if (uLightTypes[i] == 2) {
      // Spotlight
      vec3 spotlightLightPos3D = uLightPositions[i];
      vec3 spotlightLightDir3D = spotlightLightPos3D - worldPos3D;
      float spotlightDistance = length(spotlightLightDir3D);
      vec3 spotlightLightDir = normalize(spotlightLightDir3D);
      
      float coneAngle = dot(-spotlightLightDir, normalize(uLightDirections[i]));
      float coneAngleRad = radians(uLightConeAngles[i]);
      float innerCone = cos(coneAngleRad * 0.5);
      float outerCone = cos(coneAngleRad);
      float coneFactor = smoothstep(outerCone, innerCone, coneAngle);
      
      float spotDistanceAttenuation = 1.0 - clamp(spotlightDistance / uLightRadii[i], 0.0, 1.0);
      float spotNormalDot = max(dot(normal, spotlightLightDir), 0.0);
      
      float softness = mix(1.0, coneFactor, uLightSoftness[i]);
      float intensity = spotNormalDot * uLightIntensities[i] * spotDistanceAttenuation * softness * coneFactor;
      
      // Apply mask if present
      if (uLightHasMask[i]) {
        int maskIndex = uLightMaskTextureIndex[i];
        if (maskIndex >= 0 && maskIndex < 8) {
          float maskValue = 0.0;
          // Use direct array access since we can't assign sampler2D to variables
          if (maskIndex == 0) maskValue = sampleMask(uLightMasks[0], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 1) maskValue = sampleMask(uLightMasks[1], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 2) maskValue = sampleMask(uLightMasks[2], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 3) maskValue = sampleMask(uLightMasks[3], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 4) maskValue = sampleMask(uLightMasks[4], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 5) maskValue = sampleMask(uLightMasks[5], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 6) maskValue = sampleMask(uLightMasks[6], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          else if (maskIndex == 7) maskValue = sampleMask(uLightMasks[7], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
          intensity *= maskValue;
        }
      }
      
      lightContribution = diffuseColor.rgb * uLightColors[i] * intensity;
    }
    
    finalColor += lightContribution;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}