import * as PIXI from 'pixi.js';

/**
 * Scene and sprite management system for PIXI.js applications.
 * Handles texture loading, geometry creation, shader compilation, and transform management.
 * Supports normal mapping with automatic flat normal generation for sprites without normal maps.
 */

// External sprite configuration format (from scene.json)
export interface SpriteDefinition {
  image: string;
  normal?: string;                    // Optional normal map texture
  position?: { x: number; y: number };
  rotation?: number;                  // Radians
  scale?: number;
  zOrder?: number;                    // Z-order for rendering depth (lower = behind, higher = in front)
  castsShadows?: boolean;             // Participates in shadow casting
  visible?: boolean;                  // Controls sprite visibility without deletion
  useNormalMap?: boolean;             // Whether to use normal mapping for this sprite
}

// Internal interface with defaults applied - all fields guaranteed to exist
interface CompleteSpriteDefinition {
  image: string;
  normal: string;                     // Always present (empty string = auto-generate flat normal)
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  zOrder: number;                     // Z-order for rendering depth
  castsShadows: boolean;
  visible: boolean;
  useNormalMap: boolean;
  pivot?: {
    preset: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'offset';
    offsetX?: number;
    offsetY?: number;
  };
}

export interface SpriteTransform {
  position: { x: number; y: number };
  rotation: number;
  scale: number;
}

/**
 * Individual sprite with complete render pipeline management.
 * Handles texture loading, geometry creation, shader compilation, and PIXI mesh creation.
 */
export class SceneSprite {
  public id: string;
  public definition: CompleteSpriteDefinition;
  public mesh: PIXI.Mesh | null = null;           // Final rendered mesh
  public shader: PIXI.Shader | null = null;       // Compiled shader program
  public geometry: PIXI.Geometry | null = null;   // Vertex/UV/index buffers
  public diffuseTexture: PIXI.Texture | null = null;  // Main color texture
  public normalTexture: PIXI.Texture | null = null;   // Normal map or generated flat normal
  public needsMeshCreation: boolean = false;      // Flag indicating mesh needs to be created

  constructor(id: string, definition: SpriteDefinition) {
    this.id = id;
    // Normalize sprite definition by applying sensible defaults
    this.definition = {
      image: definition.image,
      normal: definition.normal || '',                 // Empty = generate flat normal
      position: definition.position || { x: 0, y: 0 }, // Top-left origin
      rotation: definition.rotation || 0,              // No rotation
      scale: definition.scale || 1,                    // 1:1 pixel scale
      zOrder: definition.zOrder ?? 0,                  // Default z-order (middle layer)
      castsShadows: definition.castsShadows ?? true,   // Most sprites cast shadows
      visible: definition.visible ?? true,             // Visible by default
      useNormalMap: definition.useNormalMap ?? true    // Use normal mapping by default
    };
  }

  /**
   * Loads diffuse and normal textures asynchronously.
   * Generates flat normal texture for sprites without normal maps or when useNormalMap is disabled.
   */
  async loadTextures(): Promise<void> {
    this.diffuseTexture = PIXI.Texture.from(this.definition.image);
    
    // Always load normal map texture if specified, regardless of useNormalMap flag
    // The shader will decide whether to use it based on the uUseNormalMap uniform
    if (this.definition.normal && this.definition.normal !== '') {
      this.normalTexture = PIXI.Texture.from(this.definition.normal);
    } else {
      // Generate proper flat normal (RGB 128,128,255 = normal vector [0,0,1])
      // Used when no normal texture is provided in sprite definition
      this.normalTexture = this.createFlatNormalTexture();
    }
    
    // Wait for textures to load
    const promises = [new Promise(resolve => {
      if (this.diffuseTexture!.baseTexture.valid) resolve(true);
      else this.diffuseTexture!.baseTexture.on('loaded', resolve);
    })];
    
    // Wait for normal texture if it was loaded from file
    if (this.definition.normal && this.definition.normal !== '') {
      promises.push(new Promise(resolve => {
        if (this.normalTexture!.baseTexture.valid) resolve(true);
        else this.normalTexture!.baseTexture.on('loaded', resolve);
      }));
    }
    
    await Promise.all(promises);
  }

  /**
   * Creates sprite quad geometry with proper transforms applied.
   * Handles rotation, scaling, and positioning in vertex coordinates.
   */
  createGeometry(): PIXI.Geometry {
    if (!this.diffuseTexture) throw new Error('Textures must be loaded before creating geometry');

    const { x, y } = this.definition.position;
    
    // Get base dimensions before scaling
    const baseWidth = this.diffuseTexture.width;
    const baseHeight = this.diffuseTexture.height;
    const width = baseWidth * this.definition.scale;
    const height = baseHeight * this.definition.scale;

    // Build vertex buffer with ONLY scaling and pivot transform (NO rotation in geometry)
    const geometry = new PIXI.Geometry();
    
    // Local space quad corners in UNSCALED dimensions (scaling happens around pivot)
    const corners = [
      { x: 0, y: 0 },                      // Top-left
      { x: baseWidth, y: 0 },              // Top-right
      { x: baseWidth, y: baseHeight },     // Bottom-right
      { x: 0, y: baseHeight }              // Bottom-left
    ];

    // Calculate pivot point based on definition (pivot-aware scaling only)
    const pivot = this.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
    let basePivotX = 0, basePivotY = 0;
    
    switch (pivot.preset) {
      case 'top-left': basePivotX = 0; basePivotY = 0; break;
      case 'top-center': basePivotX = baseWidth / 2; basePivotY = 0; break;
      case 'top-right': basePivotX = baseWidth; basePivotY = 0; break;
      case 'middle-left': basePivotX = 0; basePivotY = baseHeight / 2; break;
      case 'middle-center': basePivotX = baseWidth / 2; basePivotY = baseHeight / 2; break;
      case 'middle-right': basePivotX = baseWidth; basePivotY = baseHeight / 2; break;
      case 'bottom-left': basePivotX = 0; basePivotY = baseHeight; break;
      case 'bottom-center': basePivotX = baseWidth / 2; basePivotY = baseHeight; break;
      case 'bottom-right': basePivotX = baseWidth; basePivotY = baseHeight; break;
      case 'offset': 
        basePivotX = baseWidth / 2 + (pivot.offsetX || 0);
        basePivotY = baseHeight / 2 + (pivot.offsetY || 0);
        break;
    }
    
    // Scale the pivot point
    const scaledPivotX = basePivotX * this.definition.scale;
    const scaledPivotY = basePivotY * this.definition.scale;
    
    // Apply ONLY pivot-aware scaling (rotation is handled in fragment shader)
    const transformedCorners = corners.map(corner => {
      // Apply scaling from pivot point (pivot stays stationary)
      const scaledOffsetX = (corner.x - basePivotX) * this.definition.scale;
      const scaledOffsetY = (corner.y - basePivotY) * this.definition.scale;
      
      return {
        x: x + scaledPivotX + scaledOffsetX,
        y: y + scaledPivotY + scaledOffsetY
      };
    });

    // Vertices (x, y for each corner)
    const vertices = new Float32Array([
      transformedCorners[0].x, transformedCorners[0].y,  // Top-left
      transformedCorners[1].x, transformedCorners[1].y,  // Top-right
      transformedCorners[2].x, transformedCorners[2].y,  // Bottom-right
      transformedCorners[3].x, transformedCorners[3].y   // Bottom-left
    ]);

    // UV coordinates (0 to 1 mapping)
    const uvs = new Float32Array([
      0, 0,  // Top-left
      1, 0,  // Top-right
      1, 1,  // Bottom-right
      0, 1   // Bottom-left
    ]);

    // Indices for two triangles
    const indices = new Uint16Array([
      0, 1, 2,  // First triangle
      0, 2, 3   // Second triangle
    ]);

    geometry.addAttribute('aVertexPosition', vertices, 2);
    geometry.addAttribute('aTextureCoord', uvs, 2);
    geometry.addIndex(indices);

    this.geometry = geometry;
    return geometry;
  }

  createShader(vertexShader: string, fragmentShader: string, uniforms: any): PIXI.Shader {
    if (!this.diffuseTexture || !this.normalTexture) {
      throw new Error('Textures must be loaded before creating shader');
    }

    const { x, y } = this.definition.position;
    const width = this.diffuseTexture.width * this.definition.scale;
    const height = this.diffuseTexture.height * this.definition.scale;

    // Calculate pivot point for shader
    const pivot = this.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
    const baseWidth = this.diffuseTexture?.width || 1;
    const baseHeight = this.diffuseTexture?.height || 1;
    let basePivotX = 0, basePivotY = 0;
    
    switch (pivot.preset) {
      case 'top-left': basePivotX = 0; basePivotY = 0; break;
      case 'top-center': basePivotX = baseWidth / 2; basePivotY = 0; break;
      case 'top-right': basePivotX = baseWidth; basePivotY = 0; break;
      case 'middle-left': basePivotX = 0; basePivotY = baseHeight / 2; break;
      case 'middle-center': basePivotX = baseWidth / 2; basePivotY = baseHeight / 2; break;
      case 'middle-right': basePivotX = baseWidth; basePivotY = baseHeight / 2; break;
      case 'bottom-left': basePivotX = 0; basePivotY = baseHeight; break;
      case 'bottom-center': basePivotX = baseWidth / 2; basePivotY = baseHeight; break;
      case 'bottom-right': basePivotX = baseWidth; basePivotY = baseHeight; break;
      case 'offset': 
        basePivotX = baseWidth / 2 + (pivot.offsetX || 0);
        basePivotY = baseHeight / 2 + (pivot.offsetY || 0);
        break;
    }
    
    const worldPivotX = x + basePivotX * this.definition.scale;
    const worldPivotY = y + basePivotY * this.definition.scale;

    const shaderUniforms = {
      uDiffuse: this.diffuseTexture,
      uNormal: this.normalTexture,
      uUseNormalMap: this.definition.useNormalMap, // Flag to control normal map usage in shader
      uSpritePos: [x, y],
      uSpriteSize: [width, height],
      uRotation: this.definition.rotation, // Pass rotation to fragment shader
      uPivotPoint: [worldPivotX, worldPivotY], // Pass pivot point to fragment shader
      // Self-shadow avoidance bounds for occluder map
      uReceiverMin: [x, y],
      uReceiverMax: [x + width, y + height],
      ...uniforms
    };

    this.shader = PIXI.Shader.from(vertexShader, fragmentShader, shaderUniforms);
    return this.shader;
  }

  createMesh(vertexShader: string, fragmentShader: string, uniforms: any): PIXI.Mesh {
    const geometry = this.createGeometry();
    const shader = this.createShader(vertexShader, fragmentShader, uniforms);
    
    this.mesh = new PIXI.Mesh(geometry, shader as any);
    this.mesh.x = 0;
    this.mesh.y = 0;
    
    return this.mesh;
  }

  /**
   * Returns sprite bounding box for shadow volume calculations.
   * Note: Ignores rotation - returns axis-aligned bounding box.
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.diffuseTexture) throw new Error('Texture must be loaded to get bounds');
    
    const { x, y } = this.definition.position;
    const width = this.diffuseTexture.width * this.definition.scale;
    const height = this.diffuseTexture.height * this.definition.scale;
    
    return { x, y, width, height };
  }

  // Update transform (for dynamic updates)
  updateTransform(transform: Partial<SpriteTransform>): void {
    if (transform.position) {
      this.definition.position = { ...this.definition.position, ...transform.position };
    }
    if (transform.rotation !== undefined) {
      this.definition.rotation = transform.rotation;
    }
    if (transform.scale !== undefined) {
      this.definition.scale = transform.scale;
    }

    // CRITICAL: Recreate geometry and update shader uniforms if mesh exists
    if (this.mesh && this.shader) {
      const bounds = this.getBounds();
      this.shader.uniforms.uSpritePos = [bounds.x, bounds.y];
      this.shader.uniforms.uSpriteSize = [bounds.width, bounds.height];
      this.shader.uniforms.uRotation = this.definition.rotation;
      
      // Update pivot point for rotation in shader
      const pivot = this.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
      const baseWidth = this.diffuseTexture?.width || 1;
      const baseHeight = this.diffuseTexture?.height || 1;
      let basePivotX = 0, basePivotY = 0;
      
      switch (pivot.preset) {
        case 'top-left': basePivotX = 0; basePivotY = 0; break;
        case 'top-center': basePivotX = baseWidth / 2; basePivotY = 0; break;
        case 'top-right': basePivotX = baseWidth; basePivotY = 0; break;
        case 'middle-left': basePivotX = 0; basePivotY = baseHeight / 2; break;
        case 'middle-center': basePivotX = baseWidth / 2; basePivotY = baseHeight / 2; break;
        case 'middle-right': basePivotX = baseWidth; basePivotY = baseHeight / 2; break;
        case 'bottom-left': basePivotX = 0; basePivotY = baseHeight; break;
        case 'bottom-center': basePivotX = baseWidth / 2; basePivotY = baseHeight; break;
        case 'bottom-right': basePivotX = baseWidth; basePivotY = baseHeight; break;
        case 'offset': 
          basePivotX = baseWidth / 2 + (pivot.offsetX || 0);
          basePivotY = baseHeight / 2 + (pivot.offsetY || 0);
          break;
      }
      
      // Calculate world space pivot point for shader
      const worldPivotX = bounds.x + basePivotX * this.definition.scale;
      const worldPivotY = bounds.y + basePivotY * this.definition.scale;
      this.shader.uniforms.uPivotPoint = [worldPivotX, worldPivotY];
      
      // Update self-shadow avoidance bounds
      this.shader.uniforms.uReceiverMin = [bounds.x, bounds.y];
      this.shader.uniforms.uReceiverMax = [bounds.x + bounds.width, bounds.y + bounds.height];
      
      // CRITICAL: Recreate geometry with new transform and apply to mesh
      const newGeometry = this.createGeometry();
      this.mesh.geometry = newGeometry;
      
      console.log(`🔄 Updated transform for ${this.id}: pos(${bounds.x},${bounds.y}) scale(${this.definition.scale}) rot(${this.definition.rotation})`);
    }
  }

  /**
   * Generates 1x1 flat normal texture for sprites without normal maps.
   * RGB(128,128,255) represents normal vector [0,0,1] pointing outward.
   */
  private createFlatNormalTexture(): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    
    // Standard flat normal: RGB(128,128,255) = normalized [0,0,1] normal vector
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 1, 1);
    
    return PIXI.Texture.from(canvas);
  }

  destroy(): void {
    if (this.mesh) {
      this.mesh.destroy();
      this.mesh = null;
    }
    if (this.geometry) {
      this.geometry.destroy();
      this.geometry = null;
    }
    // Note: Don't destroy textures as they might be shared
  }
}

/**
 * Scene management system for loading and organizing sprites.
 * Handles scene.json parsing, sprite instantiation, and categorization.
 */
export class SceneManager {
  private sprites: Map<string, SceneSprite> = new Map();
  private pixiContainer: any = null;
  private canvasWidth: number = 800; // Default fallback
  private canvasHeight: number = 600; // Default fallback
  
  /**
   * Set canvas dimensions for shadow buffer calculations
   */
  setCanvasDimensions(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * Loads complete scene from JSON configuration.
   * Instantiates all sprites and loads their textures asynchronously.
   */
  async loadScene(sceneData: any): Promise<void> {
    // Clean slate for new scene
    this.sprites.clear();
    
    // Parallel sprite creation and texture loading
    for (const [key, spriteData] of Object.entries(sceneData.scene)) {
      const sprite = new SceneSprite(key, spriteData as SpriteDefinition);
      await sprite.loadTextures();
      this.sprites.set(key, sprite);
    }
  }

  getSprite(id: string): SceneSprite | undefined {
    return this.sprites.get(id);
  }

  getAllSprites(): SceneSprite[] {
    return Array.from(this.sprites.values());
  }

  // Set the PIXI container reference for direct updates
  setPixiContainer(container: any): void {
    this.pixiContainer = container;
    console.log('🎭 SceneManager: PIXI container reference set');
  }

  /**
   * Update existing sprites from new configuration without full rebuild
   */
  updateFromConfig(sceneData: any, pixiContainer?: any): void {
    if (!sceneData.scene) return;
    
    let zOrderChanged = false;
    
    // Update each sprite that exists in both old and new configs
    for (const [key, newSpriteData] of Object.entries(sceneData.scene)) {
      const existingSprite = this.sprites.get(key);
      if (existingSprite) {
        // Update the sprite's definition
        const newDef = newSpriteData as SpriteDefinition;
        const wasVisible = existingSprite.definition.visible;
        const oldZOrder = existingSprite.definition.zOrder;
        existingSprite.definition = { ...existingSprite.definition, ...newDef };
        
        // Handle visibility changes that require mesh creation/destruction
        const isNowVisible = newDef.visible ?? true;
        
        if (!wasVisible && isNowVisible && !existingSprite.mesh) {
          // Sprite was invisible and now visible but has no mesh - flag for recreation
          existingSprite.needsMeshCreation = true;
        } else if (existingSprite.mesh) {
          // Check what properties changed
          const posChanged = JSON.stringify(newDef.position) !== JSON.stringify(existingSprite.definition.position);
          const rotChanged = newDef.rotation !== existingSprite.definition.rotation;
          const scaleChanged = newDef.scale !== existingSprite.definition.scale;
          const normalMapChanged = newDef.useNormalMap !== existingSprite.definition.useNormalMap;
          
          // Update existing mesh
          existingSprite.updateTransform({
            position: newDef.position,
            rotation: newDef.rotation,
            scale: newDef.scale
          });
          
          // Handle normal map changes by recreating textures
          if (normalMapChanged) {
            console.log(`🎨 Normal map changed for ${existingSprite.id}: ${existingSprite.definition.useNormalMap} → ${newDef.useNormalMap}`);
            // Recreate normal texture based on new setting
            if (newDef.useNormalMap && newDef.normal && newDef.normal !== '') {
              existingSprite.normalTexture = PIXI.Texture.from(newDef.normal);
            } else {
              existingSprite.normalTexture = existingSprite['createFlatNormalTexture']();
            }
            // Update shader uniform
            if (existingSprite.shader) {
              existingSprite.shader.uniforms.uNormalMap = existingSprite.normalTexture;
            }
          }
          
          // Update zIndex for z-ordering (this triggers PIXI to re-sort children)
          if (newDef.zOrder !== undefined && existingSprite.mesh.zIndex !== newDef.zOrder) {
            existingSprite.mesh.zIndex = newDef.zOrder;
            zOrderChanged = true;
            console.log(`🎭 Updated zIndex for ${existingSprite.id}: ${oldZOrder} → ${newDef.zOrder}`);
          }
          
          // Update visibility
          existingSprite.mesh.visible = isNowVisible;
          
          // Log all the changes
          if (posChanged || rotChanged || scaleChanged || normalMapChanged) {
            console.log(`🔄 Real-time update for ${existingSprite.id}: pos(${posChanged}) rot(${rotChanged}) scale(${scaleChanged}) normal(${normalMapChanged})`);
          }
        }
      }
    }
    
    // Force immediate re-sort if zOrder changed
    const containerToUse = pixiContainer || this.pixiContainer;
    if (zOrderChanged && containerToUse) {
      containerToUse.sortChildren();
      console.log('🎭 IMMEDIATE: PIXI container re-sorted after zOrder change!');
    } else if (zOrderChanged) {
      console.log('⚠️ zOrder changed but no PIXI container available for sorting!');
    }
  }

  // Filter sprites by shadow participation flags and sort by zOrder
  // Includes off-screen sprites that can cast shadows into visible area (expanded shadow buffer)
  getShadowCasters(): SceneSprite[] {
    const SHADOW_BUFFER = 512; // Must match PixiDemo.tsx constant
    
    return this.getAllSprites()
      .filter(sprite => {
        if (!sprite.definition.castsShadows) return false;
        
        // Always include visible sprites (they cast shadows if within canvas)
        if (sprite.definition.visible) return true;
        
        // For invisible sprites, only include if they're OFF-SCREEN but within shadow buffer
        const bounds = sprite.getBounds();
        const spriteRight = bounds.x + bounds.width;
        const spriteBottom = bounds.y + bounds.height;
        
        // Check if sprite is completely outside visible canvas
        const outsideVisibleCanvas = (
          spriteRight < 0 || // Completely to the left
          bounds.x > this.canvasWidth || // Completely to the right
          spriteBottom < 0 || // Completely above
          bounds.y > this.canvasHeight // Completely below
        );
        
        // If invisible sprite is outside visible canvas, check if within shadow buffer
        if (outsideVisibleCanvas) {
          const withinShadowBuffer = (
            spriteRight >= -SHADOW_BUFFER && // Within left buffer
            bounds.x <= this.canvasWidth + SHADOW_BUFFER && // Within right buffer  
            spriteBottom >= -SHADOW_BUFFER && // Within top buffer
            bounds.y <= this.canvasHeight + SHADOW_BUFFER // Within bottom buffer
          );
          return withinShadowBuffer;
        }
        
        // Invisible sprites within visible canvas should NOT cast shadows
        return false;
      })
      .sort((a, b) => a.definition.zOrder - b.definition.zOrder);
  }


  // Get sprites sorted by zOrder (lowest to highest = back to front)
  getSpritesSortedByZOrder(): SceneSprite[] {
    return this.getAllSprites().sort((a, b) => a.definition.zOrder - b.definition.zOrder);
  }
  
  // Legacy method kept for backward compatibility, now returns all sprites
  getSprites(): SceneSprite[] {
    return this.getAllSprites();
  }

  destroy(): void {
    this.sprites.forEach(sprite => sprite.destroy());
    this.sprites.clear();
  }
}