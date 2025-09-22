export const fragmentShaderSource = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uColor;
    uniform float uWaveAmplitude;
    uniform float uWaveFrequency;

    void main(void) {
        vec2 uv = vTextureCoord;
        
        // Create wave distortion effect
        float wave = sin(uv.x * uWaveFrequency + uTime) * uWaveAmplitude;
        uv.y += wave;
        
        // Sample the texture
        vec4 texColor = texture2D(uTexture, uv);
        
        // Apply color tinting
        vec3 finalColor = texColor.rgb * uColor;
        
        // Add some gradient based on position
        float gradient = smoothstep(0.0, 1.0, uv.y);
        finalColor = mix(finalColor, finalColor * 1.5, gradient * 0.3);
        
        gl_FragColor = vec4(finalColor, texColor.a);
    }
`;
