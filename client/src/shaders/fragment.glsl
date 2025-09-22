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

// 🔥 DYNAMIC LIGHTING - NO TYPE RESTRICTIONS!
uniform int uLightCount;

// Individual uniforms for first 4 lights (expandable architecture)
uniform vec3 uLight0Pos;   uniform int uLight0Type;   uniform vec3 uLight0Color;   uniform float uLight0Intensity;
uniform vec3 uLight1Pos;   uniform int uLight1Type;   uniform vec3 uLight1Color;   uniform float uLight1Intensity;
uniform vec3 uLight2Pos;   uniform int uLight2Type;   uniform vec3 uLight2Color;   uniform float uLight2Intensity;
uniform vec3 uLight3Pos;   uniform int uLight3Type;   uniform vec3 uLight3Color;   uniform float uLight3Intensity;

void main(void) {
  vec2 uv = vTextureCoord;
  vec4 diffuseColor = texture2D(uDiffuse, uv);
  
  // Calculate world position
  vec2 worldPos = uSpritePos + uv * uSpriteSize;
  
  // Start with ambient lighting
  vec3 finalColor = diffuseColor.rgb * uAmbientLight * uAmbientColor;
  
  // 🚀 DYNAMIC LIGHTING: Process your 4 mixed light types!
  
  // Light 0 (type: directional)
  if (uLightCount > 0) {
    vec3 lightContribution = uLight0Color * uLight0Intensity * 0.4;
    finalColor += diffuseColor.rgb * lightContribution;
  }
  
  // Light 1 (type: spotlight) 
  if (uLightCount > 1) {
    vec2 lightDir = uLight1Pos.xy - worldPos;
    float distance = length(lightDir);
    float attenuation = 1.0 / (1.0 + distance * 0.01);
    vec3 lightContribution = uLight1Color * uLight1Intensity * attenuation * 0.3;
    finalColor += diffuseColor.rgb * lightContribution;
  }
  
  // Light 2 (type: spotlight)
  if (uLightCount > 2) {
    vec2 lightDir = uLight2Pos.xy - worldPos;
    float distance = length(lightDir);
    float attenuation = 1.0 / (1.0 + distance * 0.01);
    vec3 lightContribution = uLight2Color * uLight2Intensity * attenuation * 0.3;
    finalColor += diffuseColor.rgb * lightContribution;
  }
  
  // Light 3 (type: point)
  if (uLightCount > 3) {
    vec2 lightDir = uLight3Pos.xy - worldPos;
    float distance = length(lightDir);
    float attenuation = 1.0 / (1.0 + distance * 0.01);
    vec3 lightContribution = uLight3Color * uLight3Intensity * attenuation * 0.5;
    finalColor += diffuseColor.rgb * lightContribution;
  }
  
  // Apply color tinting
  finalColor *= uColor;
  
  gl_FragColor = vec4(finalColor, diffuseColor.a);
}