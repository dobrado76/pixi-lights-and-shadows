precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;

// Light uniforms (match main shader)
uniform vec3 uPointLightPositions[32];
uniform vec3 uPointLightColors[32];
uniform float uPointLightIntensities[32];
uniform float uPointLightRadii[32];
uniform int uNumPointLights;

uniform vec3 uSpotLightPositions[32];
uniform vec3 uSpotLightColors[32];
uniform float uSpotLightIntensities[32];
uniform int uNumSpotLights;

void main(void) {
  // Convert UV to world space position
  vec2 worldPos = vTextureCoord * uCanvasSize;
  
  // Accumulate light injection at this grid cell
  vec3 injectedLight = vec3(0.0);
  
  // Inject from point lights
  for (int i = 0; i < 32; i++) {
    if (i >= uNumPointLights) break;
    
    vec3 lightPos = uPointLightPositions[i];
    float dist = length(worldPos - lightPos.xy);
    
    // Only inject light near the source (within 20 pixels)
    if (dist < 20.0) {
      float falloff = 1.0 - (dist / 20.0);
      injectedLight += uPointLightColors[i] * uPointLightIntensities[i] * falloff;
    }
  }
  
  // Inject from spotlights
  for (int i = 0; i < 32; i++) {
    if (i >= uNumSpotLights) break;
    
    vec3 lightPos = uSpotLightPositions[i];
    float dist = length(worldPos - lightPos.xy);
    
    // Only inject light near the source (within 20 pixels)
    if (dist < 20.0) {
      float falloff = 1.0 - (dist / 20.0);
      injectedLight += uSpotLightColors[i] * uSpotLightIntensities[i] * falloff;
    }
  }
  
  // Output with intensity multiplier
  gl_FragColor = vec4(injectedLight * uGIIntensity, 1.0);
}
