precision mediump float;

varying vec2 vTextureCoord;

// Input textures
uniform sampler2D uSceneColor;     // Final lit scene
uniform sampler2D uDepthMap;       // Height map from depth pass
uniform sampler2D uNormalMap;      // Normal map of current surface

// SSR Configuration
uniform bool uSSREnabled;
uniform float uSSRIntensity;
uniform float uMaxDistance;
uniform float uStepSize;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec2 uCanvasSize;

// Camera/view uniforms
uniform vec3 uViewDirection;       // Camera/view direction (typically 0,0,-1 for 2D)

void main() {
    vec4 sceneColor = texture2D(uSceneColor, vTextureCoord);
    
    if (!uSSREnabled || uSSRIntensity <= 0.0) {
        gl_FragColor = sceneColor;
        return;
    }
    
    // Sample depth at current pixel
    float depth = texture2D(uDepthMap, vTextureCoord).r;
    
    // If depth is 0 (background), no reflection
    if (depth <= 0.001) {
        gl_FragColor = sceneColor;
        return;
    }
    
    // Sample normal map to get surface normal
    vec3 normal = texture2D(uNormalMap, vTextureCoord).rgb;
    normal = normalize(normal * 2.0 - 1.0); // Convert from [0,1] to [-1,1]
    
    // Calculate reflection vector using view direction and normal
    // For 2D top-down view, we use a fixed view direction
    vec3 viewDir = normalize(uViewDirection);
    vec3 reflectDir = reflect(viewDir, normal);
    
    // Convert 3D reflection to 2D screen-space direction
    vec2 reflectDir2D = normalize(reflectDir.xy);
    
    // Ray-march through the depth map to find reflection
    vec2 currentPos = vTextureCoord;
    float currentDepth = depth;
    bool hit = false;
    vec2 hitUV = vec2(0.0);
    float travelDistance = 0.0;
    
    // Ray-marching loop
    for (int i = 0; i < 100; i++) {
        // Step along reflection direction
        travelDistance += uStepSize;
        vec2 stepOffset = reflectDir2D * (travelDistance / uCanvasSize);
        currentPos = vTextureCoord + stepOffset;
        
        // Check if we're out of bounds
        if (currentPos.x < 0.0 || currentPos.x > 1.0 || 
            currentPos.y < 0.0 || currentPos.y > 1.0) {
            break;
        }
        
        // Sample depth at ray position
        float sampleDepth = texture2D(uDepthMap, currentPos).r;
        
        // Check for intersection: ray depth crosses sample depth
        // Ray starts at currentDepth and travels "downward" in height as it goes away
        float rayHeight = depth - (travelDistance / uMaxDistance) * depth;
        
        if (rayHeight <= sampleDepth && sampleDepth > 0.001) {
            // Hit! We found something taller than our ray
            hit = true;
            hitUV = currentPos;
            break;
        }
        
        // Stop if we've traveled too far
        if (travelDistance >= uMaxDistance) {
            break;
        }
    }
    
    // If we hit something, sample the scene color at that point
    if (hit) {
        vec3 reflectionColor = texture2D(uSceneColor, hitUV).rgb;
        
        // Calculate fade based on distance traveled
        float normalizedDistance = travelDistance / uMaxDistance;
        float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, normalizedDistance);
        
        // Blend reflection with original scene color
        float finalStrength = uSSRIntensity * fade;
        vec3 finalColor = mix(sceneColor.rgb, reflectionColor, finalStrength);
        
        gl_FragColor = vec4(finalColor, sceneColor.a);
    } else {
        // No hit - just output original scene
        gl_FragColor = sceneColor;
    }
}
