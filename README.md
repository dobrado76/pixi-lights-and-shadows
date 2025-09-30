# PIXI.js 2.5D Advanced Light and Shadow System v1.0.1

A comprehensive React.js application showcasing advanced pseudo-3D shadow casting using PIXI.js primitives. Features a complete lighting system with unlimited sprite shadow casters, real-time performance controls, and external JSON configuration management.

## 🚀 Live Demo

**[Try the Live Demo →](https://pixi-lights-and-shadows.vercel.app/)**

Experience the full lighting and shadow system in action with interactive controls, real-time adjustments, and comprehensive JSON configuration management.

![PIXI.js Shadow Casting System Overview](/pixi-shadow-system-overview.jpg)

*Live demo showing multiple light types (point, directional, spotlight) with real-time shadow casting, normal mapping, and comprehensive lighting controls.*

## ✨ Key Features

### 🌑 Advanced Shadow Casting System
- **Unlimited Shadow Casters**: Unified occluder map architecture supports any number of sprite shadow casters
- **Rotation-Aware Shadows**: Rotated sprites cast accurate shadows matching their visual orientation
- **Self-Shadow Avoidance**: Advanced bounds calculation prevents rotated sprites from shadowing themselves incorrectly
- **Off-Screen Shadow Casting**: Sprites outside the visible frame can cast shadows into the visible area
- **Expanded Canvas System**: 512px buffer zones eliminate shadow artifacts when sprites move out of view
- **Per-Light Shadow Control**: Individual shadow casting flags for each light source
- **Per-Sprite Shadow Participation**: Granular control over which sprites cast and receive shadows
- **Performance Optimized**: Unified occluder map approach provides consistent performance for any number of shadow casters
- **Distance-Based Soft Shadows**: Configurable shadow softness with distance-based edge controls
- **Multiple Shadow Types**: Point light, spotlight, and directional light shadow casting
- **Realistic Shadow Behavior**: Shadows maintain consistent size and shape regardless of sprite visibility
- **Ambient Occlusion**: Screen Space Ambient Occlusion post-processing system that creates realistic ambient shadows around sprites while respecting z-order hierarchy

### 🔦 Unlimited Multi-Light Support
- **Point Lights**: Unlimited omnidirectional lights with multi-pass rendering (4 per pass for optimal performance)
- **Spotlights**: Unlimited directional cone lights with adjustable angle, softness, and falloff (4 per pass)
- **Directional Lights**: Unlimited infinite distant lights (like sunlight) with parallel ray shadow simulation (2 per pass)
- **Ambient Lighting**: Global illumination controls with color tinting
- **Multi-Pass Architecture**: Automatic switching to multi-pass rendering for >8 total enabled lights

### 🎭 Advanced Mask System
- **Texture-Based Light Masking**: Apply custom mask textures to any light for complex lighting patterns
- **Global Performance Control**: Real-time toggle for all light masks via performance settings
- **Pixel-Perfect Scaling**: Scale 1.0 displays masks at their actual pixel dimensions
- **Real-Time Transforms**: Live adjustment of mask offset, rotation, and scale
- **Shadow-Aware Masking**: Masks only apply in fully lit areas, shadows override masks

### ✨ Unity-Style PBR Material System
- **Physically Based Rendering**: Complete PBR implementation with metallic and smoothness properties
- **Inline Material Architecture**: Simplified ECS structure with materials embedded directly in sprite components
- **Metallic Workflow**: Industry-standard metallic/roughness PBR pipeline
- **Real-Time Material Editing**: Live adjustment of metallic and smoothness values with instant visual feedback
- **Material Property Integration**: Seamless integration with lighting, shadows, and normal mapping systems
- **Performance Optimized**: Efficient GPU utilization for real-time PBR calculations

### 📄 Unified JSON Configuration System
- **Single Configuration File**: Everything stored in `scene.json` - sprites, lights, and shadow settings in one place
- **Real-Time UI Editing**: All scene objects and lighting parameters editable through interactive controls
- **Complete Transform Support**: Position, rotation, scale, and pivot controls for all sprites
- **Pivot-Based Scaling**: Sprites scale around configurable pivot points (top-left, center, custom offsets)
- **Automatic State Management**: Configuration changes update immediately with visual feedback
- **Development-Friendly**: Live editing with instant visual updates during development
- **Easy Scene Sharing**: Complete scenes can be shared via single JSON file

### 🎮 Interactive Controls & Performance
- **Real-Time Performance Toggles**: Instant control over Shadows, Ambient Occlusion, Normal Mapping, and Light Masks
- **Adaptive Quality Settings**: Automatic performance optimization with manual override capability
- **Real-Time Editing**: All lighting and shadow parameters update instantly
- **Mouse Following**: Lights can track mouse movement for dynamic effects
- **Drag & Drop**: Intuitive positioning of lights in the scene
- **Visual Feedback**: Live preview of all lighting and shadow changes

### 🎨 Modern UI/UX
- **Dark/Light Themes**: Responsive design with theme switching
- **Component Library**: Built with shadcn/ui and Radix UI primitives
- **Accessible Controls**: Keyboard navigation and screen reader support
- **Mobile Responsive**: Works across desktop, tablet, and mobile devices

## 📁 Configuration System

### Unified ECS Configuration (`client/public/scene.json`)

All scene, lighting, shadow, and performance data is stored in a single JSON file using an Entity Component System (ECS) architecture with five main sections:

```json
{
  "scene": {
    "background": {
      "material": {
        "image": "/textures/BGTextureTest.jpg",
        "normal": "/textures/BGTextureNORM.jpg", 
        "useNormalMap": true,
        "metallic": 0,
        "smoothness": 0.5
      },
      "transform": {
        "position": { "x": 0, "y": 0 },
        "rotation": 0,
        "scale": 1
      },
      "sprite": {
        "pivot": { "preset": "top-left", "offsetX": 0, "offsetY": 0 },
        "zOrder": -1,
        "castsShadows": false,
        "visible": false
      }
    },
    "block2": {
      "material": {
        "image": "/textures/block2.png",
        "normal": "/textures/block2NormalMap.png",
        "useNormalMap": true,
        "metallic": 0.34,
        "smoothness": 0.5
      },
      "transform": {
        "position": { "x": 291, "y": 351 },
        "rotation": 0.24434609527920614,
        "scale": 1.3
      },
      "sprite": {
        "pivot": { "preset": "middle-center", "offsetX": 0, "offsetY": 0 },
        "zOrder": 1,
        "castsShadows": true,
        "visible": true
      }
    }
  },
  "lights": [
    {
      "id": "mouse_light",
      "type": "point",
      "enabled": true,
      "position": { "x": 250, "y": 170, "z": 70 },
      "direction": { "x": 0, "y": 0, "z": 0 },
      "color": { "r": 1, "g": 1, "b": 1 },
      "intensity": 0.7,
      "followMouse": true,
      "castsShadows": true,
      "radius": 270
    },
    {
      "id": "spotlight_1", 
      "type": "spotlight",
      "enabled": true,
      "position": { "x": 180, "y": 210, "z": 80 },
      "direction": { "x": 0, "y": 1, "z": -1 },
      "color": { "r": 0.956, "g": 0.941, "b": 0.502 },
      "intensity": 0.9,
      "castsShadows": true,
      "radius": 480,
      "coneAngle": 58,
      "softness": 0.2
    }
  ],
  "performanceSettings": {
    "quality": "high",
    "resolution": 1,
    "maxLights": 999,
    "enableShadows": true,
    "enableAmbientOcclusion": true,
    "enableNormalMapping": true,
    "enableLightMasks": true,
    "textureScale": 1,
    "fpsTarget": 60,
    "capFpsTo60": true,
    "manualOverride": true
  },
  "shadowConfig": {
    "enabled": true,
    "strength": 0.6,
    "maxLength": 130,
    "height": 10
  },
  "ambientOcclusionConfig": {
    "enabled": true,
    "strength": 4.8,
    "radius": 5,
    "samples": 8,
    "bias": 20
  }
}
```

### ECS Component Structure

#### Material Component
- **image**: Path to diffuse texture (relative to public/)
- **normal**: Path to normal map texture for surface detail
- **useNormalMap**: Whether to apply normal mapping for this sprite
- **metallic**: Metallic property for PBR rendering (0.0 = dielectric, 1.0 = metallic)
- **smoothness**: Surface smoothness for PBR rendering (0.0 = rough, 1.0 = mirror-like)

#### Transform Component
- **position**: X,Y coordinates in screen space (relative to sprite's pivot point)
- **rotation**: Rotation angle in radians (sprite rotates around pivot point)
- **scale**: Size multiplier (1.0 = original size, scales around pivot point)

#### Sprite Component
- **pivot**: Anchor point configuration that determines scaling and rotation center
- **zOrder**: Rendering order (lower values render first, allows negative values)
- **castsShadows**: Whether object blocks light and casts shadows
- **visible**: Whether object is rendered in the scene

#### Pivot System
The pivot system determines how sprites are positioned, scaled, and rotated:

**Preset Options:**
- `"top-left"` (default): Position represents top-left corner, scale/rotate from top-left
- `"top-center"`: Position represents top edge center, scale/rotate from top center
- `"top-right"`: Position represents top-right corner, scale/rotate from top-right
- `"middle-left"`: Position represents left edge center, scale/rotate from left center
- `"middle-center"`: Position represents sprite center, scale/rotate from center
- `"middle-right"`: Position represents right edge center, scale/rotate from right center
- `"bottom-left"`: Position represents bottom-left corner, scale/rotate from bottom-left
- `"bottom-center"`: Position represents bottom edge center, scale/rotate from bottom center
- `"bottom-right"`: Position represents bottom-right corner, scale/rotate from bottom-right
- `"offset"`: Custom pivot with offsetX/offsetY values relative to center

**Custom Offsets:**
```json
"pivot": {
  "preset": "offset",
  "offsetX": 10,
  "offsetY": -5
}
```

**Default Behavior:**
If no pivot is specified, sprites use `"top-left"` pivot, meaning the position coordinates represent where the top-left pixel of the sprite appears on screen.

### Light Properties
- **id**: Unique identifier for the light
- **type**: Light type (`point`, `spotlight`, `directional`)
- **enabled**: Whether the light is active
- **position**: 3D position object with x, y, z coordinates
- **direction**: 3D direction object with x, y, z components (directional/spotlight only)
- **color**: RGB color object with r, g, b components (0.0 - 1.0 range)
- **intensity**: Light intensity multiplier
- **radius**: Attenuation distance (point/spotlight only)
- **coneAngle**: Spotlight cone angle in degrees (spotlight only)
- **softness**: Spotlight edge softness (0.0 - 1.0, spotlight only)
- **followMouse**: Whether light tracks mouse cursor (point lights only)
- **castsShadows**: Whether this light casts shadows

### Mask Properties
- **image**: Filename in `/client/public/light_masks/` directory
- **offset**: X,Y position adjustment relative to light
- **rotation**: Rotation angle in degrees
- **scale**: Size multiplier (1.0 = actual pixel size)

### Performance Settings
- **quality**: Performance preset ("low", "medium", "high")
- **resolution**: Rendering resolution multiplier (0.5 - 1.0)
- **maxLights**: Maximum number of lights to process (2, 4, or 999 for unlimited)
- **enableShadows**: Global shadow system toggle
- **enableAmbientOcclusion**: Ambient occlusion effects toggle
- **enableNormalMapping**: Normal map rendering toggle
- **enableLightMasks**: Light pattern masks toggle
- **textureScale**: Texture resolution multiplier
- **fpsTarget**: Target frame rate (30, 45, or 60)
- **manualOverride**: Whether settings resist automatic performance adjustments

### Shadow Configuration
- **enabled**: Global shadow system on/off
- **strength**: Shadow opacity (0.0 - 1.0)
- **maxLength**: Maximum shadow length in pixels
- **height**: Shadow casting height (affects projection angle)
- **bias**: Shadow bias to prevent self-shadowing artifacts

### Ambient Occlusion Configuration
- **enabled**: Global ambient occlusion on/off
- **strength**: AO intensity (0.0 - 3.0)
- **radius**: Sampling radius for occlusion detection
- **samples**: Number of samples for AO calculation (4-16)
- **bias**: Bias to prevent self-occlusion

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   Navigate to `http://localhost:5000` to see the demo

3. **Modify configurations**
   - Use the interactive UI controls to edit scene objects and lighting
   - Manually edit `client/public/scene.json` for advanced configuration
   - Changes update immediately with visual feedback

## 🎯 Usage Guide

### Using the Configuration System

#### Scene Setup
1. **Interactive Editing**: Use the UI controls to position, rotate, scale, and configure all scene objects
2. **Transform Controls**: Adjust position, rotation, scale, and pivot settings with real-time preview
3. **Add Textures**: Place diffuse textures in `client/public/textures/`
4. **Add Normal Maps**: Place normal maps for surface detail
5. **Configure Shadows**: Toggle shadow casting and receiving per object
6. **Manual Editing**: Directly edit `scene.json` for precise control

#### Transform System
- **Position**: X,Y coordinates relative to the sprite's pivot point
- **Rotation**: Rotate sprites around their pivot point with accurate shadow casting
- **Scale**: Resize sprites around their pivot point (1.0 = original size)
- **Pivot**: Choose from 9 preset positions or set custom offset for scaling/rotation center

#### Lighting Setup  
1. **Live Controls**: Use interactive panels to adjust all light properties
2. **Add Masks**: Place mask textures in `client/public/light_masks/`
3. **Real-Time Preview**: All changes update instantly with visual feedback
4. **Configuration Sharing**: Copy `scene.json` to share complete scenes

### Interactive Controls

#### Sprite Transform Controls
- **Position Sliders**: Drag to move sprites anywhere on the canvas
- **Rotation Control**: Rotate sprites with real-time shadow updates
- **Scale Control**: Resize sprites around their pivot points
- **Pivot Presets**: Choose from 9 standard pivot positions or set custom offsets
- **Live Preview**: All transform changes update immediately with shadow recalculation

#### Light Management
- **Add Light**: Click "Add Light" button and select type
- **Configure Properties**: Use control panels to adjust all parameters
- **Apply Masks**: Toggle mask system and adjust transforms
- **Shadow Control**: Enable/disable shadow casting per light

#### Shadow System
- **Global Toggle**: Enable/disable entire shadow system
- **Per-Light Control**: Individual shadow casting flags
- **Per-Sprite Control**: Configure which sprites participate in shadows
- **Visual Tuning**: Adjust shadow strength, length, and height

### Light Types Explained

#### Point Lights
- Omnidirectional light emission from a single point
- Realistic distance-based attenuation
- Perfect for light bulbs, candles, or magical orbs
- Cast circular shadows radiating outward

#### Spotlights  
- Directional cone-shaped lighting with adjustable angle
- Smooth edge falloff with configurable softness
- Ideal for flashlights, stage lighting, or focused illumination
- Cast directional shadows following light direction

#### Directional Lights
- Parallel light rays simulating infinite distance sources
- No positional attenuation, uniform intensity
- Perfect for sunlight, moonlight, or environmental lighting
- Cast parallel shadows like real-world sun shadows

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for component architecture
- **PIXI.js 7.x** with @pixi/react for WebGL rendering
- **Custom GLSL Shaders** for advanced lighting and shadow calculations
- **Vite** for fast development builds and hot module replacement
- **Tailwind CSS** with shadcn/ui for responsive styling

### Backend Stack
- **Express.js** REST API for configuration persistence
- **Node.js** runtime with TypeScript support
- **In-Memory Storage** with abstract storage interface

### Shadow Casting Pipeline
- **Multi-Pass Rendering**: Separate shadow calculation passes for complex scenes
- **Expanded Occlusion Map System**: Canvas treated as "camera window" into larger rendered scene
- **Off-Screen Shadow Integration**: 512px buffer zones capture off-screen sprites for realistic shadow casting
- **Unified Occluder Map Architecture**: Consistent approach for all shadow caster counts
- **Rotation-Aware Shadow Geometry**: Shadow casting geometry perfectly matches visual sprite rotation
- **Advanced Self-Shadow Bounds**: Rotated bounding box calculation prevents incorrect self-shadowing
- **Pivot-Aligned Shadow Positioning**: Shadow meshes positioned relative to sprite pivot points
- **Unified Shadow Calculation**: Single shader function handles all light types
- **Distance-Based Softening**: Realistic shadow edge behavior
- **Performance Optimized**: Efficient GPU utilization for real-time shadows

### Graphics Pipeline
- **Custom Geometry**: Manual vertex buffer creation with pivot-aware transformations
- **Pivot-Based Transforms**: Scaling and rotation around configurable anchor points
- **Advanced Shaders**: Multi-light GLSL with normal mapping and shadow casting
- **Rotation Support**: Full sprite rotation with accurate shadow casting
- **Texture Management**: Efficient loading of diffuse, normal, and mask textures
- **Uniform Optimization**: Smart uniform updates minimize GPU state changes

## 📁 Project Structure

```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── PixiDemo.tsx   # Main PIXI.js canvas and lighting system
│   │   │   ├── Sprite.tsx     # Individual sprite rendering component
│   │   │   └── DynamicLightControls.tsx # UI controls for lights
│   │   ├── shaders/           # GLSL shader files
│   │   │   ├── vertex.glsl    # Vertex shader for geometry processing
│   │   │   └── fragment.glsl  # Fragment shader with lighting and shadows
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── usePixiGeometry.ts # PIXI geometry creation utilities
│   │   └── lib/               # Utility functions
│   └── public/
│       ├── scene.json         # Scene configuration file
│       ├── lights-config.json # Lighting configuration file
│       ├── textures/          # Diffuse and normal map textures
│       └── light_masks/       # Mask texture library
├── server/                    # Backend Express server
│   ├── routes.ts              # API endpoints for configuration
│   ├── storage.ts             # Data persistence layer
│   └── index.ts               # Server entry point
├── shared/                    # Shared TypeScript types
│   ├── schema.ts              # Database schema definitions
│   └── lights.ts              # Light and shadow configuration types
└── replit.md                  # Project documentation and preferences
```

## 🔧 Shadow System Technical Details

### Unified Shadow Architecture

#### Occluder Map (All shadow caster counts)
- Render-to-texture approach for complex scenes
- **Expanded Canvas System**: Renders sprites in 1824×1624 occlusion map for 800×600 canvas
- **Off-Screen Shadow Casting**: Sprites outside visible area (within 512px buffer) cast shadows into frame
- Supports unlimited number of shadow casters
- Higher GPU memory usage but better scalability
- Advanced shader sampling techniques with extended UV bounds

### Shadow Calculation Process

1. **Caster Detection**: Identify sprites with `castsShadows: true` (includes off-screen sprites within buffer)
2. **Unified Rendering**: Use occluder map approach for all scenarios
3. **Expanded Map Rendering**: Render full sprites to enlarged occlusion map (canvas + 512px buffer zones)
4. **Shadow Ray Casting**: Calculate shadow rays from light to fragment with extended bounds
5. **Occlusion Testing**: Test intersection with shadow casting geometry using coordinate offset mapping
6. **Distance Calculation**: Compute shadow factor based on occlusion
7. **Final Compositing**: Blend shadows with lighting calculations

### Off-Screen Shadow Casting

The expanded shadow system treats the visible canvas as a "camera window" looking into a larger rendered scene:

- **Buffer Zones**: 512px padding around all canvas edges captures off-screen sprites
- **Consistent Shadows**: Sprites maintain full shadow size when moving out of view
- **Realistic Behavior**: Eliminates shadow shrinking artifacts common in traditional systems
- **Extended Sampling**: Shader can sample shadow data from expanded coordinate space
- **Performance Efficient**: Only processes sprites within the extended buffer area

### Performance Optimization

#### Multi-Pass Light Rendering
- **Automatic Switching**: Single-pass for ≤8 lights, multi-pass for unlimited lights
- **Per-Pass Limits**: 4 point lights + 4 spotlights + 2 directional lights per pass
- **Optimal Batching**: Groups lights efficiently to minimize GPU state changes
- **Pass Calculation**: `Math.max(pointPasses, spotPasses, dirPasses)` determines total passes

#### General Optimizations
- **Automatic LOD**: Shadow quality adapts to scene complexity
- **Efficient Culling**: Disabled lights consume no GPU resources
- **Smart Updates**: Only re-render when uniforms change
- **Texture Pooling**: Reuse loaded textures across multiple lights
- **Shader Compilation Caching**: Avoid redundant shader compilation

## 🎨 Shader System

### Fragment Shader Features
- **Multi-Light Processing**: Handles point, spot, and directional lights simultaneously
- **Normal Mapping**: Full surface detail using normal map textures
- **Shadow Integration**: Unified shadow calculation for all light types
- **Mask Sampling**: Advanced texture sampling for shaped lighting effects
- **Distance Attenuation**: Physically-based light falloff calculations

### Uniform Variables
```glsl
// Material properties
uniform sampler2D uDiffuse;        // Base color texture
uniform sampler2D uNormal;         // Normal map for surface detail
uniform vec3 uColor;               // Global color tint

// Shadow system
uniform bool uShadowsEnabled;      // Global shadow toggle
uniform float uShadowStrength;     // Shadow opacity
uniform float uShadowHeight;       // Sprite height for projection
uniform float uShadowMaxLength;    // Maximum shadow distance
uniform vec2 uOccluderMapOffset;   // Buffer offset for off-screen shadow casting
uniform sampler2D uOccluderMap;    // Unified occlusion map texture

// Per-light uniforms (example for point light 0)
uniform bool uPoint0Enabled;       // Light active state
uniform vec3 uPoint0Position;      // 3D world position
uniform vec3 uPoint0Color;         // RGB light color
uniform float uPoint0Intensity;    // Light strength
uniform float uPoint0Radius;       // Attenuation radius
uniform bool uPoint0CastsShadows;  // Shadow casting flag

// Mask system
uniform bool uPoint0HasMask;       // Mask enabled
uniform sampler2D uPoint0Mask;     // Mask texture
uniform vec2 uPoint0MaskOffset;    // Position offset
uniform float uPoint0MaskRotation; // Rotation angle
uniform float uPoint0MaskScale;    // Size multiplier
```

## 🛠️ Development

### Adding New Sprites

1. **Create textures**: Add diffuse and normal map textures to `client/public/textures/`
2. **Update scene.json**: Add sprite configuration with shadow properties
3. **Test shadows**: Verify shadow casting and receiving behavior
4. **Optimize**: Adjust shadow height and participation for best visual results

### Creating Custom Masks

Mask textures should be:
- **High contrast** images with clear light/dark areas
- **Power-of-2 dimensions** (256x256, 512x512, 1024x1024)
- **PNG format** recommended for transparency support
- **Grayscale or color** (red channel used for intensity)

### Extending Light Types

1. **Extend schema** in `shared/lights.ts`
2. **Add shader uniforms** in `fragment.glsl`
3. **Implement lighting math** with shadow integration
4. **Update uniform handling** in `PixiDemo.tsx`
5. **Add UI controls** in `DynamicLightControls.tsx`

### Configuration Management

The system provides:
- **Automatic Loading**: Configuration loaded on startup with fallback defaults
- **Live State Management**: UI changes update immediately with visual feedback
- **Development Persistence**: Changes persist during development session
- **Manual Export/Import**: Copy configuration JSON for sharing scenes
- **Validation**: Robust error handling for malformed configurations

## 📄 API Reference

### Configuration Endpoints

#### Load Complete Configuration
```
GET /api/load-scene-config
Returns: Complete scene configuration (sprites, lights, shadows)
```

#### Load Lighting Configuration  
```
GET /api/load-lights-config
Returns: Extracted lights and shadow configuration
```

#### Save Complete Configuration
```
POST /api/save-scene-config
Body: Complete scene configuration
Returns: Success/error status
```

#### Save Lighting Configuration
```
POST /api/save-lights-config
Body: Lights and shadow configuration
Returns: Success/error status
```

**Note**: In serverless environments, file persistence may be limited. Consider using a database for production deployments.

## 📋 Changelog

### v1.0.1 (Latest)
- **Fixed Real-Time Performance Toggles**: All 4 performance controls (Shadows, AO, Normal Mapping, Light Masks) now work immediately
- **Global Light Mask Control**: Added unified shader control for enabling/disabling all light masks via performance settings
- **Resolved Light Save Issues**: Fixed data format inconsistency preventing certain lights from saving enabled state
- **Enhanced Performance System**: Improved reliability of real-time performance adjustments with proper shader uniform updates

## 🌟 Performance Guidelines

### Real-Time Performance Controls (v1.0.1)
- **Enable Shadows**: Toggle all shadow casting on/off instantly
- **Enable Ambient Occlusion**: Control subtle ambient darkening effects
- **Enable Normal Mapping**: Switch between detailed and flat surface rendering
- **Enable Light Masks**: Toggle all light pattern effects globally
- **Adaptive Quality**: Automatic optimization based on hardware capabilities
- **Manual Override**: User control overrides automatic performance adjustments

### Optimal Scene Setup
- **Limit active lights**: 4-6 concurrent lights for best performance
- **Manage shadow casters**: Consider scene complexity vs. visual quality
- **Texture optimization**: Use appropriate texture sizes (512x512 typical)
- **Normal map quality**: Balance detail vs. memory usage

### Shadow Performance
- **Unified System**: Consistent performance for all shadow caster counts
- **Occluder Map**: Single approach provides predictable memory usage
- **Disable unused shadows**: Turn off shadow casting for non-essential lights
- **Adjust shadow quality**: Use maxLength to limit shadow calculations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test configuration system and UI controls
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Test shadow system with various sprite configurations
- Validate configuration changes work correctly
- Ensure cross-browser WebGL compatibility
- Update documentation for configuration changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## 🙏 Acknowledgments

- **PIXI.js Team** for the excellent WebGL rendering library
- **shadcn/ui** for beautiful, accessible UI components  
- **Replit** for the development platform and hosting
- **WebGL Community** for advanced graphics programming resources

## 📋 Version

**Current Version: 1.0**

This represents the first stable release of the PIXI.js 2.5D Advanced Light and Shadow System. All core features are fully implemented and working as intended:

- ✅ Complete lighting system with unlimited multi-light support
- ✅ Advanced shadow casting with rotation support and pivot-based scaling
- ✅ Independent ambient occlusion post-processing with z-order hierarchy
- ✅ Real-time interactive controls and JSON configuration management
- ✅ All critical bugs resolved and shader uniforms properly initialized

---

**Built with ❤️ featuring advanced shadow casting, unlimited sprite support, and comprehensive JSON configuration**