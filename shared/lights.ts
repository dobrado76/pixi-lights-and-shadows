export type LightType = 'point' | 'directional' | 'spotlight';

export interface Light {
  id: string;
  type: LightType;
  enabled: boolean;
  
  // Position (used by point and spotlight)
  position: {
    x: number;
    y: number;
    z: number;
  };
  
  // Direction (used by directional and spotlight)
  direction: {
    x: number;
    y: number;
    z: number;
  };
  
  // Color and intensity
  color: {
    r: number;
    g: number;
    b: number;
  };
  intensity: number;
  
  // Point/Spotlight specific
  radius?: number;
  
  // Spotlight specific
  coneAngle?: number;
  softness?: number;
}

export const createDefaultLight = (type: LightType, id?: string): Light => {
  const baseLight: Light = {
    id: id || `light_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    enabled: true,
    position: { x: 200, y: 150, z: 0 },
    direction: { x: 0, y: 0, z: -1 },
    color: { r: 1, g: 1, b: 1 },
    intensity: 1.0,
  };

  switch (type) {
    case 'point':
      return {
        ...baseLight,
        radius: 200,
      };
      
    case 'directional':
      return {
        ...baseLight,
        direction: { x: 1, y: 1, z: -1 }, // Default angle equivalent to previous 315°
        intensity: 0.5,
      };
      
    case 'spotlight':
      return {
        ...baseLight,
        position: { x: 200, y: 150, z: 100 },
        radius: 150,
        coneAngle: 30,
        softness: 0.5,
        intensity: 2.0,
      };
      
    default:
      return baseLight;
  }
};

// Helper to convert angle to direction vector (for backward compatibility)
export const angleToDirection = (angle: number): { x: number; y: number; z: number } => {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
    z: -1,
  };
};

// Helper to convert direction vector to angle (for UI display)
export const directionToAngle = (direction: { x: number; y: number; z: number }): number => {
  const angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
};