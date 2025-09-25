import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const configPath = path.join(process.cwd(), 'client', 'public', 'scene.json');
    
    // Check if file exists
    try {
      await fs.access(configPath);
    } catch {
      // File doesn't exist, return default scene configuration
      const defaultScene = {
        scene: {
          background2: {
            type: "background",
            image: "/textures/BGTextureTest.jpg",
            normal: "/textures/BGTextureNORM.jpg",
            position: { x: 0, y: 0 },
            rotation: 0,
            scale: 1,
            castsShadows: false,
            receiveShadows: true,
            visible: true,
            useNormalMap: true,
            zIndex: -1
          },
          ball: {
            type: "sprite",
            image: "/textures/ball.png", 
            normal: "/textures/ballN.png",
            position: { x: 120, y: 80 },
            rotation: 0,
            scale: 1,
            castsShadows: true,
            receiveShadows: true,
            visible: true,
            useNormalMap: true,
            zIndex: 0
          },
          block: {
            type: "sprite",
            image: "/textures/block.png",
            normal: "/textures/blockNormalMap.jpg", 
            position: { x: 280, y: 120 },
            rotation: 0,
            scale: 1,
            castsShadows: true,
            receiveShadows: true,
            visible: true,
            useNormalMap: true,
            zIndex: 0
          },
          block2: {
            type: "sprite",
            image: "/textures/block2.png",
            normal: "/textures/block2NormalMap.png",
            position: { x: 200, y: 320 },
            rotation: 0,
            scale: 1,
            castsShadows: true,
            receiveShadows: true,
            visible: true,
            useNormalMap: true,
            zIndex: 0
          },
          test2: {
            type: "sprite", 
            image: "/textures/test2.png",
            normal: "/textures/test2Normal.png",
            position: { x: 84, y: 403 },
            rotation: 0,
            scale: 1,
            castsShadows: true,
            receiveShadows: true,
            visible: true,
            useNormalMap: true,
            zIndex: 1
          }
        }
      };
      return res.json(defaultScene);
    }
    
    // Read and return the saved scene configuration
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    res.json(config);
  } catch (error) {
    console.error('Error loading scene configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load scene configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}