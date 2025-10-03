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
  // Convert UV to world space position (top-left origin like PIXI)
  vec2 worldPos = vTextureCoord * uCanvasSize;
  
  // DEBUG: Light at (0,0) should show top-left, (800,600) should show bottom-right
  // If light is at (260,170) and blob is at top-left, coordinates are completely wrong
  
  // Accumulate light injection at this grid cell
  vec3 injectedLight = vec3(0.0);
  
  // Inject from point lights - use their radius for falloff
  for (int i = 0; i < 32; i++) {
    if (i >= uNumPointLights) break;
    
    vec3 lightPos = uPointLightPositions[i];
    float dist = length(worldPos - lightPos.xy);
    
    // DEBUG: Make radius HUGE to see where light actually appears
    float radius = 2000.0; // Cover entire screen
    
    // Inject light across the entire radius
    if (dist < radius) {
      float falloff = 1.0 - (dist / radius);
      falloff = falloff * falloff; // Squared falloff for softer edges
      injectedLight += uPointLightColors[i] * uPointLightIntensities[i] * falloff * 0.5;
    }
  }
  
  // Inject from spotlights - use fixed radius
  for (int i = 0; i < 32; i++) {
    if (i >= uNumSpotLights) break;
    
    vec3 lightPos = uSpotLightPositions[i];
    float dist = length(worldPos - lightPos.xy);
    float radius = 300.0; // Large radius for spotlights
    
    // Inject light across the entire radius
    if (dist < radius) {
      float falloff = 1.0 - (dist / radius);
      falloff = falloff * falloff; // Squared falloff
      injectedLight += uSpotLightColors[i] * uSpotLightIntensities[i] * falloff * 0.5;
    }
  }
  
  // DEBUG: Output bright colors to verify injection is working
  gl_FragColor = vec4(injectedLight * 10.0, 1.0); // 10x boost to make it visible
}
