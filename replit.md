# PIXI.js 2.5D Advanced Light and Shadow System

## Overview

This project is a comprehensive React.js application showcasing advanced pseudo-3D shadow casting using PIXI.js primitives. It features two complete rendering systems: a forward renderer and an experimental deferred renderer. The application demonstrates complex WebGL rendering techniques including multi-pass lighting, normal mapping, texture-based light masking, distance-based soft shadows, and true deferred lighting with G-Buffer architecture. It's designed as both a technical demonstration and an interactive playground for exploring 2.5D lighting effects.

## Rendering Systems

### Forward Renderer (Original)
- Per-sprite lighting calculations with real-time shader updates
- Unlimited sprite shadow casters using auto-switching architecture
- Multi-pass rendering for complex lighting scenarios
- Optimized for compatibility and proven performance

### Deferred Renderer (Experimental)
- True deferred lighting pipeline with G-Buffer architecture
- Screen-space lighting calculations for improved scalability
- Unified illumination and shadow rendering on single screen-size maps
- Reduces complexity for large numbers of sprites with lighting
- Easy toggle system for A/B comparison testing

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Custom Shaders**: GLSL shaders for advanced lighting effects and shadow casting
- **Texture Assets**: Normal maps, diffuse textures, and light masks stored in public directory
- **@pixi/react**: React integration layer for PIXI.js components

The application is designed to be deployed on Vercel with minimal configuration, using the provided `vercel.json` for build and deployment settings.