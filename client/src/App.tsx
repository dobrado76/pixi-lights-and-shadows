import { useState, useEffect, useCallback } from 'react';
import PixiDemo from './components/PixiDemo';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import CodeDisplay from './components/CodeDisplay';
import DynamicLightControls from './components/DynamicLightControls';
import { Light, ShadowConfig, loadLightsConfig, loadAmbientLight, saveLightsConfig } from '@shared/lights';

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
  // External lights configuration
  const [lightsConfig, setLightsConfig] = useState<Light[]>([]);
  const [ambientLight, setAmbientLight] = useState<{intensity: number, color: {r: number, g: number, b: number}}>({
    intensity: 0.3,
    color: { r: 0.4, g: 0.4, b: 0.4 }
  });
  const [lightsLoaded, setLightsLoaded] = useState<boolean>(false);
  
  // Shadow configuration state
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>({
    enabled: true,
    strength: 0.7,        // 70% shadow opacity
    maxLength: 200,       // Maximum shadow length in pixels
    height: 10            // Shadow casting height
  });
  

  // Debounced save function to prevent excessive saves
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback((lights: Light[], ambient: {intensity: number, color: {r: number, g: number, b: number}}, shadows?: ShadowConfig) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        const success = await saveLightsConfig(lights, ambient, shadows);
        if (success) {
          console.log('Configuration auto-saved successfully');
        } else {
          console.warn('Failed to auto-save configuration');
        }
      } catch (error) {
        console.error('Error auto-saving configuration:', error);
      }
    }, 500); // 500ms debounce
    
    setSaveTimeout(timeout);
  }, [saveTimeout]);

  // Load saved settings from localStorage or use defaults
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

  // Load lights configuration from external JSON
  useEffect(() => {
    const loadLights = async () => {
      try {
        const [lightsResult, ambientLightData] = await Promise.all([
          loadLightsConfig(),
          loadAmbientLight()
        ]);
        setLightsConfig(lightsResult.lights);
        setAmbientLight(ambientLightData);
        
        // Load shadowConfig if available, otherwise keep defaults
        if (lightsResult.shadowConfig) {
          setShadowConfig(lightsResult.shadowConfig);
        }
        
        setLightsLoaded(true);
        console.log('Loaded lights configuration:', lightsResult);
      } catch (error) {
        console.error('Failed to load lights configuration:', error);
        setLightsLoaded(true); // Still set to true to proceed with fallbacks
      }
    };
    
    loadLights();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="app-title">
                PIXI.js Primitives Demo
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="app-subtitle">
                Showcasing PIXI.Geometry, PIXI.Shader, and PIXI.Mesh
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

          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
