precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // DEBUG: Output solid color to verify shader works
  // If this shows up, the shader works but texture binding is broken
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Bright red
}
