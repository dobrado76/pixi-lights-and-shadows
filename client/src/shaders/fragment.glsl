precision mediump float;
// Force refresh 3 - DEBUG SHADER
varying vec2 vTextureCoord;
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec2 uCanvasSize;
uniform vec3 uColor;
uniform float uAmbientLight;
uniform vec3 uAmbientColor;

// 🔥 MINIMAL TEST - NO ARRAYS AT ALL!
uniform int uLightCount;

// Minimal shader - no complex functions for now

void main(void) {
  vec2 uv = vTextureCoord;
  vec4 diffuseColor = texture2D(uDiffuse, uv);
  
  // ULTRA-SIMPLE TEST: Just show the texture with red tint if lights exist
  vec3 finalColor = diffuseColor.rgb;
  
  if (uLightCount > 0) {
    finalColor.r += 0.5; // Strong red tint to prove dynamic lighting system works
  }
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}