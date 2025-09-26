# PIXI.js 2.5D Advanced Light and Shadow System

## Overview

This project is a comprehensive React.js application showcasing advanced pseudo-3D shadow casting using PIXI.js primitives. It features a complete lighting system with unlimited sprite shadow casters, real-time light controls, and advanced visual effects. The application demonstrates complex WebGL rendering techniques including multi-pass lighting, normal mapping, texture-based light masking, and distance-based soft shadows. The focus is on lighting effects and shadow casting demonstrations rather than full sprite manipulation features.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **Z ≥ 50 Physically Realistic Shadow Casting IMPLEMENTED** (2025-09-26): Successfully implemented special case where lights with Z coordinate ≥ 50 positioned inside non-transparent parts of sprites (alpha > 0) cast physically realistic shadows like Unity examples. Implementation covers all light types (Point Lights 0-3, Spotlights 0-3) using existing vec3 uniform positions without breaking lighting calculations.
- **Fixed zOrder immediate updates** (2025-09-25): Resolved issue where zOrder changes required scene reload. Now all sprites get meshes created regardless of visibility, with visibility controlled via `mesh.visible` property instead of excluding from creation.
- **Fixed Use Normal Map toggle** (2025-09-25): Normal map textures are now always loaded if specified, with `uUseNormalMap` shader uniform controlling usage. Toggle responds immediately without texture reloading.
- **Unified immediate update system**: All sprite controls (zOrder, visibility, position, normal maps) now update instantly with delayed React state synchronization to prevent timing conflicts.

## System Architecture

### Frontend Architecture

The application uses a modern React architecture with TypeScript, built on top of Vite for development and bundling. The frontend follows a component-based structure with clear separation between:

- **Core PIXI.js Integration**: Custom React components wrap PIXI.js functionality, with the main rendering handled by `PixiDemo` component
- **Real-time Controls**: Dynamic control panels (`DynamicLightControls`, `DynamicSpriteControls`) provide live editing of lighting and scene parameters
- **Configuration Management**: External JSON-based configuration system for both scene setup (`scene.json`) and lighting configuration (`lights-config.json`)
- **UI Framework**: Uses Radix UI components with Tailwind CSS for consistent, accessible interface elements

The architecture supports unlimited lighting with automatic performance optimization through multi-pass rendering when needed.

### Backend Architecture

The backend is a minimal Express.js server that primarily serves as a bridge for configuration management:

- **Static File Serving**: Handles texture assets and configuration files
- **Configuration API**: Provides endpoints for loading and saving lighting configurations
- **Development Support**: Integrates with Vite for hot module replacement during development

The server includes basic error handling and request logging, with plans for database integration using Drizzle ORM.

### WebGL Rendering System

The core rendering system implements several advanced techniques:

- **Auto-switching Shadow Architecture**: Seamlessly switches between per-caster uniforms (≤4 casters) and occluder map rendering (unlimited casters)
- **Multi-pass Lighting**: Automatically batches lights into passes (4 point/spot lights or 2 directional lights per pass)
- **Normal Mapping**: Supports both provided normal maps and auto-generated flat normals for sprites
- **Texture-based Light Masking**: Allows complex lighting patterns through custom mask textures
- **Distance-based Soft Shadows**: Configurable shadow softness with realistic falloff
- **Z ≥ 50 Physically Realistic Shadow Casting**: Lights with Z coordinate ≥ 50 inside non-transparent sprite parts cast realistic shadows like Unity examples

### Configuration System

The application uses an external JSON-based configuration approach for maximum flexibility:

- **Scene Configuration**: Complete sprite setup including positions, textures, shadow participation, and normal mapping
- **Lighting Configuration**: Comprehensive light setup with real-time auto-save functionality
- **Hot-reload Support**: Live updates when configuration files change externally
- **Import/Export**: Easy sharing of complete scene and lighting setups

### Data Management

The project uses a simple in-memory storage system for development, with Drizzle ORM configured for future PostgreSQL integration. Configuration persistence is handled through JSON files rather than database storage for easier sharing and version control.

## External Dependencies

### Core Frameworks
- **React 18**: Frontend framework with TypeScript support
- **PIXI.js**: WebGL rendering engine for advanced graphics
- **Express.js**: Minimal backend server for development and configuration management
- **Vite**: Build tool and development server with HMR support

### UI Components
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography

### Database & ORM
- **Drizzle ORM**: TypeScript-first ORM configured for PostgreSQL
- **@neondatabase/serverless**: Serverless PostgreSQL driver for production deployment

### Development Tools
- **TypeScript**: Static type checking across the entire application
- **ESBuild**: Fast bundling for production builds
- **PostCSS**: CSS processing with Tailwind integration

### Graphics & Assets
- **Custom Shaders**: GLSL shaders for advanced lighting effects and shadow casting including Z ≥ 50 physically realistic behavior
- **Texture Assets**: Normal maps, diffuse textures, and light masks stored in public directory
- **@pixi/react**: React integration layer for PIXI.js components

The application is designed to be deployed on Vercel with minimal configuration, using the provided `vercel.json` for build and deployment settings.