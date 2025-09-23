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

  // Load lights configuration from file
  app.get('/api/load-lights-config', async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'client', 'public', 'lights-config.json');
      
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
              position: { x: 200, y: 150, z: 0 },
              direction: { x: 0, y: 0, z: -1 },
              color: { r: 1, g: 1, b: 1 },
              intensity: 1,
              radius: 200
            },
            {
              id: "directional_light", 
              type: "directional",
              enabled: true,
              position: { x: 200, y: 150, z: 0 },
              direction: { x: 1, y: 1, z: -1 },
              color: { r: 1, g: 1, b: 1 },
              intensity: 0.5
            },
            {
              id: "spotlight_1",
              type: "spotlight", 
              enabled: true,
              position: { x: 200, y: 150, z: 100 },
              direction: { x: 0, y: 0, z: -1 },
              color: { r: 1, g: 1, b: 1 },
              intensity: 2,
              radius: 150,
              coneAngle: 30,
              softness: 0.5
            },
            {
              type: "ambient",
              brightness: 0.3,
              color: { r: 0.4, g: 0.4, b: 0.4 }
            }
          ]
        };
        return res.json(defaultConfig);
      }
      
      // Read and return the saved configuration
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
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

  // Save lights configuration to file
  app.post('/api/save-lights-config', async (req, res) => {
    try {
      const config = req.body;
      
      // Path to save the configuration file
      const configPath = path.join(process.cwd(), 'client', 'public', 'lights-config.json');
      
      // Write the configuration to the JSON file
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
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

  const httpServer = createServer(app);

  return httpServer;
}
