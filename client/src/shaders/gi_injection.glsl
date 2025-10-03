precision highp float;

varying vec2 vTextureCoord;
varying vec2 vWorldPos;

uniform sampler2D uDiffuse;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec2 uCanvasSize;
uniform float uMetallicValue;
uniform float uSmoothnessValue;
uniform float uGIIntensity;

void main(void) {
  // Sample albedo
  vec4 diffuseColor = texture2D(uDiffuse, vTextureCoord);
  
  // Alpha test
  if (diffuseColor.a < 0.01) {
    discard;
  }
  
  // Calculate brightness/luminance of this pixel
  vec3 albedo = diffuseColor.rgb;
  float luminance = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  
  // Only inject light from bright pixels (emissive-like surfaces)
  // Scale by luminance and metallic (metallic surfaces reflect more)
  float emissiveFactor = luminance * (0.5 + uMetallicValue * 0.5);
  
  // Output color into LPV grid
  // Alpha channel stores the "strength" of this light injection
  gl_FragColor = vec4(albedo * emissiveFactor * uGIIntensity, emissiveFactor);
}
