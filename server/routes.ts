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

  // Save lights configuration to file
  app.post('/api/save-lights-config', async (req, res) => {
    try {
      const config = req.body;
      
      // Path to save the configuration file
      const configPath = path.join(process.cwd(), 'public', 'lights-config.json');
      
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
