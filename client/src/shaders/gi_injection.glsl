precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

// Light uniforms (match main shader)
// Flat arrays - each light takes 3 elements (x,y,z or r,g,b)
uniform float uPointLightPositions[96];  // 32 lights * 3 components
uniform float uPointLightColors[96];     // 32 lights * 3 components
uniform float uPointLightIntensities[32];
uniform float uPointLightRadii[32];
uniform int uNumPointLights;

uniform float uSpotLightPositions[96];   // 32 lights * 3 components
uniform float uSpotLightColors[96];      // 32 lights * 3 components
uniform float uSpotLightIntensities[32];
uniform int uNumSpotLights;

void main(void) {
  // Convert UV to world space position (top-left origin like PIXI)
  vec2 worldPos = vTextureCoord * uCanvasSize;
  
  // Sample the rendered scene to get sprite color at this position
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Accumulate light injection at this grid cell
  vec3 injectedLight = vec3(0.0);
  
  // Inject from point lights - use their radius for falloff
  for (int i = 0; i < 32; i++) {
    if (i >= uNumPointLights) break;
    
    // Read from flat array
    vec3 lightPos = vec3(
      uPointLightPositions[i * 3],
      uPointLightPositions[i * 3 + 1],
      uPointLightPositions[i * 3 + 2]
    );
    vec3 lightColor = vec3(
      uPointLightColors[i * 3],
      uPointLightColors[i * 3 + 1],
      uPointLightColors[i * 3 + 2]
    );
    
    float dist = length(worldPos - lightPos.xy);
    float radius = uPointLightRadii[i];
    
    // Inject light within the light's radius
    if (dist < radius) {
      float falloff = 1.0 - (dist / radius);
      falloff = falloff * falloff; // Squared falloff for softer edges
      // Mix light color with sprite color for color bleeding
      vec3 blendedColor = lightColor * max(sceneColor, vec3(0.1)); // Ensure some contribution even in dark areas
      injectedLight += blendedColor * uPointLightIntensities[i] * falloff;
    }
  }
  
  // Inject from spotlights - use fixed radius
  for (int i = 0; i < 32; i++) {
    if (i >= uNumSpotLights) break;
    
    // Read from flat array
    vec3 lightPos = vec3(
      uSpotLightPositions[i * 3],
      uSpotLightPositions[i * 3 + 1],
      uSpotLightPositions[i * 3 + 2]
    );
    vec3 lightColor = vec3(
      uSpotLightColors[i * 3],
      uSpotLightColors[i * 3 + 1],
      uSpotLightColors[i * 3 + 2]
    );
    
    float dist = length(worldPos - lightPos.xy);
    float radius = 200.0; // Moderate radius for spotlights
    
    // Inject light across the entire radius
    if (dist < radius) {
      float falloff = 1.0 - (dist / radius);
      falloff = falloff * falloff; // Squared falloff
      // Mix light color with sprite color for color bleeding
      vec3 blendedColor = lightColor * max(sceneColor, vec3(0.1));
      injectedLight += blendedColor * uSpotLightIntensities[i] * falloff;
    }
  }
  
  // Output injected light with user-controlled intensity
  gl_FragColor = vec4(injectedLight * uGIIntensity, 1.0);
}
