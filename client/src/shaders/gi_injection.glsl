precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // Inject lit scene colors - use intensity slider directly
  vec3 injectedLight = sceneColor * uGIIntensity * 0.1;
  
  gl_FragColor = vec4(injectedLight, 1.0);
}
