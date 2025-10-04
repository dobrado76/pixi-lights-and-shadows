precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Inject lit scene colors into the LPV
  // This captures sprite colors illuminated by lights for color bleeding
  vec3 injectedLight = sceneColor * uGIIntensity;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
