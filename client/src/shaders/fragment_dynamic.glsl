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

// Dynamic Light System - unlimited lights using arrays
#define MAX_LIGHTS 64

// Light types: 0=point, 1=directional, 2=spotlight
uniform int uLightCount;
uniform int uLightTypes[MAX_LIGHTS];
uniform bool uLightEnabled[MAX_LIGHTS];
uniform vec3 uLightPositions[MAX_LIGHTS];
uniform vec3 uLightDirections[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightIntensities[MAX_LIGHTS];
uniform float uLightRadii[MAX_LIGHTS];
uniform float uLightConeAngles[MAX_LIGHTS];
uniform float uLightSoftness[MAX_LIGHTS];

// Mask system
uniform bool uLightHasMask[MAX_LIGHTS];
uniform sampler2D uLightMasks[MAX_LIGHTS];
uniform vec2 uLightMaskOffsets[MAX_LIGHTS];
uniform float uLightMaskRotations[MAX_LIGHTS];
uniform float uLightMaskScales[MAX_LIGHTS];
uniform vec2 uLightMaskSizes[MAX_LIGHTS];

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
  
  // Dynamic light processing loop
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    if (!uLightEnabled[i]) continue;
    
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
        float maskValue = sampleMask(uLightMasks[i], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
        intensity *= maskValue;
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
        float maskValue = sampleMask(uLightMasks[i], worldPos.xy, uLightPositions[i].xy, uLightMaskOffsets[i], uLightMaskRotations[i], uLightMaskScales[i], uLightMaskSizes[i]);
        intensity *= maskValue;
      }
      
      lightContribution = diffuseColor.rgb * uLightColors[i] * intensity;
    }
    
    finalColor += lightContribution;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}