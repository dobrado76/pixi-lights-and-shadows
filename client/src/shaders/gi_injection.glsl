precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (which already shows sprites lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Calculate luminance to determine if this pixel is bright enough to inject
  float luminance = dot(sceneColor, vec3(0.299, 0.587, 0.114));
  
  // Only inject pixels that are illuminated (above threshold)
  // This captures lit sprite surfaces that will bounce light
  float threshold = 0.1; // Lower threshold to catch more indirect lighting
  
  vec3 injectedLight = vec3(0.0);
  
  if (luminance > threshold) {
    // Inject the actual lit color from the scene
    // This includes sprite albedo colors modulated by light colors
    // The multiplication creates the color bleeding effect
    injectedLight = sceneColor * uGIIntensity;
  }
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
