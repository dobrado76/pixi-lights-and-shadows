import { useState, useEffect, useCallback, useRef } from 'react';
import PixiDemo from './components/PixiDemo';
import DynamicLightControls from './components/DynamicLightControls';
import { DynamicSpriteControls } from './components/DynamicSpriteControls';
import PerformanceMonitor from './components/PerformanceMonitor';
import { Light, ShadowConfig, AmbientOcclusionConfig, loadLightsConfig, loadAmbientLight, saveLightsConfig, convertLightToConfig, rgbToHex } from '@/lib/lights';
import { detectDevice, getOptimalSettings, PerformanceSettings } from './utils/performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  
  // Shadow configuration state
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>({
    enabled: true,
    strength: 0.7,
    maxLength: 200,
    height: 10,
  });

  // Ambient Occlusion configuration state
  const [ambientOcclusionConfig, setAmbientOcclusionConfig] = useState<AmbientOcclusionConfig>({
    enabled: false,
    strength: 0.3,
    radius: 25,
    samples: 8,
    bias: 2.0,
  });

  // Scene configuration state
  const [sceneConfig, setSceneConfig] = useState<{ 
    sprites: Record<string, any>; 
    iblConfig?: { enabled: boolean; intensity: number; environmentMap: string } 
  }>({ sprites: {} });
  const [isLoaded, setSceneLoaded] = useState<boolean>(false);
  
  // Performance monitoring state
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings & { manualOverride?: boolean }>(() => getOptimalSettings(detectDevice()));

  const [lightsLoaded, setLightsLoaded] = useState<boolean>(false);

  // Performance monitoring state
  const [deviceInfo] = useState(() => detectDevice());
  const [fpsData, setFpsData] = useState({ current: 60, average: 60 });
  

  // CENTRALIZED SAVE - Gathers ALL current state automatically
  // No controller needs to know about other configs!
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const saveAllConfigs = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Gather ALL current state automatically
        const lightConfigs = lightsConfig.map(convertLightToConfig);
        const ambientConfig = {
          id: 'ambient_light',
          type: 'ambient' as const,
          enabled: true,
          brightness: ambientLight.intensity,
          color: rgbToHex(ambientLight.color.r, ambientLight.color.g, ambientLight.color.b)
        };
        
        const fullSaveData = {
          sprites: sceneConfig.sprites,
          lights: [ambientConfig, ...lightConfigs],
          shadowConfig,
          ambientOcclusionConfig,
          performanceSettings,
          iblConfig: sceneConfig.iblConfig
        };
        
        const response = await fetch('/api/save-scene-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullSaveData)
        });
        
        if (response.ok) {
          console.log('✅ All configurations saved successfully');
        }
      } catch (error) {
        console.error('❌ Failed to save configurations:', error);
      }
    }, 500);
  }, [lightsConfig, ambientLight, shadowConfig, ambientOcclusionConfig, performanceSettings, sceneConfig]);

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
        const sceneResult = await fetch('/api/load-scene-config').then(res => res.json());
        const lightsResult = await loadLightsConfig('/api/load-scene-config');
        const ambientLightData = await loadAmbientLight('/api/load-scene-config');
        
        setLightsConfig(lightsResult.lights);
        setAmbientLight(ambientLightData);
        setSceneConfig(sceneResult);
        
        // Merge saved shadow config with defaults
        if (lightsResult.shadowConfig) {
          setShadowConfig(lightsResult.shadowConfig);
        }
        
        // Load ambient occlusion config from scene.json
        if (sceneResult.ambientOcclusionConfig) {
          setAmbientOcclusionConfig(sceneResult.ambientOcclusionConfig);
        }

        // Load performance settings from scene.json
        if (sceneResult.performanceSettings) {
          setPerformanceSettings(sceneResult.performanceSettings);
        }
        
        setLightsLoaded(true);
        setSceneLoaded(true);
        console.log('Loaded configurations:', { lights: lightsResult, ambient: ambientLightData, scene: sceneResult });
      } catch (error) {
        console.error('Failed to load configurations:', error);
        setLightsLoaded(true);
        setSceneLoaded(true);
      }
    };
    
    loadConfigurations();
  }, []);

  // Auto-save shader params to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pixiShaderParams', JSON.stringify(shaderParams));
  }, [shaderParams]);

  // Handlers for immediate light updates (drives live rendering)
  const handleLightsChange = useCallback((newLights: Light[]) => {
    setLightsConfig(newLights);
  }, []);

  const handleAmbientLightChange = useCallback((newAmbient: {intensity: number, color: {r: number, g: number, b: number}}) => {
    setAmbientLight(newAmbient);
  }, []);

  const handleShadowConfigChange = useCallback((newShadowConfig: ShadowConfig) => {
    setShadowConfig(newShadowConfig);
  }, []);

  // Handler for ambient occlusion configuration changes
  const handleAmbientOcclusionConfigChange = useCallback((newAOConfig: AmbientOcclusionConfig) => {
    setAmbientOcclusionConfig(newAOConfig);
    // Note: DynamicLightControls handles the save with correct data
  }, []);

  // Handler for scene configuration changes
  const handleSceneConfigChange = useCallback((newSceneConfig: { 
    sprites: Record<string, any>; 
    iblConfig?: { enabled: boolean; intensity: number; environmentMap: string } 
  }) => {
    console.log('🔄 App: Scene config changed, triggering update...', newSceneConfig);
    setSceneConfig(newSceneConfig);
    saveAllConfigs();
  }, [saveAllConfigs]);

  // Handler for performance settings changes - just update state and save!
  const handlePerformanceSettingsChange = useCallback((newSettings: PerformanceSettings & { manualOverride?: boolean }) => {
    const settingsWithOverride = { ...newSettings, manualOverride: true };
    setPerformanceSettings(settingsWithOverride);
    
    // Save with NEW value directly (state update is async, so use the new value here)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const lightConfigs = lightsConfig.map(convertLightToConfig);
        const ambientConfig = {
          id: 'ambient_light',
          type: 'ambient' as const,
          enabled: true,
          brightness: ambientLight.intensity,
          color: rgbToHex(ambientLight.color.r, ambientLight.color.g, ambientLight.color.b)
        };
        
        const fullSaveData = {
          sprites: sceneConfig.sprites,
          lights: [ambientConfig, ...lightConfigs],
          shadowConfig,
          ambientOcclusionConfig,
          performanceSettings: settingsWithOverride, // Use NEW value directly
          iblConfig: sceneConfig.iblConfig
        };
        
        const response = await fetch('/api/save-scene-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullSaveData),
        });
        
        if (response.ok) {
          console.log('✅ All configurations saved successfully');
        }
      } catch (error) {
        console.error('Failed to save configurations:', error);
      }
    }, 300);
  }, [lightsConfig, ambientLight, sceneConfig, shadowConfig, ambientOcclusionConfig]);

  // Handler for immediate sprite changes (bypass React state for instant feedback)
  const handleImmediateSpriteChange = useCallback((spriteId: string, updates: any) => {
    console.log(`🚀 App: Immediate sprite change for ${spriteId}:`, Object.keys(updates));
    
    const immediateUpdate = (window as any).__pixiImmediateUpdate;
    if (immediateUpdate) {
      immediateUpdate(spriteId, updates);
    } else {
      console.log('⚠️ Immediate update handler not yet available');
    }
  }, []);

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
                    ambientOcclusionConfig={ambientOcclusionConfig}
                    sceneConfig={sceneConfig}
                    performanceSettings={performanceSettings}
                    onGeometryUpdate={setGeometryStatus}
                    onShaderUpdate={setShaderStatus}
                    onMeshUpdate={setMeshStatus}
                    onImmediateSpriteChange={handleImmediateSpriteChange}
                    onPerformanceUpdate={(fps, settings) => {
                      setFpsData(fps);
                      // Only update performance settings if not manually overridden
                      if (!performanceSettings.manualOverride) {
                        setPerformanceSettings(settings);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Tabbed Controls */}
          <div>
            <Tabs defaultValue="lights" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="lights" data-testid="tab-lights">
                  💡 Lights ({lightsConfig.length})
                </TabsTrigger>
                <TabsTrigger value="sprites" data-testid="tab-sprites">
                  🎭 Sprites ({Object.keys(sceneConfig.sprites || {}).length})
                </TabsTrigger>
                <TabsTrigger value="optimization" data-testid="tab-optimization">
                  ⚡ Optimization
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="lights" className="mt-4">
                {lightsLoaded && (
                  <DynamicLightControls
                    lights={lightsConfig}
                    ambientLight={ambientLight}
                    shadowConfig={shadowConfig}
                    ambientOcclusionConfig={ambientOcclusionConfig}
                    sceneConfig={sceneConfig}
                    onLightsChange={handleLightsChange}
                    onAmbientChange={handleAmbientLightChange}
                    onShadowConfigChange={handleShadowConfigChange}
                    onAmbientOcclusionConfigChange={handleAmbientOcclusionConfigChange}
                    onSceneConfigChange={handleSceneConfigChange}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="sprites" className="mt-4">
                {lightsLoaded && (
                  <DynamicSpriteControls
                    sceneConfig={sceneConfig}
                    onSceneConfigChange={handleSceneConfigChange}
                    onImmediateSpriteChange={handleImmediateSpriteChange}
                  />
                )}
              </TabsContent>

              <TabsContent value="optimization" className="mt-4">
                <div className="space-y-6">
                  {/* Device Information Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        📱 Device Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Device Type:</span>
                          <p className="text-foreground">
                            {deviceInfo.isMobile ? "Mobile" : deviceInfo.isTablet ? "Tablet" : "Desktop"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Performance Tier:</span>
                          <p className="text-foreground">
                            {deviceInfo.isLowEnd ? "Low-End" : "High-End"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Memory:</span>
                          <p className="text-foreground">
                            {deviceInfo.memory}GB
                            {deviceInfo.memoryEstimate && (
                              <span className="text-xs text-muted-foreground ml-1">(browser estimate)</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">CPU Cores:</span>
                          <p className="text-foreground">{deviceInfo.cores}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">WebGL Version:</span>
                          <p className="text-foreground">WebGL {deviceInfo.webglVersion}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Current FPS:</span>
                          <p className="text-foreground font-mono">
                            {fpsData.current.toFixed(1)} fps (avg: {fpsData.average.toFixed(1)})
                          </p>
                        </div>
                        {deviceInfo.gpuInfo && (
                          <div className="col-span-2">
                            <span className="font-medium text-muted-foreground">GPU:</span>
                            <p className="text-foreground text-xs break-all">
                              {deviceInfo.gpuInfo}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Performance Settings Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        ⚙️ Performance Optimization
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Quality Level:</span>
                            <p className="text-foreground capitalize">{performanceSettings.quality}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Resolution Scale:</span>
                            <p className="text-foreground">{performanceSettings.resolution}x</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Max Lights:</span>
                            <p className="text-foreground">{performanceSettings.maxLights}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Target FPS:</span>
                            <p className="text-foreground">{performanceSettings.fpsTarget}</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-foreground mb-3">Feature Controls</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Shadows</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={performanceSettings.enableShadows}
                                  onChange={(e) => handlePerformanceSettingsChange({
                                    ...performanceSettings,
                                    enableShadows: e.target.checked
                                  })}
                                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                                  data-testid="toggle-shadows"
                                />
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Ambient Occlusion</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={performanceSettings.enableAmbientOcclusion}
                                  onChange={(e) => handlePerformanceSettingsChange({
                                    ...performanceSettings,
                                    enableAmbientOcclusion: e.target.checked
                                  })}
                                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                                  data-testid="toggle-ambient-occlusion"
                                />
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Normal Mapping</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={performanceSettings.enableNormalMapping}
                                  onChange={(e) => handlePerformanceSettingsChange({
                                    ...performanceSettings,
                                    enableNormalMapping: e.target.checked
                                  })}
                                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                                  data-testid="toggle-normal-mapping"
                                />
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Light Masks</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={performanceSettings.enableLightMasks}
                                  onChange={(e) => handlePerformanceSettingsChange({
                                    ...performanceSettings,
                                    enableLightMasks: e.target.checked
                                  })}
                                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                                  data-testid="toggle-light-masks"
                                />
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Cap FPS to 60</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={performanceSettings.capFpsTo60}
                                  onChange={(e) => handlePerformanceSettingsChange({
                                    ...performanceSettings,
                                    capFpsTo60: e.target.checked
                                  })}
                                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                                  data-testid="toggle-cap-fps-60"
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <h4 className="font-medium text-foreground mb-3">Quality Presets</h4>
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => handlePerformanceSettingsChange({
                                quality: 'low',
                                resolution: 0.5,
                                maxLights: 2,
                                enableShadows: false,
                                enableAmbientOcclusion: false,
                                enableNormalMapping: false,
                                enableLightMasks: false,
                                textureScale: 0.5,
                                fpsTarget: 30,
                                capFpsTo60: true
                              })}
                              className={`px-3 py-1 text-xs rounded ${performanceSettings.quality === 'low' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              data-testid="preset-low"
                            >
                              Low
                            </button>
                            <button
                              onClick={() => handlePerformanceSettingsChange({
                                quality: 'medium',
                                resolution: 0.75,
                                maxLights: 4,
                                enableShadows: true,
                                enableAmbientOcclusion: false,
                                enableNormalMapping: true,
                                enableLightMasks: false,
                                textureScale: 0.75,
                                fpsTarget: 45,
                                capFpsTo60: true
                              })}
                              className={`px-3 py-1 text-xs rounded ${performanceSettings.quality === 'medium' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              data-testid="preset-medium"
                            >
                              Medium
                            </button>
                            <button
                              onClick={() => handlePerformanceSettingsChange({
                                quality: 'high',
                                resolution: 1.0,
                                maxLights: 999, // No limit for high quality - let your RTX 4080 shine!
                                enableShadows: true,
                                enableAmbientOcclusion: true,
                                enableNormalMapping: true,
                                enableLightMasks: true,
                                textureScale: 1.0,
                                fpsTarget: 60,
                                capFpsTo60: true
                              })}
                              className={`px-3 py-1 text-xs rounded ${performanceSettings.quality === 'high' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              data-testid="preset-high"
                            >
                              High
                            </button>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-2">
                            {deviceInfo.isMobile && (
                              <p>• Mobile device detected - automatic quality reduction enabled</p>
                            )}
                            {deviceInfo.isLowEnd && (
                              <p>• Low-end device - consider reducing light count for better performance</p>
                            )}
                            {performanceSettings.quality === 'low' && (
                              <p>• Low quality mode active - shadows and effects are simplified</p>
                            )}
                            {fpsData.average < 30 && (
                              <p>• Low FPS detected - automatic quality adjustment in progress</p>
                            )}
                            {!deviceInfo.isMobile && !deviceInfo.isLowEnd && (
                              <p>• High-performance device - use High preset for best quality</p>
                            )}
                            <p>• Manual toggles override automatic settings</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>


      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Built with ❤️ featuring advanced shadow casting, unlimited sprite support, and comprehensive JSON configuration
            </p>
            <div className="mt-2">
              <a
                href="https://github.com/dobrado76/pixi-lights-and-shadows"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-accent transition-colors duration-200"
                data-testid="github-link"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 fill-current"
                  aria-hidden="true"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
