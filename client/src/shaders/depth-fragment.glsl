precision mediump float;

varying vec2 vTextureCoord;
varying float vDepth;

uniform sampler2D uDiffuse;
uniform float uCurrentSpriteZOrder;

void main(void) {
  // Sample texture to check alpha (for transparency handling)
  vec4 texColor = texture2D(uDiffuse, vTextureCoord);
  
  // Discard fully transparent pixels
  if (texColor.a < 0.01) {
    discard;
  }
  
  // Output depth value
  // Use z-order as the primary depth, with screen-space depth as secondary
  // This ensures sprites with higher z-order are considered "in front"
  float normalizedZOrder = (uCurrentSpriteZOrder + 100.0) / 200.0; // Normalize to 0-1
  float finalDepth = mix(vDepth, normalizedZOrder, 0.7); // Blend screen space and z-order
  
  // Pack depth into RGB (for better precision)
  // This allows 24-bit depth instead of just 8-bit
  float depth = clamp(finalDepth, 0.0, 1.0);
  vec3 packedDepth = vec3(
    floor(depth * 255.0) / 255.0,
    fract(depth * 255.0),
    0.0
  );
  
  gl_FragColor = vec4(packedDepth, texColor.a);
}
