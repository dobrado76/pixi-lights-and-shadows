precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uDiffuse;
uniform float uObjectHeight; // Height value based on zOrder

void main(void) {
  // Sample alpha to maintain sprite shape
  float alpha = texture2D(uDiffuse, vTextureCoord).a;
  
  // Discard transparent pixels
  if (alpha < 0.01) {
    discard;
  }
  
  // Normalize height to 0-1 range for depth map (assuming height range 0-100)
  float normalizedHeight = uObjectHeight / 100.0;
  
  // Output height as grayscale (R channel = height, RGB all same for visualization)
  gl_FragColor = vec4(vec3(normalizedHeight), 1.0);
}
