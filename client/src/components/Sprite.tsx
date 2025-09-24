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
    
    // Handle normal mapping: check if normal mapping is enabled and texture is provided
    if (this.definition.useNormalMap && this.definition.normal && this.definition.normal !== '') {
      this.normalTexture = PIXI.Texture.from(this.definition.normal);
    } else {
      // Generate proper flat normal (RGB 128,128,255 = normal vector [0,0,1])
      // Used when normal mapping is disabled or no normal texture is provided
      this.normalTexture = this.createFlatNormalTexture();
    }
    
    // Wait for textures to load
    const promises = [new Promise(resolve => {
      if (this.diffuseTexture!.baseTexture.valid) resolve(true);
      else this.diffuseTexture!.baseTexture.on('loaded', resolve);
    })];
    
    // Only wait for normal texture if it's not the generated flat texture
    if (this.definition.useNormalMap && this.definition.normal && this.definition.normal !== '') {
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
    const width = this.diffuseTexture.width * this.definition.scale;
    const height = this.diffuseTexture.height * this.definition.scale;

    // Build vertex buffer with transform matrix applied
    const geometry = new PIXI.Geometry();
    
    // Manual transform matrix application for precise vertex positioning
    const cos = Math.cos(this.definition.rotation);
    const sin = Math.sin(this.definition.rotation);
    
    // Local space quad corners before transformation
    const corners = [
      { x: 0, y: 0 },           // Top-left
      { x: width, y: 0 },       // Top-right
      { x: width, y: height },  // Bottom-right
      { x: 0, y: height }       // Bottom-left
    ];

    // Calculate pivot point based on definition (pivot-aware rotation)
    const pivot = this.definition.pivot || { preset: 'middle-center', offsetX: 0, offsetY: 0 };
    let pivotX = 0, pivotY = 0;
    
    switch (pivot.preset) {
      case 'top-left': pivotX = 0; pivotY = 0; break;
      case 'top-center': pivotX = width / 2; pivotY = 0; break;
      case 'top-right': pivotX = width; pivotY = 0; break;
      case 'middle-left': pivotX = 0; pivotY = height / 2; break;
      case 'middle-center': pivotX = width / 2; pivotY = height / 2; break;
      case 'middle-right': pivotX = width; pivotY = height / 2; break;
      case 'bottom-left': pivotX = 0; pivotY = height; break;
      case 'bottom-center': pivotX = width / 2; pivotY = height; break;
      case 'bottom-right': pivotX = width; pivotY = height; break;
      case 'offset': 
        pivotX = width / 2 + (pivot.offsetX || 0);
        pivotY = height / 2 + (pivot.offsetY || 0);
        break;
    }
    
    // Apply rotation matrix and translation around pivot point
    const transformedCorners = corners.map(corner => {
      // Offset from pivot
      const offsetX = corner.x - pivotX;
      const offsetY = corner.y - pivotY;
      
      // Rotate around pivot
      const rotatedX = offsetX * cos - offsetY * sin;
      const rotatedY = offsetX * sin + offsetY * cos;
      
      return {
        x: x + pivotX + rotatedX,
        y: y + pivotY + rotatedY
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

    const shaderUniforms = {
      uDiffuse: this.diffuseTexture,
      uNormal: this.normalTexture,
      uSpritePos: [x, y],
      uSpriteSize: [width, height],
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

  // Filter sprites by shadow participation flags
  getShadowCasters(): SceneSprite[] {
    return this.getAllSprites().filter(sprite => 
      sprite.definition.castsShadows && sprite.definition.visible
    );
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