precision mediump float;

uniform float uObjectHeight;   // Height derived from sprite's zOrder
uniform float uMaxSceneHeight; // Maximum height for normalization (default: 100.0)

void main(void) {
    // Normalize height to 0-1 range and store in red channel
    float normalizedHeight = uObjectHeight / uMaxSceneHeight;
    
    // Red channel = height, other channels available for future material properties
    gl_FragColor = vec4(normalizedHeight, 0.0, 0.0, 1.0);
}
