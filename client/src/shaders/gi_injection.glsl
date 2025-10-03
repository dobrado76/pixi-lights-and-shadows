precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uSceneTexture;  // The rendered scene
uniform float uGIIntensity;

void main(void) {
  // Sample the rendered scene at this LPV grid cell
  vec4 sceneColor = texture2D(uSceneTexture, vTextureCoord);
  
  // DEBUG: Inject ALL light, no threshold
  // Multiply by 10x to make it VERY obvious
  vec3 injectedLight = sceneColor.rgb * 10.0 * uGIIntensity;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
