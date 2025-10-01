precision mediump float;

varying vec2 vTextureCoord;

// Input textures
uniform sampler2D uSceneColor;     // Lit scene color
uniform sampler2D uDepthMap;       // Depth buffer
uniform sampler2D uNormalMap;      // World-space normals (if available)
uniform sampler2D uEnvironmentMap; // IBL fallback

// SSR parameters
uniform bool uSSREnabled;
uniform float uSSRStrength;
uniform int uMarchSteps;
uniform float uStride;
uniform float uMaxDistance;
uniform float uFadeEdgeDistance;

// Material properties
uniform float uMetallic;
uniform float uSmoothness;

// Scene properties
uniform vec2 uCanvasSize;
uniform vec3 uCameraPosition; // Camera position in world space

// Unpack depth from RGB channels
float unpackDepth(vec4 packedDepth) {
  return packedDepth.r + (packedDepth.g / 255.0);
}

// Calculate Fresnel reflection factor
float fresnelSchlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// Ray-march through screen space with hierarchical stepping
vec4 rayMarch(vec2 screenPos, vec2 rayDir, float startDepth) {
  vec2 currentPos = screenPos;
  float currentDepth = startDepth;
  float stride = uStride;
  
  // Adaptive stride - start large and refine
  for (int i = 0; i < 128; i++) {
    // Early exit if we've exceeded max steps
    if (i >= uMarchSteps) break;
    
    // March ray forward
    currentPos += rayDir * stride;
    
    // Check if ray is off-screen
    if (currentPos.x < 0.0 || currentPos.x > 1.0 || 
        currentPos.y < 0.0 || currentPos.y > 1.0) {
      return vec4(0.0); // Miss - off screen
    }
    
    // Sample depth at current position
    vec4 depthSample = texture2D(uDepthMap, currentPos);
    float sampledDepth = unpackDepth(depthSample);
    
    // Check if ray has intersected geometry
    // The ray is "behind" geometry if its depth is greater than sampled depth
    if (currentDepth > sampledDepth) {
      // Potential hit - refine with smaller stride
      if (stride > 1.0) {
        // Back up and retry with smaller stride
        currentPos -= rayDir * stride;
        stride = stride * 0.5;
        continue;
      }
      
      // Hit confirmed - return scene color at this position
      vec3 hitColor = texture2D(uSceneColor, currentPos).rgb;
      
      // Calculate fade based on distance from edge
      vec2 edgeDist = min(currentPos, 1.0 - currentPos);
      float minEdgeDist = min(edgeDist.x, edgeDist.y);
      float edgeFade = smoothstep(0.0, uFadeEdgeDistance / uCanvasSize.x, minEdgeDist);
      
      // Calculate fade based on march distance
      float marchDist = length(currentPos - screenPos) * uCanvasSize.x;
      float distanceFade = 1.0 - smoothstep(0.0, uMaxDistance, marchDist);
      
      float totalFade = edgeFade * distanceFade;
      return vec4(hitColor, totalFade);
    }
    
    // Update depth for next iteration
    currentDepth += 0.001; // Small increment to prevent z-fighting
  }
  
  // No hit found
  return vec4(0.0);
}

// Convert equirectangular UV to 3D direction (for IBL fallback)
vec3 equirectUVToDirection(vec2 uv) {
  float phi = uv.x * 6.28318530718; // 0 to 2*PI
  float theta = uv.y * 3.14159265359; // 0 to PI
  
  return vec3(
    sin(theta) * cos(phi),
    sin(theta) * sin(phi),
    cos(theta)
  );
}

// Convert 3D direction to equirectangular UV
vec2 directionToEquirectUV(vec3 dir) {
  vec3 normDir = normalize(dir);
  float phi = atan(normDir.z, normDir.x);
  float theta = acos(normDir.y);
  
  vec2 uv = vec2(
    (phi + 3.14159265359) / 6.28318530718,
    theta / 3.14159265359
  );
  
  return uv;
}

void main(void) {
  // Sample scene color
  vec4 sceneColor = texture2D(uSceneColor, vTextureCoord);
  
  // Early exit if SSR is disabled
  if (!uSSREnabled || uSSRStrength <= 0.0) {
    gl_FragColor = sceneColor;
    return;
  }
  
  // Sample depth
  vec4 depthSample = texture2D(uDepthMap, vTextureCoord);
  float depth = unpackDepth(depthSample);
  
  // Skip if no geometry (depth == 0)
  if (depth < 0.01) {
    gl_FragColor = sceneColor;
    return;
  }
  
  // Calculate view direction (camera to pixel)
  vec2 pixelPos = vTextureCoord * uCanvasSize;
  vec3 viewDir = normalize(vec3(pixelPos - uCanvasSize * 0.5, -100.0));
  
  // Sample normal (if available, otherwise assume facing camera)
  vec3 normal = vec3(0.0, 0.0, 1.0);
  
  // Calculate reflection direction
  vec3 reflectDir = reflect(viewDir, normal);
  
  // Convert 3D reflection to 2D screen space ray direction
  vec2 rayDir = normalize(reflectDir.xy) / uCanvasSize;
  
  // Perform ray march
  vec4 reflectionResult = rayMarch(vTextureCoord, rayDir, depth);
  
  // If ray hit something, use that color
  vec3 reflectionColor = reflectionResult.rgb;
  float hitConfidence = reflectionResult.a;
  
  // Fall back to IBL if ray missed or weak hit
  if (hitConfidence < 0.5) {
    vec2 envUV = directionToEquirectUV(reflectDir);
    vec3 iblColor = texture2D(uEnvironmentMap, envUV).rgb;
    reflectionColor = mix(iblColor, reflectionColor, hitConfidence);
    hitConfidence = 1.0; // IBL fallback always present
  }
  
  // Calculate Fresnel factor
  float NdotV = max(dot(normal, -viewDir), 0.0);
  float F0 = mix(0.04, 1.0, uMetallic); // Metallic surfaces have higher F0
  float fresnel = fresnelSchlick(NdotV, F0);
  
  // Blend reflection based on smoothness, Fresnel, and SSR strength
  float reflectionStrength = fresnel * uSmoothness * uSSRStrength * hitConfidence;
  vec3 finalColor = mix(sceneColor.rgb, reflectionColor, reflectionStrength);
  
  gl_FragColor = vec4(finalColor, sceneColor.a);
}
