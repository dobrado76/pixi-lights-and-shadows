// Depth Pass Fragment Shader
// Renders sprite zOrder as normalized depth value (height) for SSR

precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler; // Diffuse texture to get alpha for proper depth masking
uniform float uObjectHeight;   // The "height" of the current sprite (derived from zOrder)
uniform float uMaxSceneHeight; // Maximum height in the scene for normalization
uniform float uAlpha;          // Sprite alpha

void main(void) {
    // Sample the texture alpha to maintain sprite shape
    vec4 texColor = texture2D(uSampler, vTextureCoord);
    float alpha = texColor.a * uAlpha;
    
    // If transparent, discard to preserve sprite shape in depth buffer
    if (alpha < 0.1) {
        discard;
    }
    
    // Normalize the height to a 0-1 range (black to white)
    // This creates a grayscale depth map where brighter = higher/closer
    float normalizedHeight = clamp(uObjectHeight / uMaxSceneHeight, 0.0, 1.0);
    
    // Store the normalized height in the red channel
    // We can use other channels later for additional material properties:
    // - Green: surface smoothness (for blurry reflections)
    // - Blue: metallic/reflectivity
    // - Alpha: always 1.0 to mark valid depth
    gl_FragColor = vec4(normalizedHeight, 0.0, 0.0, 1.0);
}
