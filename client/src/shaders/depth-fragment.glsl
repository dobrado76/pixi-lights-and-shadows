precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uCurrentSpriteZOrder;

void main(void) {
  // Sample the diffuse texture to check alpha
  vec4 texColor = texture2D(uSampler, vTextureCoord);
  
  // Discard transparent pixels - critical for proper depth map
  if (texColor.a < 0.1) {
    discard;
  }
  
  // Convert zOrder to normalized depth (0.0 to 1.0)
  // Assuming zOrder ranges from -1 to 10 for your scene
  float normalizedDepth = (uCurrentSpriteZOrder + 1.0) / 11.0;
  
  // Pack depth into RGB channels for better precision
  gl_FragColor = vec4(normalizedDepth, normalizedDepth, normalizedDepth, 1.0);
}