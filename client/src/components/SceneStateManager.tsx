import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { Light, ShadowConfig, AmbientOcclusionConfig, loadLightsConfig, loadAmbientLight, saveLightsConfig } from '@/lib/lights';
import { PerformanceSettings } from '../utils/performance';

// IBL Config interface
export interface IBLConfig {
  enabled: boolean;
  intensity: number;
  environmentMap: string;
}

// Reflection Config interface
export interface ReflectionConfig {
  enabled: boolean;
  intensity: number;
  normalInfluence: number; // How much normals affect reflection sampling (0.0-1.0)
  blur: number; // Blur amount for reflections (0.0-1.0)
}

// Complete scene configuration interface
export interface SceneConfig {
  scene: Record<string, any>;
  lights?: Light[];
  performanceSettings?: PerformanceSettings & { manualOverride?: boolean };
  shadowConfig?: ShadowConfig;
  ambientOcclusionConfig?: AmbientOcclusionConfig;
  iblConfig?: IBLConfig;
  reflectionConfig?: ReflectionConfig;
}

// Context interface for the scene state manager
export interface SceneStateContextType {
  // State
  sceneConfig: SceneConfig;
  lightsConfig: Light[];
  ambientLight: {intensity: number, color: {r: number, g: number, b: number}};
  shadowConfig: ShadowConfig;
  ambientOcclusionConfig: AmbientOcclusionConfig;
  performanceSettings: PerformanceSettings & { manualOverride?: boolean };
  isLoaded: boolean;
  
  // Update functions
  updateSceneSprites: (newScene: Record<string, any>) => void;
  updateLights: (newLights: Light[]) => void;
  updateAmbientLight: (newAmbient: {intensity: number, color: {r: number, g: number, b: number}}) => void;
  updateShadowConfig: (newShadowConfig: ShadowConfig) => void;
  updateAmbientOcclusionConfig: (newAOConfig: AmbientOcclusionConfig) => void;
  updatePerformanceSettings: (newSettings: PerformanceSettings & { manualOverride?: boolean }) => void;
  updateIBLConfig: (newIBLConfig: IBLConfig) => void;
  updateReflectionConfig: (newReflectionConfig: ReflectionConfig) => void;
  
  // Immediate update for bypassing React state
  triggerImmediateSpriteChange: (spriteId: string, updates: any) => void;
}

// Create the context
const SceneStateContext = createContext<SceneStateContextType | null>(null);

// Hook to use the scene state context
export const useSceneState = () => {
  const context = useContext(SceneStateContext);
  return context;
};

interface SceneStateProviderProps {
  children: ReactNode;
}

export const SceneStateProvider = ({ children }: SceneStateProviderProps) => {
  
  // Core scene state
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>({ scene: {} });
  const [lightsConfig, setLightsConfig] = useState<Light[]>([]);
  const [ambientLight, setAmbientLight] = useState<{intensity: number, color: {r: number, g: number, b: number}}>({
    intensity: 0.3,
    color: { r: 0.4, g: 0.4, b: 0.4 }
  });
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>({
    enabled: true,
    strength: 0.7,
    maxLength: 120,
    height: 10,
  });
  const [ambientOcclusionConfig, setAmbientOcclusionConfig] = useState<AmbientOcclusionConfig>({
    enabled: true, // CRITICAL: Demo must show all features - default ON
    strength: 5.65,
    radius: 4,
    samples: 10,
    bias: 14,
  });
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings & { manualOverride?: boolean }>({
    quality: 'high',
    resolution: 1,
    maxLights: 128,
    enableShadows: true,
    enableAmbientOcclusion: true,
    enableNormalMapping: true,
    enableLightMasks: true,
    textureScale: 1,
    fpsTarget: 60,
    capFpsTo60: true,
    manualOverride: false
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Use refs to track timeouts and latest scene config (avoids recreating callbacks)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sceneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sceneConfigRef = useRef<SceneConfig>({ scene: {} });
  
  // Keep ref updated whenever sceneConfig changes
  useEffect(() => {
    sceneConfigRef.current = sceneConfig;
  }, [sceneConfig]);

  // Debounced save for lights configuration
  const debouncedSaveLights = useCallback((lights: Light[], ambient: {intensity: number, color: {r: number, g: number, b: number}}, currentScene: SceneConfig, shadows?: ShadowConfig) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const success = await saveLightsConfig(lights, ambient, shadows, currentScene);
        if (success) {
          console.log('Lights configuration auto-saved successfully');
        } else {
          console.warn('Failed to auto-save lights configuration');
        }
      } catch (error) {
        console.error('Error auto-saving lights configuration:', error);
      }
    }, 500);
  }, []);

  // Debounced save for scene configuration
  const debouncedSaveScene = useCallback((fullSceneData: SceneConfig) => {
    if (sceneTimeoutRef.current) {
      clearTimeout(sceneTimeoutRef.current);
    }
    
    sceneTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/save-scene-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullSceneData)
        });
        
        if (response.ok) {
          console.log('Scene configuration auto-saved successfully');
        } else {
          console.warn('Failed to auto-save scene configuration');
        }
      } catch (error) {
        console.error('Error auto-saving scene configuration:', error);
      }
    }, 500);
  }, []);

  // Load scene configuration from server (runs only once)
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        console.log('🔄 SceneStateManager: Loading configurations...');
        
        // Load scene data from API
        const sceneResult = await fetch('/api/load-scene-config').then(res => res.json());
        const lightsResult = await loadLightsConfig('/api/load-scene-config');
        const ambientLightData = await loadAmbientLight('/api/load-scene-config');
        
        // Update all state at once
        setSceneConfig(sceneResult);
        setLightsConfig(lightsResult.lights);
        setAmbientLight(ambientLightData);
        
        // Update configurations from loaded data
        if (lightsResult.shadowConfig) {
          setShadowConfig(lightsResult.shadowConfig);
        }
        
        if (sceneResult.ambientOcclusionConfig) {
          setAmbientOcclusionConfig(sceneResult.ambientOcclusionConfig);
        }

        if (sceneResult.performanceSettings) {
          setPerformanceSettings(sceneResult.performanceSettings);
        }
        
        setIsLoaded(true);
        console.log('✅ SceneStateManager: Configurations loaded successfully');
        
      } catch (error) {
        console.error('❌ SceneStateManager: Failed to load configurations:', error);
        setIsLoaded(true); // Still set to true to proceed with fallbacks
      }
    };
    
    loadConfigurations();
  }, []);

  // Update functions with auto-save
  const updateSceneSprites = useCallback((newScene: Record<string, any>) => {
    console.log('🔄 SceneStateManager: Updating scene sprites...', Object.keys(newScene));
    const updatedConfig = {
      ...sceneConfig,
      scene: newScene
    };
    setSceneConfig(updatedConfig);
    debouncedSaveScene(updatedConfig);
  }, [sceneConfig, debouncedSaveScene]);

  const updateLights = useCallback((newLights: Light[]) => {
    console.log('💡 SceneStateManager: Updating lights...', newLights.length);
    setLightsConfig(newLights);
    debouncedSaveLights(newLights, ambientLight, sceneConfigRef.current, shadowConfig);
  }, [ambientLight, shadowConfig, debouncedSaveLights]);

  const updateAmbientLight = useCallback((newAmbient: {intensity: number, color: {r: number, g: number, b: number}}) => {
    console.log('🌅 SceneStateManager: Updating ambient light...');
    setAmbientLight(newAmbient);
    debouncedSaveLights(lightsConfig, newAmbient, sceneConfigRef.current, shadowConfig);
  }, [lightsConfig, shadowConfig, debouncedSaveLights]);

  const updateShadowConfig = useCallback((newShadowConfig: ShadowConfig) => {
    console.log('👥 SceneStateManager: Updating shadow config...');
    setShadowConfig(newShadowConfig);
    debouncedSaveLights(lightsConfig, ambientLight, sceneConfigRef.current, newShadowConfig);
  }, [lightsConfig, ambientLight, debouncedSaveLights]);

  const updateAmbientOcclusionConfig = useCallback((newAOConfig: AmbientOcclusionConfig) => {
    console.log('🌫️ SceneStateManager: Updating AO config...');
    setAmbientOcclusionConfig(newAOConfig);
    
    const updatedConfig = {
      ...sceneConfig,
      ambientOcclusionConfig: newAOConfig
    };
    setSceneConfig(updatedConfig);
    debouncedSaveScene(updatedConfig);
  }, [sceneConfig, debouncedSaveScene]);

  const updatePerformanceSettings = useCallback((newSettings: PerformanceSettings & { manualOverride?: boolean }) => {
    console.log('⚡ SceneStateManager: Updating performance settings...');
    const settingsWithOverride = { ...newSettings, manualOverride: true };
    setPerformanceSettings(settingsWithOverride);
    
    const updatedConfig = {
      ...sceneConfig,
      performanceSettings: settingsWithOverride
    };
    setSceneConfig(updatedConfig);
    debouncedSaveScene(updatedConfig);
  }, [sceneConfig, debouncedSaveScene]);

  const updateIBLConfig = useCallback((newIBLConfig: IBLConfig) => {
    console.log('🌍 SceneStateManager: Updating IBL config...');
    
    const updatedConfig = {
      ...sceneConfig,
      iblConfig: newIBLConfig
    };
    setSceneConfig(updatedConfig);
    debouncedSaveScene(updatedConfig);
  }, [sceneConfig, debouncedSaveScene]);

  const updateReflectionConfig = useCallback((newReflectionConfig: ReflectionConfig) => {
    console.log('🪞 SceneStateManager: Updating Reflection config...');
    
    const updatedConfig = {
      ...sceneConfig,
      reflectionConfig: newReflectionConfig
    };
    setSceneConfig(updatedConfig);
    debouncedSaveScene(updatedConfig);
  }, [sceneConfig, debouncedSaveScene]);

  // Immediate sprite change function (bypasses React state for instant feedback)
  const triggerImmediateSpriteChange = useCallback((spriteId: string, updates: any) => {
    console.log(`🚀 SceneStateManager: Immediate sprite change for ${spriteId}:`, Object.keys(updates));
    
    // Call unified immediate update handler if available
    const immediateUpdate = (window as any).__pixiImmediateUpdate;
    if (immediateUpdate) {
      immediateUpdate(spriteId, updates);
    } else {
      console.log('⚠️ SceneStateManager: Immediate update handler not yet available');
    }
  }, []);

  const contextValue: SceneStateContextType = {
    // State
    sceneConfig,
    lightsConfig,
    ambientLight,
    shadowConfig,
    ambientOcclusionConfig,
    performanceSettings,
    isLoaded,
    
    // Update functions
    updateSceneSprites,
    updateLights,
    updateAmbientLight,
    updateShadowConfig,
    updateAmbientOcclusionConfig,
    updatePerformanceSettings,
    updateIBLConfig,
    updateReflectionConfig,
    triggerImmediateSpriteChange
  };

  return (
    <SceneStateContext.Provider value={contextValue}>
      {children}
    </SceneStateContext.Provider>
  );
};