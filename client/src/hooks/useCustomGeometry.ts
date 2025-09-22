import { useMemo } from 'react';
import * as PIXI from 'pixi.js';

export const useCustomGeometry = (width: number, height: number) => {
  return useMemo(() => {
    const geometry = new PIXI.Geometry();
    
    // Create fullscreen quad vertices
    const vertices = [
      0, 0,           // top-left
      width, 0,       // top-right
      width, height,  // bottom-right
      0, height       // bottom-left
    ];
    
    // UV coordinates for texture mapping
    const uvs = [
      0, 0,    // top-left
      1, 0,    // top-right
      1, 1,    // bottom-right
      0, 1     // bottom-left
    ];
    
    // Triangle indices
    const indices = [0, 1, 2, 0, 2, 3];
    
    geometry.addAttribute('aVertexPosition', vertices, 2);
    geometry.addAttribute('aTextureCoord', uvs, 2);
    geometry.addIndex(indices);
    
    return geometry;
  }, [width, height]);
};
