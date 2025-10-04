precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Inject lit scene colors into the LPV with reduced intensity
  // Scene is already bright, so we need subtle injection for GI
  vec3 injectedLight = sceneColor * uGIIntensity * 0.05;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
