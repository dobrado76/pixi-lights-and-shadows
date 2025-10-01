attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform vec2 uCanvasSize;

varying vec2 vTextureCoord;
varying float vDepth;

void main(void) {
  vTextureCoord = aTextureCoord;
  
  // Calculate actual world position after container transforms
  vec3 worldPos = translationMatrix * vec3(aVertexPosition, 1.0);
  
  // Normalize depth to 0-1 range based on canvas size
  // Objects further from top-left are "deeper" in screen space
  float maxDepth = max(uCanvasSize.x, uCanvasSize.y);
  vDepth = length(worldPos.xy) / maxDepth;
  
  gl_Position = vec4((projectionMatrix * worldPos).xy, vDepth, 1.0);
}
