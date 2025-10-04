precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Inject all scene colors into the LPV
  // The rendered scene already shows sprites with proper lighting
  // This captures lit sprite surfaces for color bleeding
  vec3 injectedLight = sceneColor * uGIIntensity * 2.0;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
