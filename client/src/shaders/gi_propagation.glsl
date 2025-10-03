precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uLPVTexture;
uniform vec2 uTexelSize;
uniform float uPropagationFactor;

void main(void) {
  vec2 uv = vTextureCoord;
  
  // Sample current cell
  vec4 center = texture2D(uLPVTexture, uv);
  
  // Sample 4 neighbors (up, down, left, right)
  vec4 up = texture2D(uLPVTexture, uv + vec2(0.0, uTexelSize.y));
  vec4 down = texture2D(uLPVTexture, uv - vec2(0.0, uTexelSize.y));
  vec4 left = texture2D(uLPVTexture, uv - vec2(uTexelSize.x, 0.0));
  vec4 right = texture2D(uLPVTexture, uv + vec2(uTexelSize.x, 0.0));
  
  // Average neighbors with propagation falloff
  vec4 neighborAverage = (up + down + left + right) * 0.25;
  
  // Blend current cell with neighbor average
  // This creates the "bleeding" effect
  vec4 propagated = mix(center, neighborAverage, uPropagationFactor);
  
  // Apply slight decay to prevent infinite brightness buildup
  propagated *= 0.98;
  
  gl_FragColor = propagated;
}
