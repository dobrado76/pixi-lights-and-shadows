precision mediump float;
varying vec2 vTextureCoord;

// DEFERRED LIGHTING FRAGMENT SHADER - fragment2.glsl
// This shader implements deferred lighting for screen-space illumination

// G-Buffer textures (inputs from geometry pass)
uniform sampler2D uGBufferAlbedo;    // RGB: Albedo/Diffuse color
uniform sampler2D uGBufferNormal;    // RGB: World-space normals  
uniform sampler2D uGBufferPosition;  // RG: World position, BA: unused

// Scene parameters
uniform vec2 uCanvasSize;
uniform float uAmbientLight;
uniform vec3 uAmbientColor;

// Deferred rendering mode
uniform int uDeferredMode; // 0 = geometry pass, 1 = lighting pass, 2 = final composite

// Traditional uniforms for fallback compatibility
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec3 uColor;
uniform float uRotation;

// Light arrays for deferred rendering (screen-space lighting)
uniform int uNumPointLights;
uniform int uNumDirectionalLights;
uniform int uNumSpotlights;

// Point lights (up to 16 for deferred rendering)
uniform vec3 uPointLightPositions[16];
uniform vec3 uPointLightColors[16];
uniform float uPointLightIntensities[16];
uniform float uPointLightRadii[16];
uniform bool uPointLightEnabled[16];

// Directional lights (up to 4)
uniform vec3 uDirectionalLightDirections[4];
uniform vec3 uDirectionalLightColors[4];
uniform float uDirectionalLightIntensities[4];
uniform bool uDirectionalLightEnabled[4];

// Spotlights (up to 8)
uniform vec3 uSpotLightPositions[8];
uniform vec3 uSpotLightDirections[8];
uniform vec3 uSpotLightColors[8];
uniform float uSpotLightIntensities[8];
uniform float uSpotLightRadii[8];
uniform float uSpotLightConeAngles[8];
uniform float uSpotLightSoftness[8];
uniform bool uSpotLightEnabled[8];

// Shadow system for deferred rendering
uniform bool uShadowsEnabled;
uniform float uShadowStrength;
uniform float uShadowMaxLength;
uniform sampler2D uShadowMap; // Unified shadow map for all casters

// Screen-space shadow calculation for deferred rendering
float calculateDeferredShadow(vec2 worldPos, vec2 lightPos) {
  if (!uShadowsEnabled) return 1.0;
  
  // Convert to screen space
  vec2 screenPos = worldPos / uCanvasSize;
  vec2 lightScreenPos = lightPos / uCanvasSize;
  
  // Simple ray-marching through shadow map
  vec2 rayDir = screenPos - lightScreenPos;
  float rayLength = length(rayDir);
  
  if (rayLength < 0.001) return 1.0;
  
  rayDir = normalize(rayDir);
  
  // March through shadow map
  float stepSize = 1.0 / 64.0; // 64 samples max
  for (float t = 0.0; t < rayLength; t += stepSize) {
    vec2 samplePos = lightScreenPos + rayDir * t;
    
    // Check bounds
    if (samplePos.x < 0.0 || samplePos.x > 1.0 || samplePos.y < 0.0 || samplePos.y > 1.0) {
      continue;
    }
    
    // Sample shadow map
    float shadowValue = texture2D(uShadowMap, samplePos).r;
    if (shadowValue < 0.5) { // Occluded
      float shadowDistance = t * uCanvasSize.x; // Convert back to world space
      if (shadowDistance > uShadowMaxLength) break;
      
      return 1.0 - uShadowStrength;
    }
  }
  
  return 1.0;
}

// Screen-space lighting calculation for point lights
vec3 calculatePointLight(int lightIndex, vec3 worldPos, vec3 normal, vec3 albedo) {
  if (!uPointLightEnabled[lightIndex]) return vec3(0.0);
  
  vec3 lightPos = uPointLightPositions[lightIndex];
  vec3 lightColor = uPointLightColors[lightIndex];
  float intensity = uPointLightIntensities[lightIndex];
  float radius = uPointLightRadii[lightIndex];
  
  vec3 lightDir = lightPos - worldPos;
  float distance = length(lightDir);
  
  if (distance > radius) return vec3(0.0);
  
  lightDir = normalize(lightDir);
  
  // Attenuation
  float attenuation = 1.0 - clamp(distance / radius, 0.0, 1.0);
  attenuation = attenuation * attenuation;
  
  // Lambert diffuse
  float ndotl = max(dot(normal, lightDir), 0.0);
  
  // Shadow calculation
  float shadowFactor = calculateDeferredShadow(worldPos.xy, lightPos.xy);
  
  return albedo * lightColor * intensity * ndotl * attenuation * shadowFactor;
}

// Screen-space lighting calculation for directional lights
vec3 calculateDirectionalLight(int lightIndex, vec3 worldPos, vec3 normal, vec3 albedo) {
  if (!uDirectionalLightEnabled[lightIndex]) return vec3(0.0);
  
  vec3 lightDir = -normalize(uDirectionalLightDirections[lightIndex]);
  vec3 lightColor = uDirectionalLightColors[lightIndex];
  float intensity = uDirectionalLightIntensities[lightIndex];
  
  // Lambert diffuse
  float ndotl = max(dot(normal, lightDir), 0.0);
  
  // For directional lights, use parallel ray shadow calculation
  // TODO: Implement proper directional shadow mapping
  float shadowFactor = 1.0;
  
  return albedo * lightColor * intensity * ndotl * shadowFactor;
}

// Screen-space lighting calculation for spotlights
vec3 calculateSpotLight(int lightIndex, vec3 worldPos, vec3 normal, vec3 albedo) {
  if (!uSpotLightEnabled[lightIndex]) return vec3(0.0);
  
  vec3 lightPos = uSpotLightPositions[lightIndex];
  vec3 spotDir = normalize(uSpotLightDirections[lightIndex]);
  vec3 lightColor = uSpotLightColors[lightIndex];
  float intensity = uSpotLightIntensities[lightIndex];
  float radius = uSpotLightRadii[lightIndex];
  float coneAngle = uSpotLightConeAngles[lightIndex];
  float softness = uSpotLightSoftness[lightIndex];
  
  vec3 lightDir = lightPos - worldPos;
  float distance = length(lightDir);
  
  if (distance > radius) return vec3(0.0);
  
  lightDir = normalize(lightDir);
  
  // Spotlight cone calculation
  float spotEffect = dot(-lightDir, spotDir);
  float coneAngleRad = radians(coneAngle);
  float spotAttenuation = smoothstep(cos(coneAngleRad), cos(coneAngleRad * (1.0 - softness)), spotEffect);
  
  if (spotAttenuation <= 0.0) return vec3(0.0);
  
  // Distance attenuation
  float distAttenuation = 1.0 - clamp(distance / radius, 0.0, 1.0);
  distAttenuation = distAttenuation * distAttenuation;
  
  // Lambert diffuse
  float ndotl = max(dot(normal, lightDir), 0.0);
  
  // Shadow calculation
  float shadowFactor = calculateDeferredShadow(worldPos.xy, lightPos.xy);
  
  return albedo * lightColor * intensity * ndotl * distAttenuation * spotAttenuation * shadowFactor;
}

// UV rotation function (for compatibility)
vec2 rotateUV(vec2 uv, float rotation) {
  vec2 centered = uv - 0.5;
  float cosRot = cos(rotation);
  float sinRot = sin(rotation);
  vec2 rotated = vec2(
    centered.x * cosRot - centered.y * sinRot,
    centered.x * sinRot + centered.y * cosRot
  );
  return rotated + 0.5;
}

void main(void) {
  vec2 uv = vTextureCoord;
  
  if (uDeferredMode == 0) {
    // GEOMETRY PASS: Output G-Buffer data
    
    // Apply rotation for compatibility
    vec2 rotatedUV = rotateUV(uv, uRotation);
    
    // Sample textures
    vec4 diffuseColor = texture2D(uDiffuse, rotatedUV);
    vec3 normal = texture2D(uNormal, rotatedUV).rgb * 2.0 - 1.0;
    
    // Calculate world position
    vec2 worldPos = uSpritePos + uv * uSpriteSize;
    
    // Output to G-Buffer (this would require MRT - Multiple Render Targets)
    // For now, just output albedo
    gl_FragColor = vec4(diffuseColor.rgb * uColor, diffuseColor.a);
    
  } else if (uDeferredMode == 1) {
    // LIGHTING PASS: Screen-space lighting using G-Buffer
    
    // Sample G-Buffer data
    vec3 albedo = texture2D(uGBufferAlbedo, uv).rgb;
    vec3 normal = normalize(texture2D(uGBufferNormal, uv).rgb * 2.0 - 1.0);
    vec2 worldPosXY = texture2D(uGBufferPosition, uv).rg;
    vec3 worldPos = vec3(worldPosXY, 0.0);
    
    // Start with ambient lighting
    vec3 finalColor = albedo * uAmbientLight * uAmbientColor;
    
    // Add all point lights
    for (int i = 0; i < 16; i++) {
      if (i >= uNumPointLights) break;
      finalColor += calculatePointLight(i, worldPos, normal, albedo);
    }
    
    // Add all directional lights
    for (int i = 0; i < 4; i++) {
      if (i >= uNumDirectionalLights) break;
      finalColor += calculateDirectionalLight(i, worldPos, normal, albedo);
    }
    
    // Add all spotlights
    for (int i = 0; i < 8; i++) {
      if (i >= uNumSpotlights) break;
      finalColor += calculateSpotLight(i, worldPos, normal, albedo);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
    
  } else {
    // FINAL COMPOSITE PASS: Just pass through the lit result
    vec3 litColor = texture2D(uGBufferAlbedo, uv).rgb; // This would be the lighting result
    gl_FragColor = vec4(litColor, 1.0);
  }
}