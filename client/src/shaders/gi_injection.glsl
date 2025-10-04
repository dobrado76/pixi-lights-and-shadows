precision highp float;

varying vec2 vTextureCoord;

uniform float uGIIntensity;
uniform vec2 uCanvasSize;
uniform sampler2D uSceneTexture;

void main(void) {
  // Sample the rendered scene (sprites already lit by direct lighting)
  vec3 sceneColor = texture2D(uSceneTexture, vTextureCoord).rgb;
  
  // DEBUG: Output scene directly to see if texture is working
  // If this shows nothing, the scene texture isn't being passed correctly
  gl_FragColor = vec4(sceneColor * 10.0, 1.0);
}
