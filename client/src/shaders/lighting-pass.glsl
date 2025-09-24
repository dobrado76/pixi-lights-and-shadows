precision mediump float;
varying vec2 vTextureCoord;

// Deferred Lighting Pass Fragment Shader
// Performs screen-space lighting using G-Buffer data

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

// Screen-space shadow calculation
float calculateScreenSpaceShadow(vec2 worldPos, vec2 lightPos) {
  if (!uShadowsEnabled) return 1.0;
  
  vec2 rayDir = worldPos - lightPos;
  float rayLength = length(rayDir);
  
  if (rayLength < 1.0) return 1.0;
  
  rayDir = normalize(rayDir);
  
  // March through shadow map
  float samples = 32.0;
  float stepSize = rayLength / samples;
  
  for (float i = 1.0; i < samples; i += 1.0) {
    vec2 samplePos = lightPos + rayDir * (stepSize * i);
    vec2 uvPos = samplePos / uCanvasSize;
    
    if (uvPos.x < 0.0 || uvPos.x > 1.0 || uvPos.y < 0.0 || uvPos.y > 1.0) {
      continue;
    }
    
    float shadowValue = texture2D(uShadowMap, uvPos).r;
    if (shadowValue < 0.5) {
      return 1.0 - uShadowStrength;
    }
  }
  
  return 1.0;
}

// Screen-space point light calculation
vec3 calculatePointLight(int index, vec3 worldPos, vec3 normal, vec3 albedo) {
  if (index >= uNumPointLights) return vec3(0.0);
  
  vec3 lightPos = uPointLightPositions[index];
  vec3 lightColor = uPointLightColors[index];
  float intensity = uPointLightIntensities[index];
  float radius = uPointLightRadii[index];
  
  vec3 lightDir = lightPos - worldPos;
  float distance = length(lightDir);
  
  if (distance > radius) return vec3(0.0);
  
  lightDir = normalize(lightDir);
  
  // Distance attenuation
  float attenuation = 1.0 - clamp(distance / radius, 0.0, 1.0);
  attenuation = attenuation * attenuation;
  
  // Lambert diffuse
  float ndotl = max(dot(normal, lightDir), 0.0);
  
  // Shadow calculation
  float shadowFactor = calculateScreenSpaceShadow(worldPos.xy, lightPos.xy);
  
  return albedo * lightColor * intensity * ndotl * attenuation * shadowFactor;
}

void main(void) {
  vec2 screenUV = vTextureCoord;
  
  // Sample G-Buffer data
  vec3 albedo = texture2D(uGBufferAlbedo, screenUV).rgb;
  vec3 encodedNormal = texture2D(uGBufferNormal, screenUV).rgb;
  vec2 normalizedPos = texture2D(uGBufferPosition, screenUV).rg;
  
  // Decode world-space normal
  vec3 normal = normalize(encodedNormal * 2.0 - 1.0);
  
  // Decode world position
  vec3 worldPos = vec3(normalizedPos * uCanvasSize, 0.0);
  
  // Start with ambient lighting
  vec3 finalColor = albedo * uAmbientLight * uAmbientColor;
  
  // Add all point lights using screen-space calculations
  for (int i = 0; i < 8; i++) {
    if (i >= uNumPointLights) break;
    finalColor += calculatePointLight(i, worldPos, normal, albedo);
  }
  
  gl_FragColor = vec4(finalColor, 1.0);
}