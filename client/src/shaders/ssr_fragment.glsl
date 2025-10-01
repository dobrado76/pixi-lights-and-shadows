// Screen Space Reflections (SSR) Fragment Shader
// Ray-marches through depth buffer to find reflections for 2.5D sprites

precision mediump float;

varying vec2 vTextureCoord;

// Input textures
uniform sampler2D uSceneColor;     // Final lit scene color
uniform sampler2D uDepthMap;       // Depth/height map from depth pass
uniform sampler2D uNormalMap;      // Normal map for reflection direction (optional)
uniform sampler2D uEnvironmentMap; // IBL fallback for missed rays

// SSR Configuration
uniform bool uSSREnabled;
uniform float uSSRIntensity;       // Reflection strength (0.0 - 1.0)
uniform float uMaxRayDistance;     // Maximum ray marching distance (pixels)
uniform float uStepSize;           // Ray marching step size (pixels)
uniform float uMaxSteps;           // Maximum number of steps
uniform float uFadeEdgeDistance;   // Distance from edges where reflections fade
uniform float uDepthThreshold;     // Depth difference threshold for hits
uniform vec2 uCanvasSize;          // Screen dimensions for UV calculations
uniform bool uUseNormalMap;        // Whether to use normal map for reflection direction
uniform bool uIBLEnabled;          // Whether to use IBL as fallback
uniform float uIBLIntensity;       // IBL intensity for fallback

void main(void) {
    // Start with original scene color
    vec4 sceneColor = texture2D(uSceneColor, vTextureCoord);
    
    // DEBUG: Add red tint when SSR is enabled to confirm shader is running
    if (uSSREnabled && uSSRIntensity > 0.0) {
        // Tint red to show SSR is active
        gl_FragColor = vec4(sceneColor.rgb + vec3(0.3, 0.0, 0.0), sceneColor.a);
        return;
    }
    
    // If SSR is disabled, just output scene color
    if (!uSSREnabled || uSSRIntensity <= 0.0) {
        gl_FragColor = sceneColor;
        return;
    }
    
    // Get depth at current pixel
    float pixelDepth = texture2D(uDepthMap, vTextureCoord).r;
    
    // FLOOR REFLECTIONS: Only pixels with LOW depth (floor/background) show reflections
    // Objects at HIGH depth are what get reflected
    if (pixelDepth > 0.3) {
        // This is an object, not a reflective surface - just show scene color
        gl_FragColor = sceneColor;
        return;
    }
    
    // Calculate reflection direction
    // Default: reflect upward (simulating floor reflections)
    vec2 reflectionDir = vec2(0.0, -1.0);
    
    // If normal mapping is enabled, use the normal to calculate reflection
    if (uUseNormalMap) {
        vec3 normal = texture2D(uNormalMap, vTextureCoord).xyz * 2.0 - 1.0;
        // For 2.5D, we primarily care about the XY normal components
        // View direction is looking straight down (0, 0, -1)
        vec3 viewDir = vec3(0.0, 0.0, -1.0);
        vec3 reflectDir3D = reflect(viewDir, normal);
        reflectionDir = normalize(reflectDir3D.xy);
    }
    
    // Ray marching to find reflected object
    vec2 rayOrigin = vTextureCoord;
    vec2 rayStep = reflectionDir * (uStepSize / uCanvasSize.x); // Normalize step by screen size
    
    bool hitFound = false;
    vec2 hitUV = rayOrigin;
    float hitDepth = 0.0;
    
    // March the ray through screen space
    // Use a constant max iterations for GLSL compatibility
    for (float step = 1.0; step < 100.0; step += 1.0) {
        // Early exit based on uMaxSteps uniform
        if (step >= uMaxSteps) break;
        // Calculate current ray position
        vec2 currentUV = rayOrigin + rayStep * step;
        
        // Check if ray left screen bounds
        if (currentUV.x < 0.0 || currentUV.x > 1.0 || currentUV.y < 0.0 || currentUV.y > 1.0) {
            break;
        }
        
        // Sample depth at current position
        float sampledDepth = texture2D(uDepthMap, currentUV).r;
        
        // Check if we hit an object (depth > 0.3) while marching from floor (depth < 0.3)
        // The ray should find elevated objects to reflect
        if (sampledDepth > 0.3) {
            hitFound = true;
            hitUV = currentUV;
            hitDepth = sampledDepth;
            break;
        }
        
        // Early exit if we've traveled too far
        float distanceTraveled = length((currentUV - rayOrigin) * uCanvasSize);
        if (distanceTraveled > uMaxRayDistance) {
            break;
        }
    }
    
    // Calculate reflection color
    vec4 reflectionColor = vec4(0.0);
    float reflectionStrength = 0.0;
    
    if (hitFound) {
        // Sample the scene color at the hit point
        reflectionColor = texture2D(uSceneColor, hitUV);
        reflectionStrength = 1.0;
        
        // Fade out reflections near screen edges
        vec2 edgeDist = min(hitUV, 1.0 - hitUV) * uCanvasSize.x;
        float edgeFade = min(edgeDist.x, edgeDist.y) / uFadeEdgeDistance;
        edgeFade = smoothstep(0.0, 1.0, edgeFade);
        reflectionStrength *= edgeFade;
        
        // Fade based on ray distance (further = weaker)
        float distanceToHit = length((hitUV - rayOrigin) * uCanvasSize);
        float distanceFade = 1.0 - smoothstep(0.0, uMaxRayDistance, distanceToHit);
        reflectionStrength *= distanceFade;
        
    } else if (uIBLEnabled) {
        // Fall back to IBL environment map for missed rays
        // Calculate equirectangular UV from reflection direction
        float phi = atan(reflectionDir.y, reflectionDir.x);
        float theta = acos(0.0); // For 2.5D, we're looking mostly horizontal
        vec2 envUV = vec2(
            (phi / (2.0 * 3.14159265359)) + 0.5,
            theta / 3.14159265359
        );
        reflectionColor = texture2D(uEnvironmentMap, envUV);
        reflectionStrength = 0.3 * uIBLIntensity; // Weaker fallback
    }
    
    // Blend reflection with scene color
    float finalStrength = reflectionStrength * uSSRIntensity;
    vec4 finalColor = mix(sceneColor, reflectionColor, finalStrength);
    
    gl_FragColor = finalColor;
}
