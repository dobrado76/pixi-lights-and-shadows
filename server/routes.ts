import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { promises as fs } from "fs";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)


  // Load scene configuration from file
  app.get('/api/load-scene-config', async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'client', 'public', 'scene.json');
      
      // Check if file exists
      try {
        await fs.access(configPath);
      } catch {
        // File doesn't exist, return default scene configuration
        const defaultScene = {
          scene: {
            background: {
              type: "background",
              image: "/textures/BGTextureTest.jpg",
              normal: "/textures/BGTextureNORM.jpg",
              position: { x: 0, y: 0 },
              rotation: 0,
              scale: 1,
              castsShadows: false,
              receiveShadows: true,
              visible: true,
              useNormalMap: true
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
  });

  // Save scene configuration to file
  app.post('/api/save-scene-config', async (req, res) => {
    try {
      const config = req.body;
      const configPath = path.join(process.cwd(), 'client', 'public', 'scene.json');
      
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
