import React, { useState, useCallback, useEffect } from 'react';
import { Stage, Container, Sprite } from '@pixi/react';
import { Assets, Texture } from 'pixi.js';
import { PostProcessingSystem } from '../core/systems/PostProcessingSystem';

interface PixiLightTestWidgetProps {
  config?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    diffuse?: string;
    normal?: string;
  };
  tooltip?: string;
  style?: string;
}

const PixiLightTestWidget: React.FC<PixiLightTestWidgetProps> = ({
  config = {},
  tooltip = "PIXI Lighting Test - NO PIXI.Filter - Custom Shader Mesh",
  style = "default"
}) => {
  const {
    width = 800,
    height = 600,
    backgroundColor = "0x000000",
    diffuse = "/Breakout_assets/images/BGTextureTest.jpg",
    normal = "/Breakout_assets/images/BGTextureNORM.jpg"
  } = config;

  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightPosition, setLightPosition] = useState({ x: width / 2, y: height / 2 });
  
  // Texture states
  const [diffuseTexture, setDiffuseTexture] = useState<Texture | null>(null);
  const [ballTexture, setBallTexture] = useState<Texture | null>(null);
  const [blockTexture, setBlockTexture] = useState<Texture | null>(null);

  // Load textures
  useEffect(() => {
    const loadTextures = async () => {
      try {
        setError(null);
        console.log('PixiLightTest: Loading textures - NO PIXI.Filter approach...');
        
        // Load all textures
        const [loadedDiffuse, loadedBall, loadedBlock] = await Promise.all([
          Assets.load(diffuse),
          Assets.load("/Breakout_assets/images/ball.png"),
          Assets.load("/Breakout_assets/images/block.png")
        ]);

        setDiffuseTexture(loadedDiffuse);
        setBallTexture(loadedBall);
        setBlockTexture(loadedBlock);
        
        console.log('PixiLightTest: Custom shader mesh lighting system initialized successfully');
        setIsLoaded(true);
      } catch (err) {
        console.error('PixiLightTest: Failed to load textures:', err);
        setError(`Failed to load textures: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    loadTextures();
  }, [diffuse]);

  // Handle mouse movement for light positioning
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('PixiLightTest: Mouse move detected at', x, y);
    setLightPosition({ x, y });
    
    // Update PostProcessingSystem mouse position via global reference
    if ((window as any).pixiPostProcessingMouse) {
      (window as any).pixiPostProcessingMouse(x, y);
    } else {
      console.log('PixiLightTest: Global mouse function not found!');
    }
  }, []);

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded p-4 text-red-300">
        <h3 className="font-semibold mb-2">PIXI Lighting Test Error</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8 bg-purple-900/20 rounded-lg border border-purple-500/30">
        <div className="text-purple-300">Loading PIXI custom shader mesh test...</div>
      </div>
    );
  }

  return (
    <div 
      className="relative bg-black rounded-lg border-2 border-purple-500/50 overflow-hidden shadow-xl"
      style={{ width, height }}
      onMouseMove={handleMouseMove}
      title={tooltip}
    >
      <Stage
        width={width}
        height={height}
        options={{
          backgroundColor: parseInt(backgroundColor as string, 16),
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        {/* PostProcessingSystem takes full control - sprites rendered via render-to-texture */}
        <PostProcessingSystem>{/* All sprites created internally via raw PIXI */}</PostProcessingSystem>
      </Stage>
      
      {/* UI overlay */}
      <div className="absolute bottom-4 left-4 text-white bg-black/50 px-3 py-1 rounded text-sm">
        💡 Move mouse to control light - Position: ({Math.round(lightPosition.x)}, {Math.round(lightPosition.y)})
      </div>
      
      <div className="absolute top-4 right-4 text-green-400 bg-black/50 px-3 py-1 rounded text-sm">
        ⚡ NO PIXI.Filter - Custom Shader Mesh | 🟢 Robust System Active
      </div>
    </div>
  );
};

export default PixiLightTestWidget;