precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uSceneTexture;  // The rendered scene
uniform float uGIIntensity;

void main(void) {
  // Sample the rendered scene at this LPV grid cell
  vec4 sceneColor = texture2D(uSceneTexture, vTextureCoord);
  
  // DEBUG: Output raw scene texture to see if ANYTHING is captured
  gl_FragColor = vec4(sceneColor.rgb * 10.0, 1.0);
}
