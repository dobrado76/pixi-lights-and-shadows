precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uSceneTexture;  // The rendered scene
uniform float uGIIntensity;

void main(void) {
  // Sample the rendered scene at this LPV grid cell
  vec4 sceneColor = texture2D(uSceneTexture, vTextureCoord);
  
  // Calculate brightness/luminance of this pixel
  float luminance = dot(sceneColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  
  // Only inject light from bright pixels
  // Lower threshold to capture more light
  float brightness = max(0.0, luminance - 0.1);
  
  // Output color into LPV grid
  // Scale by intensity and preserve color
  vec3 injectedLight = sceneColor.rgb * brightness * uGIIntensity;
  
  gl_FragColor = vec4(injectedLight, brightness);
}
