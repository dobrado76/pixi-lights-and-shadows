# PIXI.js Advanced Lighting System Demo

A sophisticated React.js application demonstrating advanced lighting techniques using PIXI.js primitives (Geometry, Shader, and Mesh). Features a comprehensive lighting system with real-time controls, mask-based lighting effects, and JSON configuration management.

## ✨ Features

### 🔦 Multi-Light Support
- **Point Lights**: Up to 4 omnidirectional lights with customizable position, color, intensity, and radius
- **Spotlights**: Up to 4 directional cone lights with adjustable angle, softness, and falloff
- **Directional Lights**: Up to 2 infinite distant lights (like sunlight)
- **Ambient Lighting**: Global illumination controls with color tinting

### 🎭 Advanced Mask System
- **Shaped Lighting**: Apply custom mask textures to any light for complex lighting patterns
- **Pixel-Perfect Scaling**: Scale 1.0 displays masks at their actual pixel dimensions
- **Real-Time Transforms**: Live adjustment of mask offset, rotation, and scale
- **Multiple Formats**: Support for various image formats as light masks

### 🎮 Interactive Controls
- **Real-Time Editing**: All lighting parameters update instantly
- **Mouse Following**: Lights can track mouse movement for dynamic effects
- **Drag & Drop**: Intuitive positioning of lights in the scene
- **Visual Feedback**: Live preview of all lighting changes

### 💾 Configuration Management
- **Auto-Save**: Automatic persistence of lighting configurations
- **JSON Export/Import**: Save and load complex lighting setups
- **Scene Presets**: Quick switching between different lighting scenarios
- **Undo/Redo**: Revert changes with checkpoint system

### 🎨 Modern UI/UX
- **Dark/Light Themes**: Responsive design with theme switching
- **Component Library**: Built with shadcn/ui and Radix UI primitives
- **Accessible Controls**: Keyboard navigation and screen reader support
- **Mobile Responsive**: Works across desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pixi-lighting-demo.git
   cd pixi-lighting-demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5000` to see the demo

## 🎯 Usage Guide

### Creating Lights

1. **Add a Light**: Click the "Add Light" button and select your light type
2. **Configure Properties**: Use the control panel to adjust position, color, intensity
3. **Apply Masks**: Toggle "Has Mask" and select a texture file for shaped lighting
4. **Fine-Tune**: Adjust mask offset, rotation, and scale for perfect positioning

### Light Types Explained

#### Point Lights
- Emit light in all directions from a single point
- Perfect for light bulbs, candles, or magical orbs
- Support for distance-based attenuation

#### Spotlights  
- Directional cone-shaped lighting
- Adjustable cone angle and edge softness
- Ideal for flashlights, stage lighting, or focused illumination

#### Directional Lights
- Parallel light rays from infinite distance
- Simulate sunlight or moonlight
- No positional attenuation, only direction matters

### Mask System

The mask system allows you to create complex lighting patterns:

1. **Enable Mask**: Toggle the mask option for any light
2. **Select Image**: Choose from included masks or upload your own
3. **Position**: Adjust offset to position the mask relative to the light
4. **Orient**: Rotate the mask for desired angle
5. **Scale**: Resize the mask (1.0 = actual pixel size)

### Advanced Features

- **Mouse Following**: Enable to make lights track cursor movement
- **Auto-Save**: Configurations save automatically every few seconds  
- **Export/Import**: Use JSON files to share lighting setups
- **Performance**: Optimized shaders handle multiple lights efficiently

## 🏗️ Technical Architecture

### Frontend Stack
- **React 18** with TypeScript for component architecture
- **PIXI.js 7.x** for WebGL rendering and graphics pipeline
- **Vite** for fast development builds and hot module replacement
- **Tailwind CSS** with shadcn/ui for responsive styling

### Backend Stack
- **Express.js** REST API for configuration persistence
- **Node.js** runtime with TypeScript support
- **In-Memory Storage** with abstract storage interface

### Graphics Pipeline
- **Custom Shaders**: GLSL vertex and fragment shaders for lighting calculations
- **Geometry System**: Manual vertex buffer creation for fullscreen quads
- **Mesh Rendering**: Direct PIXI.Mesh usage combining geometry and shaders
- **Texture Management**: Efficient loading and binding of diffuse and normal maps

### Key Technologies
```
├── Frontend
│   ├── React + TypeScript
│   ├── PIXI.js (@pixi/react)
│   ├── Tailwind CSS + shadcn/ui
│   ├── TanStack Query (data fetching)
│   └── Wouter (routing)
├── Backend  
│   ├── Express.js + TypeScript
│   ├── Drizzle ORM (database)
│   └── Zod (validation)
└── Graphics
    ├── WebGL Shaders (GLSL)
    ├── Custom Geometry
    └── Advanced Lighting Math
```

## 📁 Project Structure

```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── PixiDemo.tsx   # Main PIXI.js canvas component
│   │   │   └── DynamicLightControls.tsx # UI controls
│   │   ├── shaders/           # GLSL shader files
│   │   │   ├── vertex.glsl    # Vertex shader
│   │   │   └── fragment.glsl  # Fragment shader with lighting
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utility functions
│   └── public/
│       ├── textures/          # Diffuse and normal maps
│       └── light_masks/       # Mask texture library
├── server/                    # Backend Express server
│   ├── routes.ts              # API endpoints
│   ├── storage.ts             # Data persistence layer
│   └── index.ts               # Server entry point
├── shared/                    # Shared TypeScript types
│   ├── schema.ts              # Database schema definitions
│   └── lights.ts              # Light configuration types
└── public/
    └── lights-config.json     # Default lighting configuration
```

## 🎨 Shader System

The lighting system uses custom GLSL shaders for real-time lighting calculations:

### Vertex Shader
- Transforms 2D quad vertices to screen space
- Passes texture coordinates to fragment shader
- Handles basic geometry transformation

### Fragment Shader
- **Normal Mapping**: Uses normal maps for surface detail
- **Multiple Light Types**: Supports point, spot, and directional lights
- **Distance Attenuation**: Realistic light falloff calculations
- **Mask Sampling**: Custom function for texture-based light shaping
- **Physically Based**: Proper dot product lighting calculations

### Uniform Variables
```glsl
// Basic material properties
uniform sampler2D uDiffuse;     // Base color texture
uniform sampler2D uNormal;      // Normal map for lighting
uniform vec3 uColor;            // Global color tint

// Light definitions (example for point light 0)
uniform bool uPoint0Enabled;    // Light on/off state
uniform vec3 uPoint0Position;   // World space position
uniform vec3 uPoint0Color;      // Light color (RGB)
uniform float uPoint0Intensity; // Light strength (0-10)
uniform float uPoint0Radius;    // Attenuation distance

// Mask system
uniform bool uPoint0HasMask;    // Mask enabled flag
uniform sampler2D uPoint0Mask;  // Mask texture
uniform vec2 uPoint0MaskOffset; // Position offset
uniform float uPoint0MaskRotation; // Rotation angle
uniform float uPoint0MaskScale; // Size multiplier
```

## 🔧 Configuration API

### Light Configuration Format

```typescript
interface Light {
  id: string;                    // Unique identifier
  type: 'point' | 'spotlight' | 'directional';
  enabled: boolean;              // Light active state
  position: { x: number; y: number; z: number; };
  direction?: { x: number; y: number; z: number; }; // Spotlights/directional
  color: { r: number; g: number; b: number; };      // RGB values (0-1)
  intensity: number;             // Light strength (0-10)
  radius?: number;               // Point/spot lights only
  coneAngle?: number;            // Spotlight cone angle (degrees)
  softness?: number;             // Spotlight edge softness (0-1)
  followMouse?: boolean;         // Mouse tracking enabled
  mask?: {                       // Optional mask configuration
    image: string;               // Filename in /light_masks/
    offset: { x: number; y: number; }; // Position adjustment
    rotation: number;            // Rotation in degrees
    scale: number;               // Size multiplier (1.0 = actual size)
  };
}
```

### API Endpoints

- `GET /api/load-lights-config` - Load current lighting configuration
- `POST /api/save-lights-config` - Save lighting configuration
- Auto-save triggers every 2-3 seconds during editing

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Toggle all lights on/off |
| `R` | Reset to default configuration |
| `M` | Toggle mouse following for selected light |
| `Delete` | Remove selected light |
| `Ctrl+Z` | Undo last change |
| `Ctrl+S` | Manual save configuration |

## 🌟 Performance Optimizations

- **Efficient Shaders**: Optimized GLSL code for multiple lights
- **Automatic Culling**: Disabled lights don't consume GPU resources
- **Smart Updates**: Only re-render when uniforms change
- **Texture Pooling**: Reuse loaded textures across lights
- **Minimal DOM Updates**: React optimizations for smooth UI

## 🛠️ Development

### Adding New Light Types

1. **Extend the schema** in `shared/lights.ts`
2. **Add shader uniforms** in `fragment.glsl`  
3. **Implement lighting math** in the shader main function
4. **Update uniform handling** in `PixiDemo.tsx`
5. **Add UI controls** in `DynamicLightControls.tsx`

### Custom Mask Creation

Masks should be:
- **High contrast** black and white images
- **Power of 2 dimensions** (256x256, 512x512, etc.)
- **PNG or JPG format** for web compatibility
- **Red channel used** for mask intensity

### Building for Production

```bash
npm run build
```

This creates optimized bundles in the `dist/` directory ready for deployment.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use semantic commit messages
- Add tests for new features
- Update documentation for API changes
- Ensure cross-browser compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PIXI.js Team** for the excellent WebGL rendering library
- **shadcn/ui** for beautiful, accessible UI components  
- **Replit** for the development platform and hosting
- **OpenGL Community** for shader programming resources

## 📞 Support

- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Use GitHub discussions
- 📖 **Documentation**: Check the wiki for detailed guides
- 💬 **Community**: Join our Discord server for real-time help

---

**Built with ❤️ using PIXI.js, React, and modern web technologies**