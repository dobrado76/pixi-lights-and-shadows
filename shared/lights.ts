export type LightType = 'ambient' | 'point' | 'directional' | 'spotlight';

// Mask configuration interface
export interface MaskConfig {
  image: string;
  offset: { x: number; y: number };
  rotation: number; // degrees
  scale: number;
}

// JSON format from external config file  
export interface LightConfig {
  id: string;
  type: LightType;
  enabled: boolean;
  shadowConfig?: ShadowConfig; // Optional shadow configuration
  
  // Position properties
  x?: number;
  y?: number;
  z?: number;
  
  // Direction properties  
  directionX?: number;
  directionY?: number;
  directionZ?: number;
  angle?: number; // For directional lights
  
  // Appearance
  brightness: number;
  color: string; // Hex color like "0xFFFFFF"
  
  // Specific properties
  radius?: number;
  coneAngle?: number;
  softness?: number;
  followMouse?: boolean;
  castsShadows?: boolean; // Enable/disable shadow casting for this light
  mask?: MaskConfig; // mask configuration object
}

// Shadow configuration interface
export interface ShadowConfig {
  enabled: boolean;           // Global shadow enable/disable
  strength: number;          // Shadow opacity/darkness (0.0 - 1.0)  
  maxLength: number;         // Maximum shadow length (pixels)
  height: number;            // Shadow casting height (affects angle)
  // Removed shadow sharpness feature
}

// Internal runtime format
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
  
  // Special flags
  followMouse?: boolean;
  castsShadows?: boolean; // Enable/disable shadow casting for this light
  
  // Type-specific properties
  radius?: number;
  coneAngle?: number;
  softness?: number;
  
  // Mask properties
  mask?: MaskConfig; // mask configuration object
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
    castsShadows: true, // Enable shadows by default for all lights
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

// Convert hex color string to RGB values
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace('0x', '').replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255
  };
};

// Convert LightConfig from JSON to internal Light format
export const convertConfigToLight = (config: LightConfig): Light => {
  const light: Light = {
    id: config.id,
    type: config.type,
    enabled: config.enabled,
    position: {
      x: config.x || 0,
      y: config.y || 0,
      z: config.z || 0
    },
    direction: {
      x: config.directionX || 0,
      y: config.directionY || 0,
      z: config.directionZ || 0
    },
    color: hexToRgb(config.color),
    intensity: config.brightness,
    followMouse: config.followMouse,
    castsShadows: config.castsShadows !== undefined ? config.castsShadows : true // Default to true
  };

  // Handle directional light angle conversion
  if (config.type === 'directional' && config.angle !== undefined) {
    const direction = angleToDirection(config.angle);
    light.direction = direction;
  }

  // Add type-specific properties
  if (config.radius !== undefined) light.radius = config.radius;
  if (config.coneAngle !== undefined) light.coneAngle = config.coneAngle;
  if (config.softness !== undefined) light.softness = config.softness;
  if (config.mask !== undefined) {
    if (typeof config.mask === 'string') {
      // Handle legacy string format
      light.mask = {
        image: config.mask,
        offset: { x: 0, y: 0 },
        rotation: 0,
        scale: 1
      };
    } else {
      light.mask = config.mask;
    }
  }

  return light;
};

// Load lights configuration from JSON
export const loadLightsConfig = async (configPath: string = '/api/load-lights-config'): Promise<{lights: Light[], shadowConfig?: ShadowConfig}> => {
  try {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`Failed to load lights config: ${response.statusText}`);
    }
    
    const config = await response.json();
    
    // Always use the legacy converter since the API returns old format
    const lights: Light[] = [];
    for (const lightConfig of config.lights) {
      if (lightConfig.type !== 'ambient') { // Skip ambient for now since it's handled separately
        lights.push(convertConfigToLight(lightConfig));
      }
    }
    
    return {
      lights,
      shadowConfig: config.shadowConfig
    };
  } catch (error) {
    console.error('Error loading lights configuration:', error);
    // Return fallback lights
    return {
      lights: [
        createDefaultLight('point', 'mouse_light'),
        createDefaultLight('directional', 'directional_light'),
        createDefaultLight('spotlight', 'spotlight_1')
      ]
    };
  }
};

// Get ambient light setting from config
export const loadAmbientLight = async (configPath: string = '/api/load-lights-config'): Promise<{intensity: number, color: {r: number, g: number, b: number}}> => {
  try {
    const response = await fetch(configPath);
    if (!response.ok) return { intensity: 0.3, color: { r: 0.4, g: 0.4, b: 0.4 } };
    
    const config = await response.json();
    const ambientLight = config.lights.find((light: any) => light.type === 'ambient');
    
    if (ambientLight) {
      const color = typeof ambientLight.color === 'string' 
        ? hexToRgb(ambientLight.color)  // Convert hex string to RGB object
        : ambientLight.color || { r: 0.4, g: 0.4, b: 0.4 };
      
      return {
        intensity: ambientLight.brightness || 0.3,
        color
      };
    }
    
    return { intensity: 0.3, color: { r: 0.4, g: 0.4, b: 0.4 } };
  } catch (error) {
    return { intensity: 0.3, color: { r: 0.4, g: 0.4, b: 0.4 } };
  }
};

// Convert RGB values to hex color string
export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (val: number) => Math.round(val * 255).toString(16).padStart(2, '0');
  return `0x${toHex(r)}${toHex(g)}${toHex(b)}`;
};


// Convert internal Light format back to LightConfig for JSON
export const convertLightToConfig = (light: Light): LightConfig => {
  const config: LightConfig = {
    id: light.id,
    type: light.type,
    enabled: light.enabled,
    brightness: light.intensity,
    color: rgbToHex(light.color.r, light.color.g, light.color.b),
  };

  // Add position properties if relevant
  if (light.type === 'point' || light.type === 'spotlight') {
    config.x = light.position.x;
    config.y = light.position.y;
    config.z = light.position.z;
  }

  // Add direction properties if relevant  
  if (light.type === 'directional' || light.type === 'spotlight') {
    config.directionX = light.direction.x;
    config.directionY = light.direction.y;
    config.directionZ = light.direction.z;
  }

  // Add type-specific properties
  if (light.followMouse !== undefined) config.followMouse = light.followMouse;
  if (light.castsShadows !== undefined) config.castsShadows = light.castsShadows;
  if (light.radius !== undefined) config.radius = light.radius;
  if (light.coneAngle !== undefined) config.coneAngle = light.coneAngle;
  if (light.softness !== undefined) config.softness = light.softness;
  if (light.mask !== undefined) config.mask = light.mask;

  return config;
};

// Save lights configuration to server
export const saveLightsConfig = async (lights: Light[], ambientLight: {intensity: number, color: {r: number, g: number, b: number}}, shadowConfig?: ShadowConfig): Promise<boolean> => {
  try {
    // Convert lights back to config format
    const lightConfigs = lights.map(convertLightToConfig);
    
    // Add ambient light with proper color conversion
    const ambientConfig: LightConfig = {
      id: 'ambient_light',
      type: 'ambient',
      enabled: true,
      brightness: ambientLight.intensity,
      color: rgbToHex(ambientLight.color.r, ambientLight.color.g, ambientLight.color.b)
    };
    
    const config: any = {
      lights: [ambientConfig, ...lightConfigs]
    };

    // Include shadow configuration if provided
    if (shadowConfig) {
      config.shadowConfig = shadowConfig;
    }

    const response = await fetch('/api/save-lights-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    return response.ok;
  } catch (error) {
    console.error('Error saving lights configuration:', error);
    return false;
  }
};