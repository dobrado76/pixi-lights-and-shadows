import * as PIXI from 'pixi.js';

export interface SpriteDefinition {
  id: string;
  type: 'background' | 'sprite';
  image: string;
  normal: string;
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  castsShadows: boolean;
  receiveShadows: boolean;
}

export interface SpriteTransform {
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
}

export class SceneSprite {
  public definition: SpriteDefinition;
  public mesh: PIXI.Mesh | null = null;
  public shader: PIXI.Shader | null = null;
  public geometry: PIXI.Geometry | null = null;
  public diffuseTexture: PIXI.Texture | null = null;
  public normalTexture: PIXI.Texture | null = null;

  constructor(definition: SpriteDefinition) {
    this.definition = definition;
  }

  async loadTextures(): Promise<void> {
    this.diffuseTexture = PIXI.Texture.from(this.definition.image);
    this.normalTexture = PIXI.Texture.from(this.definition.normal);
    
    // Wait for textures to load
    await Promise.all([
      new Promise(resolve => {
        if (this.diffuseTexture!.baseTexture.valid) resolve(true);
        else this.diffuseTexture!.baseTexture.on('loaded', resolve);
      }),
      new Promise(resolve => {
        if (this.normalTexture!.baseTexture.valid) resolve(true);
        else this.normalTexture!.baseTexture.on('loaded', resolve);
      })
    ]);
  }

  createGeometry(): PIXI.Geometry {
    if (!this.diffuseTexture) throw new Error('Textures must be loaded before creating geometry');

    const { x, y } = this.definition.position;
    const width = this.diffuseTexture.width * this.definition.scale.x;
    const height = this.diffuseTexture.height * this.definition.scale.y;

    // Create sprite geometry with proper positioning and scaling
    const geometry = new PIXI.Geometry();
    
    // Apply rotation and scale transforms
    const cos = Math.cos(this.definition.rotation);
    const sin = Math.sin(this.definition.rotation);
    
    // Calculate transformed corners
    const corners = [
      { x: 0, y: 0 },           // Top-left
      { x: width, y: 0 },       // Top-right
      { x: width, y: height },  // Bottom-right
      { x: 0, y: height }       // Bottom-left
    ];

    // Apply rotation and translation
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
    const width = this.diffuseTexture.width * this.definition.scale.x;
    const height = this.diffuseTexture.height * this.definition.scale.y;

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

  // Get bounding box for shadow calculations
  getBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.diffuseTexture) throw new Error('Texture must be loaded to get bounds');
    
    const { x, y } = this.definition.position;
    const width = this.diffuseTexture.width * this.definition.scale.x;
    const height = this.diffuseTexture.height * this.definition.scale.y;
    
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
    if (transform.scale) {
      this.definition.scale = { ...this.definition.scale, ...transform.scale };
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

export class SceneManager {
  private sprites: Map<string, SceneSprite> = new Map();
  
  async loadScene(sceneData: any): Promise<void> {
    // Clear existing sprites
    this.sprites.clear();
    
    // Load all sprites from scene data
    for (const [key, spriteData] of Object.entries(sceneData.scene)) {
      const sprite = new SceneSprite(spriteData as SpriteDefinition);
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

  getShadowCasters(): SceneSprite[] {
    return this.getAllSprites().filter(sprite => sprite.definition.castsShadows);
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