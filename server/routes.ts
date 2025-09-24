import type { Express } from "express";
import { createServer, type Server } from "http";
import { promises as fs } from "fs";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // PIXI.js demo API routes - only for loading/saving configuration files

  // Load lights configuration from scene file
  app.get('/api/load-lights-config', async (req, res) => {
    try {
      // Try multiple possible paths for different deployment environments
      const possiblePaths = [
        path.join(process.cwd(), 'client', 'public', 'scene.json'), // Development
        path.join(process.cwd(), 'dist', 'scene.json'), // Production build
        path.join(process.cwd(), 'public', 'scene.json'), // Alternative production
        path.join(process.cwd(), 'scene.json') // Root fallback
      ];
      
      let configPath: string | null = null;
      let sceneConfig: any = null;
      
      // Try each possible path until we find the file
      for (const testPath of possiblePaths) {
        try {
          await fs.access(testPath);
          configPath = testPath;
          const configData = await fs.readFile(testPath, 'utf8');
          sceneConfig = JSON.parse(configData);
          break;
        } catch {
          continue;
        }
      }
      
      // If no file found, return comprehensive default configuration
      if (!sceneConfig) {
        // Comprehensive default configuration with scene data
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
      
      // Extract lights and shadowConfig from the loaded scene file
      const config = {
        lights: sceneConfig.lights || [],
        shadowConfig: sceneConfig.shadowConfig || {
          enabled: true,
          strength: 0.7,
          maxLength: 200,
          height: 10
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
  });

  // Save lights configuration to scene file
  app.post('/api/save-lights-config', async (req, res) => {
    try {
      const config = req.body;
      
      // Path to the scene configuration file (fix for Vercel deployment)
      const configPath = process.env.NODE_ENV === 'production' 
        ? path.join(process.cwd(), 'dist', 'scene.json')
        : path.join(process.cwd(), 'client', 'public', 'scene.json');
      
      // Read the existing scene configuration
      let sceneConfig: any = {};
      try {
        const existingData = await fs.readFile(configPath, 'utf8');
        sceneConfig = JSON.parse(existingData);
      } catch {
        // If file doesn't exist or is invalid, start with empty config
      }
      
      // Update the lights and shadowConfig in the scene configuration
      sceneConfig.lights = config.lights;
      sceneConfig.shadowConfig = config.shadowConfig;
      
      // Write the updated scene configuration back to the file
      await fs.writeFile(configPath, JSON.stringify(sceneConfig, null, 2), 'utf8');
      
      res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
      console.error('Error saving lights configuration:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Load scene configuration from file
  app.get('/api/load-scene-config', async (req, res) => {
    try {
      // Try multiple possible paths for different deployment environments
      const possiblePaths = [
        path.join(process.cwd(), 'client', 'public', 'scene.json'), // Development
        path.join(process.cwd(), 'dist', 'scene.json'), // Production build
        path.join(process.cwd(), 'public', 'scene.json'), // Alternative production
        path.join(process.cwd(), 'scene.json') // Root fallback
      ];
      
      let config: any = null;
      
      // Try each possible path until we find the file
      for (const testPath of possiblePaths) {
        try {
          await fs.access(testPath);
          const configData = await fs.readFile(testPath, 'utf8');
          config = JSON.parse(configData);
          break;
        } catch {
          continue;
        }
      }
      
      // If no file found, return comprehensive default scene configuration
      if (!config) {
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
      
      res.json(config);
    } catch (error) {
      console.error('Error loading scene configuration:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to load scene configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Save scene configuration to file
  app.post('/api/save-scene-config', async (req, res) => {
    try {
      const config = req.body;
      // Fix path resolution for Vercel deployment
      const configPath = process.env.NODE_ENV === 'production' 
        ? path.join(process.cwd(), 'dist', 'scene.json')
        : path.join(process.cwd(), 'client', 'public', 'scene.json');
      
      // Ensure the directory exists
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write the configuration
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
      res.json({ success: true, message: 'Scene configuration saved successfully' });
    } catch (error) {
      console.error('Error saving scene configuration:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save scene configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
