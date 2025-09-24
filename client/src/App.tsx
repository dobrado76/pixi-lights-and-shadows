import { useState, useEffect, useCallback } from 'react';
import PixiDemo from './components/PixiDemo';
import DynamicLightControls from './components/DynamicLightControls';
import { DynamicSpriteControls } from './components/DynamicSpriteControls';
import { Light, ShadowConfig, loadLightsConfig, loadAmbientLight, saveLightsConfig } from '@shared/lights';

/**
 * Legacy shader parameters interface - maintained for backward compatibility.
 * Currently unused in the main lighting system which uses external JSON configuration.
 */
export interface ShaderParams {
  colorR: number;
  colorG: number;
  colorB: number;
  
  // Material properties
  normalMapIntensity: number;
  specularPower: number;
  specularIntensity: number;
  metallic: number;
  roughness: number;
  // Animation controls
  timeMultiplier: number;
  animationEnabled: boolean;
  // Post-processing effects
  contrast: number;
  saturation: number;
  brightness: number;
  // Texture controls
  uvScaleX: number;
  uvScaleY: number;
  uvOffsetX: number;
  uvOffsetY: number;
  // Advanced lighting
  rimLightIntensity: number;
  rimLightPower: number;
  // Resolution controls
  canvasWidth: number;
  canvasHeight: number;
}

function App() {
  // External JSON-based lighting configuration system
  // Lights are loaded from lights-config.json and auto-saved on changes
  const [lightsConfig, setLightsConfig] = useState<Light[]>([]);
  const [ambientLight, setAmbientLight] = useState<{intensity: number, color: {r: number, g: number, b: number}}>({
    intensity: 0.3,
    color: { r: 0.4, g: 0.4, b: 0.4 }
  });
  const [lightsLoaded, setLightsLoaded] = useState<boolean>(false);
  
  // Shadow configuration state
  // Global shadow configuration applied to all shadow-casting lights
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>({
    enabled: true,
    strength: 0.7,        // 70% shadow opacity across all shadows
    maxLength: 200,       // Maximum projection distance for shadow geometry
    height: 10,           // Z-height used for shadow volume calculations
    // Shadow sharpness removed - caused visual artifacts
  });

  // Scene configuration state - sprites loaded from scene.json
  const [sceneConfig, setSceneConfig] = useState<{ scene: Record<string, any> }>({ scene: {} });
  const [sceneLoaded, setSceneLoaded] = useState<boolean>(false);
  

  // Auto-save system with debouncing to prevent excessive writes during UI manipulation
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback((lights: Light[], ambient: {intensity: number, color: {r: number, g: number, b: number}}, shadows?: ShadowConfig) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        const success = await saveLightsConfig(lights, ambient, shadows);
        if (success) {
          console.log('Lights configuration auto-saved successfully');
        } else {
          console.warn('Failed to auto-save lights configuration');
        }
      } catch (error) {
        console.error('Error auto-saving lights configuration:', error);
      }
    }, 500); // 500ms debounce prevents save spam during slider adjustments
    
    setSaveTimeout(timeout);
  }, [saveTimeout]);

  // Auto-save system for scene configuration
  const [sceneTimeout, setSceneTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedSceneSave = useCallback((sceneData: { scene: Record<string, any> }) => {
    if (sceneTimeout) {
      clearTimeout(sceneTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/save-scene-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sceneData)
        });
        
        if (response.ok) {
          console.log('Scene configuration auto-saved successfully');
        } else {
          console.warn('Failed to auto-save scene configuration');
        }
      } catch (error) {
        console.error('Error auto-saving scene configuration:', error);
      }
    }, 500); // 500ms debounce
    
    setSceneTimeout(timeout);
  }, [sceneTimeout]);

  // Legacy shader params system - loads from localStorage for backward compatibility
  const getInitialParams = (): ShaderParams => {
    const saved = localStorage.getItem('pixiShaderParams');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load saved shader params:', e);
      }
    }
    return {
      colorR: 1,
      colorG: 1,
      colorB: 1,
      
      // Material properties
      normalMapIntensity: 1.0,
      specularPower: 32.0,
      specularIntensity: 0.5,
      metallic: 0.0,
      roughness: 0.5,
      // Animation controls
      timeMultiplier: 1.0,
      animationEnabled: true,
      // Post-processing effects
      contrast: 1.0,
      saturation: 1.0,
      brightness: 1.0,
      // Texture controls
      uvScaleX: 1.0,
      uvScaleY: 1.0,
      uvOffsetX: 0.0,
      uvOffsetY: 0.0,
      // Advanced lighting
      rimLightIntensity: 0.0,
      rimLightPower: 4.0,
      // Resolution controls
      canvasWidth: 800,
      canvasHeight: 600
    };
  };

  const [shaderParams, setShaderParams] = useState<ShaderParams>(getInitialParams());

  const [geometryStatus, setGeometryStatus] = useState('Initializing...');
  const [shaderStatus, setShaderStatus] = useState('Initializing...');
  const [meshStatus, setMeshStatus] = useState('Initializing...');

  // Bootstrap: Load lighting and scene configuration from external JSON files on app start
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        const [lightsResult, ambientLightData, sceneResult] = await Promise.all([
          loadLightsConfig(),
          loadAmbientLight(),
          fetch('/api/load-scene-config').then(res => res.json())
        ]);
        
        setLightsConfig(lightsResult.lights);
        setAmbientLight(ambientLightData);
        setSceneConfig(sceneResult);
        
        // Merge saved shadow config with defaults - maintains backward compatibility
        if (lightsResult.shadowConfig) {
          setShadowConfig(lightsResult.shadowConfig);
        }
        
        setLightsLoaded(true);
        setSceneLoaded(true);
        console.log('Loaded configurations:', { lights: lightsResult, scene: sceneResult });
      } catch (error) {
        console.error('Failed to load configurations:', error);
        setLightsLoaded(true); // Still set to true to proceed with fallbacks
        setSceneLoaded(true);
      }
    };
    
    loadConfigurations();
  }, []);

  // Auto-save shader params to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pixiShaderParams', JSON.stringify(shaderParams));
  }, [shaderParams]);

  // Handler for lights configuration changes
  const handleLightsChange = useCallback((newLights: Light[]) => {
    setLightsConfig(newLights);
    debouncedSave(newLights, ambientLight, shadowConfig);
  }, [ambientLight, shadowConfig, debouncedSave]);

  // Handler for ambient light changes
  const handleAmbientChange = useCallback((newAmbient: {intensity: number, color: {r: number, g: number, b: number}}) => {
    setAmbientLight(newAmbient);
    debouncedSave(lightsConfig, newAmbient, shadowConfig);
  }, [lightsConfig, shadowConfig, debouncedSave]);

  // Handler for shadow configuration changes
  const handleShadowConfigChange = useCallback((newShadowConfig: ShadowConfig) => {
    setShadowConfig(newShadowConfig);
    debouncedSave(lightsConfig, ambientLight, newShadowConfig);
  }, [lightsConfig, ambientLight, debouncedSave]);

  // Handler for scene configuration changes
  const handleSceneConfigChange = useCallback((newSceneConfig: { scene: Record<string, any> }) => {
    setSceneConfig(newSceneConfig);
    debouncedSceneSave(newSceneConfig);
  }, [debouncedSceneSave]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="app-title">
                PIXI.js 2.5D Advanced Light and Shadow System
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="app-subtitle">
                A comprehensive React.js application showcasing advanced pseudo-3D shadow casting using PIXI.js primitives
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground" data-testid="library-badge">
                @pixi/react
              </span>
              <div className="w-2 h-2 rounded-full bg-accent" data-testid="status-indicator"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - PIXI Demo */}
          <div className="space-y-6">
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-card-foreground" data-testid="demo-title">
                  Live Demo
                </h2>
              </div>

              <div className="pixi-canvas rounded-lg overflow-hidden glow" data-testid="pixi-container">
                {lightsLoaded && (
                  <PixiDemo
                    shaderParams={shaderParams}
                    lightsConfig={lightsConfig}
                    ambientLight={ambientLight}
                    shadowConfig={shadowConfig}
                    onGeometryUpdate={setGeometryStatus}
                    onShaderUpdate={setShaderStatus}
                    onMeshUpdate={setMeshStatus}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Controls and Code */}
          <div className="space-y-6">
            {/* Dynamic Light Controls */}
            {lightsLoaded && (
              <DynamicLightControls
                lights={lightsConfig}
                ambientLight={ambientLight}
                shadowConfig={shadowConfig}
                onLightsChange={handleLightsChange}
                onAmbientChange={handleAmbientChange}
                onShadowConfigChange={handleShadowConfigChange}
              />
            )}

            {/* Dynamic Sprite Controls */}
            {sceneLoaded && (
              <DynamicSpriteControls
                sceneConfig={sceneConfig}
                onSceneConfigChange={handleSceneConfigChange}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
