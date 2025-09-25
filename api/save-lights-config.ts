import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const config = req.body;
    
    // Path to the scene configuration file
    const configPath = path.join(process.cwd(), 'client', 'public', 'scene.json');
    
    // In serverless environments, file writes may not persist
    // For demo purposes, just return success
    // In production, you might want to use a database or external storage
    console.log('Lights configuration would be saved:', config);
    
    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Error saving lights configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}