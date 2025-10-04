precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Inject lit scene colors into the LPV with very subtle intensity
  // Scene is already bright, so we need minimal injection for GI
  vec3 injectedLight = sceneColor * uGIIntensity * 0.005;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
