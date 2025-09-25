attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;

varying vec2 vTextureCoord;
varying vec2 vWorldPos; // Pass actual transformed world position to fragment

void main(void) {
  vTextureCoord = aTextureCoord;
  // Calculate actual world position after container transforms
  vec3 worldPos = translationMatrix * vec3(aVertexPosition, 1.0);
  vWorldPos = worldPos.xy;
  gl_Position = vec4((projectionMatrix * worldPos).xy, 0.0, 1.0);
}