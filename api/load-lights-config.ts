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
      // File doesn't exist, return default configuration
      const defaultConfig = {
        lights: [
          {
            id: "mouse_light",
            type: "point",
            enabled: true,
            followMouse: true,
            position: { x: 200, y: 150, z: 10 },
            color: { r: 1, g: 1, b: 1 },
            intensity: 1,
            radius: 200,
            castsShadows: false
          },
          {
            id: "directional_light", 
            type: "directional",
            enabled: true,
            position: { x: 0, y: 0, z: 0 },
            direction: { x: 0.42261826174069944, y: 0.9063077870366499, z: -1 },
            color: { r: 1, g: 1, b: 1 },
            intensity: 0.3,
            castsShadows: true
          },
          {
            id: "spotlight_1",
            type: "spotlight", 
            enabled: false,
            position: { x: 200, y: 150, z: 100 },
            direction: { x: 0, y: 0, z: -1 },
            color: { r: 1, g: 1, b: 1 },
            intensity: 2,
            radius: 150,
            coneAngle: 30,
            softness: 0.5,
            castsShadows: false
          },
          {
            id: "point_light_2",
            type: "point",
            enabled: false,
            position: { x: 400, y: 300, z: 10 },
            color: { r: 0.2, g: 0.8, b: 1 },
            intensity: 1.2,
            radius: 250,
            castsShadows: false
          }
        ],
        shadowConfig: {
          enabled: true,
          strength: 0.7,
          maxLength: 200,
          height: 10
        }
      };
      return res.json(defaultConfig);
    }
    
    // Read and return the lights configuration from scene file
    const configData = await fs.readFile(configPath, 'utf8');
    const sceneConfig = JSON.parse(configData);
    
    // Extract lights and shadowConfig from the scene file
    const config = {
      lights: sceneConfig.lights || [],
      shadowConfig: sceneConfig.shadowConfig || {
        enabled: true,
        strength: 0.5,
        maxLength: 300,
        height: 10,
        sharpness: 1
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Error loading lights configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}