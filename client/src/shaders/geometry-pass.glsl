precision mediump float;
varying vec2 vTextureCoord;

// G-Buffer Geometry Pass Fragment Shader
// Outputs multiple render targets for deferred rendering

uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform vec2 uSpritePos;
uniform vec2 uSpriteSize;
uniform vec2 uCanvasSize;
uniform float uRotation;

// UV rotation function
vec2 rotateUV(vec2 uv, float rotation) {
  vec2 centered = uv - 0.5;
  float cosRot = cos(rotation);
  float sinRot = sin(rotation);
  vec2 rotated = vec2(
    centered.x * cosRot - centered.y * sinRot,
    centered.x * sinRot + centered.y * cosRot
  );
  return rotated + 0.5;
}

void main(void) {
  // Apply rotation to UV coordinates
  vec2 uv = rotateUV(vTextureCoord, uRotation);
  
  // Sample textures
  vec4 diffuseColor = texture2D(uDiffuse, uv);
  vec3 normalMap = texture2D(uNormal, uv).rgb;
  
  // Calculate world position
  vec2 worldPos = uSpritePos + uv * uSpriteSize;
  
  // Convert normal from [0,1] to [-1,1] range
  vec3 worldNormal = normalize(normalMap * 2.0 - 1.0);
  
  // For a proper deferred renderer, we would output to multiple render targets:
  // gl_FragData[0] = vec4(diffuseColor.rgb, 1.0);           // Albedo
  // gl_FragData[1] = vec4(worldNormal * 0.5 + 0.5, 1.0);   // Normal (encoded to [0,1])
  // gl_FragData[2] = vec4(worldPos / uCanvasSize, 0.0, 1.0); // Position (normalized)
  
  // For now, output albedo (PIXI.js MRT support is limited)
  gl_FragColor = vec4(diffuseColor.rgb, diffuseColor.a);
}