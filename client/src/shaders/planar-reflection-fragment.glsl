precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uSceneTexture;
uniform float uReflectionPlaneY;  // Y position of reflection plane in normalized coords
uniform float uStrength;          // Reflection strength 0-1
uniform float uBlurAmount;        // Blur amount 0-5
uniform vec2 uResolution;         // Canvas resolution

// Simple box blur for reflections
vec4 boxBlur(sampler2D tex, vec2 uv, float blurSize) {
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    // 3x3 kernel
    for(float x = -1.0; x <= 1.0; x += 1.0) {
        for(float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 offset = vec2(x, y) * blurSize / uResolution;
            color += texture2D(tex, uv + offset);
            total += 1.0;
        }
    }
    
    return color / total;
}

void main(void) {
    // Calculate reflection UV by flipping vertically around the reflection plane
    vec2 reflectionUV = vTextureCoord;
    
    // Only show reflections below the plane
    if (vTextureCoord.y > uReflectionPlaneY) {
        // Flip the UV vertically around the reflection plane
        float distanceFromPlane = vTextureCoord.y - uReflectionPlaneY;
        reflectionUV.y = uReflectionPlaneY - distanceFromPlane;
        
        // Sample with optional blur
        vec4 reflection;
        if (uBlurAmount > 0.01) {
            reflection = boxBlur(uSceneTexture, reflectionUV, uBlurAmount);
        } else {
            reflection = texture2D(uSceneTexture, reflectionUV);
        }
        
        // Fade based on distance from reflection plane
        float fade = 1.0 - smoothstep(0.0, 0.5, distanceFromPlane / (1.0 - uReflectionPlaneY));
        
        // Output reflection with strength and fade
        gl_FragColor = reflection * uStrength * fade;
    } else {
        // No reflection above the plane
        gl_FragColor = vec4(0.0);
    }
}
