import * as PIXI from 'pixi.js';

/**
 * Scene and sprite management system for PIXI.js applications.
 * Handles texture loading, geometry creation, shader compilation, and transform management.
 * Supports normal mapping with automatic flat normal generation for sprites without normal maps.
 */

// External sprite configuration format (from scene.json)
export interface SpriteDefinition {
  type: 'background' | 'sprite';
  image: string;
  normal?: string;                    // Optional normal map texture
  position?: { x: number; y: number };
  rotation?: number;                  // Radians
  scale?: number;
  castsShadows?: boolean;             // Participates in shadow casting
  receiveShadows?: boolean;           // Receives shadows from other sprites
  visible?: boolean;                  // Controls sprite visibility without deletion
}

// Internal interface with defaults applied - all fields guaranteed to exist
interface CompleteSpriteDefinition {
  type: 'background' | 'sprite';
  image: string;
  normal: string;                     // Always present (empty string = auto-generate flat normal)
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  castsShadows: boolean;
  receiveShadows: boolean;
  visible: boolean;
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

  constructor(id: string, definition: SpriteDefinition) {
    this.id = id;
    // Normalize sprite definition by applying sensible defaults
    this.definition = {
      type: definition.type,
      image: definition.image,
      normal: definition.normal || '',                 // Empty = generate flat normal
      position: definition.position || { x: 0, y: 0 }, // Top-left origin
      rotation: definition.rotation || 0,              // No rotation
      scale: definition.scale || 1,                    // 1:1 pixel scale
      castsShadows: definition.castsShadows ?? true,   // Most sprites cast shadows
      receiveShadows: definition.receiveShadows ?? true, // Most sprites receive shadows
      visible: definition.visible ?? true              // Visible by default
    };
  }

  /**
   * Loads diffuse and normal textures asynchronously.
   * Generates flat normal texture for sprites without normal maps.
   */
  async loadTextures(): Promise<void> {
    this.diffuseTexture = PIXI.Texture.from(this.definition.image);
    
    // Handle normal mapping: use provided texture or generate flat normal
    if (this.definition.normal && this.definition.normal !== '') {
      this.normalTexture = PIXI.Texture.from(this.definition.normal);
    } else {
      // Generate proper flat normal (RGB 128,128,255 = normal vector [0,0,1])
      this.normalTexture = this.createFlatNormalTexture();
    }
    
    // Wait for textures to load
    const promises = [new Promise(resolve => {
      if (this.diffuseTexture!.baseTexture.valid) resolve(true);
      else this.diffuseTexture!.baseTexture.on('loaded', resolve);
    })];
    
    // Only wait for normal texture if it's not the default white texture
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

    // Apply rotation matrix and translation to each corner
    const transformedCorners = corners.map(corner => ({
      x: x + corner.x * cos - corner.y * sin,
      y: y + corner.x * sin + corner.y * cos
    }));

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

    // Recreate geometry and update shader uniforms if mesh exists
    if (this.mesh && this.shader) {
      const bounds = this.getBounds();
      this.shader.uniforms.uSpritePos = [bounds.x, bounds.y];
      this.shader.uniforms.uSpriteSize = [bounds.width, bounds.height];
      
      // Recreate geometry with new transform
      this.createGeometry();
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

  // Filter sprites by shadow participation flags
  getShadowCasters(): SceneSprite[] {
    return this.getAllSprites().filter(sprite => 
      sprite.definition.castsShadows && sprite.definition.visible
    );
  }

  getShadowReceivers(): SceneSprite[] {
    return this.getAllSprites().filter(sprite => sprite.definition.receiveShadows);
  }

  getBackground(): SceneSprite | undefined {
    return this.getAllSprites().find(sprite => sprite.definition.type === 'background');
  }

  getSprites(): SceneSprite[] {
    return this.getAllSprites().filter(sprite => sprite.definition.type === 'sprite');
  }

  destroy(): void {
    this.sprites.forEach(sprite => sprite.destroy());
    this.sprites.clear();
  }
}