# PIXI.js 2.5D Advanced Light and Shadow System

## Overview

This project is a comprehensive React.js application showcasing advanced pseudo-3D shadow casting using PIXI.js primitives. It features a complete lighting system with unlimited sprite shadow casters, real-time light controls, and advanced visual effects. The application demonstrates complex WebGL rendering techniques including multi-pass lighting, normal mapping, texture-based light masking, and distance-based soft shadows.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (September 2025)

- **Fixed Critical Shadow Positioning Bug** (2025-09-27): Resolved major issue where rotated sprites cast shadows from wrong positions. Problem was double offset - shadow geometry was correctly calculated in world space but mesh.position.set(SHADOW_BUFFER, SHADOW_BUFFER) added unnecessary 512px offset. Fixed by setting mesh position to (0,0) since vertices already contain correct world coordinates.
- **Unified Shadow System** (2025-09-26): Successfully unified the dual shadow casting system into a single, clean code path using occluder maps for all sprite counts (0-4+). Removed all legacy per-caster uniform code and simplified architecture.
- **Complete Code Cleanup** (2025-09-26): Removed USE_UNIFIED_SHADOW_SYSTEM flag, cleaned up unused shader uniforms (uShadowCaster0-2), and eliminated legacy calculateShadow() function. System now uses single consistent approach.
- **Fixed zOrder immediate updates** (2025-09-25): All sprites get meshes created regardless of visibility, with visibility controlled via `mesh.visible` property.
- **Fixed Use Normal Map toggle** (2025-09-25): Normal map textures always loaded if specified, with `uUseNormalMap` shader uniform controlling usage.

## Current System Architecture

### Shadow System Architecture

**CURRENT STATE (Post-Unification)**:
- **Single Unified Approach**: All sprite counts (0-4+) use occluder map rendering
- **No More Dual System**: Removed the old per-caster uniform system completely
- **Simplified Logic**: Single code path for all shadow calculations
- **Consistent Performance**: Same shadow quality regardless of sprite count
- **Maintainable Codebase**: Much easier to debug and enhance

**Key Technical Details**:
- Always sets `uUseOccluderMap = true` (no more conditional logic)
- Uses `calculateShadowOccluderMap()` for point/spot lights
- Uses `calculateDirectionalShadowOccluderMap()` for directional lights
- Removed 12 per-caster shader uniforms (`uShadowCaster0-2` variants)
- Simplified shader functions with no conditional branching

### Frontend Architecture

The application uses a modern React architecture with TypeScript:

- **Core PIXI.js Integration**: Main rendering handled by `PixiDemo` component
- **Real-time Controls**: `DynamicLightControls` and `DynamicSpriteControls` provide live editing
- **Unified Configuration**: Single `scene.json` file contains sprites, lights, and shadows
- **UI Framework**: Radix UI components with Tailwind CSS

### Backend Architecture

Minimal Express.js server:
- **Static File Serving**: Handles texture assets and configuration files
- **Configuration API**: Endpoints for loading/saving lighting configurations
- **Development Support**: Integrates with Vite for HMR

### WebGL Rendering System

**Current Shadow Implementation**:
- **Unified Occluder Map**: Single approach for all shadow casting
- **Multi-pass Lighting**: Batches lights (4 point/spot or 2 directional per pass)  
- **Normal Mapping**: Both provided normals and auto-generated flat normals
- **Texture-based Light Masking**: Custom mask textures for complex patterns
- **Distance-based Soft Shadows**: Configurable softness with realistic falloff

**Critical Code Locations**:
- `client/src/components/PixiDemo.tsx` - Main rendering and shadow system
- `client/src/shaders/fragment.glsl` - Unified shadow calculation functions
- `client/src/shaders/vertex.glsl` - Vertex transformations
- `client/public/scene.json` - Unified configuration file

### Data Management

- **In-memory Storage**: Simple development storage system
- **JSON Configuration**: All settings persist through scene.json file
- **Hot Reload**: Live updates when configuration changes
- **Drizzle ORM**: Configured for future PostgreSQL integration

## External Dependencies

### Core Stack
- **React 18** with TypeScript
- **PIXI.js** for WebGL rendering  
- **Express.js** for backend API
- **Vite** for development and building

### UI Components  
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### Development Tools
- **TypeScript** - Static type checking
- **ESBuild** - Fast bundling
- **PostCSS** - CSS processing

The application is designed for Vercel deployment with minimal configuration.

## Important Development Notes

1. **Shadow System**: Always uses occluder maps, no conditional logic needed
2. **Performance**: Consistent across all sprite counts, no switching overhead
3. **Debugging**: Single code path makes issues easier to trace
4. **Extensions**: New shadow features only need to be added to occluder map approach
5. **Shader Uniforms**: Removed legacy uShadowCaster0-2 uniforms completely

## Critical Architectural Decision

The recent unification eliminated the complex dual shadow system in favor of a single, maintainable approach. This provides:
- Consistent behavior across all scenarios
- Easier maintenance and debugging  
- Cleaner, more readable code
- Foundation for future enhancements

This architecture is now stable and ready for layer system implementation if needed.