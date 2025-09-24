# Overview

This is a PIXI.js demonstration application built with React that showcases the fundamental building blocks of PIXI.js: Geometry, Shader, and Mesh primitives. The application provides an interactive environment for experimenting with custom shaders, geometry creation, and mesh rendering. It's designed as a full-stack web application with Express.js backend and React frontend, featuring a modern UI built with shadcn/ui components and Tailwind CSS styling.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **PIXI.js Integration**: Custom React components using @pixi/react for WebGL rendering
- **UI Components**: shadcn/ui component library with Radix UI primitives for consistent design
- **Styling**: Tailwind CSS with custom design tokens and dark theme support
- **State Management**: React hooks for local component state management
- **Custom Hooks**: Modular hooks for PIXI geometry creation and canvas management

## Backend Architecture
- **Server Framework**: Express.js with TypeScript for REST API endpoints
- **Development Environment**: Hot module replacement with Vite integration in development mode
- **Static File Serving**: Express serves static assets and the built React application
- **Storage Layer**: Abstract storage interface with in-memory implementation for user management

## PIXI.js Graphics Pipeline
- **Custom Geometry System**: Manual vertex, UV, and index buffer creation for fullscreen quads
- **Shader System**: Custom vertex and fragment shaders with uniform parameter control
- **Mesh Rendering**: Direct PIXI.Mesh creation combining geometry and shaders for post-processing effects
- **Texture Management**: Asset loading and texture binding for complex material systems
- **Interactive Controls**: Real-time shader parameter adjustment through React UI components

## Database Schema
- **User Management**: Simple user table with UUID primary keys, username, and password fields
- **ORM**: Drizzle ORM for type-safe database operations with Zod schema validation
- **Database**: Configured for PostgreSQL with environment-based connection strings

## Build and Development
- **Module System**: ES modules throughout the application with proper TypeScript configuration
- **Path Aliases**: Clean import statements using @ and @shared path mapping
- **Asset Handling**: Public directory structure for PIXI.js textures and game assets
- **Development Tools**: Runtime error overlay and source mapping for debugging

# Configuration Files

## Important File Locations
- **lights-config.json**: Located in `/client/public/lights-config.json` - light configuration alongside scene assets
- **scene.json**: Located in `/client/public/scene.json` - sprite and scene configuration for the frontend
- **Light masks**: Located in `/client/public/light_masks/` - texture files for masked lighting effects

**Note**: All configuration files are now consolidated in `/client/public/` directory for better organization.

# External Dependencies

## Core Runtime Dependencies
- **@pixi/react**: React bindings for PIXI.js WebGL rendering engine
- **pixi.js**: 2D WebGL rendering library for interactive graphics
- **express**: Node.js web application framework for backend API
- **drizzle-orm**: Type-safe ORM for database operations
- **@neondatabase/serverless**: Serverless PostgreSQL database driver

## UI and Styling
- **@radix-ui/***: Comprehensive set of unstyled, accessible UI primitives
- **tailwindcss**: Utility-first CSS framework for responsive design
- **class-variance-authority**: Utility for creating type-safe component variants
- **lucide-react**: Icon library with consistent SVG icons

## Development and Build Tools
- **vite**: Fast build tool and development server with HMR support
- **typescript**: Static type checking for JavaScript
- **@replit/vite-plugin-***: Replit-specific development plugins for enhanced debugging
- **esbuild**: Fast JavaScript bundler for production builds

## Data Management
- **@tanstack/react-query**: Server state management and caching for React
- **zod**: TypeScript-first schema validation library
- **drizzle-zod**: Integration between Drizzle ORM and Zod validation

## Graphics and Game Assets
- **date-fns**: Modern date utility library for timestamp handling
- **@hookform/resolvers**: Form validation resolvers for React Hook Form
- **connect-pg-simple**: PostgreSQL session store for Express sessions

# Recent Changes: Latest modifications with dates

## Code Cleanup & Data-Driven Architecture (Sept 2024)
- **Legacy Component Removal**: Eliminated unused legacy components (ControlPanel.tsx, StatusPanel.tsx, CodeDisplay.tsx) to reduce codebase complexity
- **Hardcoded Value Elimination**: Replaced all hardcoded shadow caster coordinates with data-driven values from scene.json configuration
- **100% JSON-Driven System**: Achieved complete data-driven architecture where all sprite positions, lighting, and shadow configurations come from external JSON files
- **Clean Architecture**: Removed specific references (ball, block) from shader comments and code to maintain generic, reusable system
- **Comprehensive Code Documentation**: Added meaningful comments explaining complex logic, architectural decisions, and non-obvious interactions across all active components