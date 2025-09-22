import { useState, useEffect } from 'react';
import PixiDemo from './components/PixiDemo';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import CodeDisplay from './components/CodeDisplay';
import { Light, loadLightsConfig, loadAmbientLight } from '@shared/lights';

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
  const [ambientLight, setAmbientLight] = useState<number>(0.3);
  const [lightsLoaded, setLightsLoaded] = useState<boolean>(false);

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
        const [lights, ambient] = await Promise.all([
          loadLightsConfig(),
          loadAmbientLight()
        ]);
        setLightsConfig(lights);
        setAmbientLight(ambient);
        setLightsLoaded(true);
        console.log('Loaded lights configuration:', lights);
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
                    onGeometryUpdate={setGeometryStatus}
                    onShaderUpdate={setShaderStatus}
                    onMeshUpdate={setMeshStatus}
                  />
                )}
              </div>

              <div className="mt-4 text-xs text-muted-foreground" data-testid="demo-description">
                Dynamic shader with wave distortion and color tinting
              </div>
            </div>

            <StatusPanel
              geometryStatus={geometryStatus}
              shaderStatus={shaderStatus}
              meshStatus={meshStatus}
            />
          </div>

          {/* Right Column - Controls and Code */}
          <div className="space-y-6">
            {/* Temporarily showing JSON config info instead of old controls */}
            <div className="bg-card rounded-lg border border-border p-6 space-y-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-accent status-active"></div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  External JSON Lighting System
                </h3>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Lights are now configured via external JSON file at <code>/lights-config.json</code>
                </p>
                <p className="text-sm text-muted-foreground">
                  ✅ Scalable to any number of lights<br/>
                  ✅ No more individual sliders per light<br/>
                  ✅ Generic lighting system<br/>
                  ✅ Easy to modify by editing JSON
                </p>
                <div className="text-xs text-muted-foreground">
                  Current configuration loaded successfully with {lightsLoaded ? lightsConfig.length : 0} lights
                </div>
              </div>
            </div>

            <CodeDisplay />

            {/* Technical Details */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4" data-testid="technical-details-title">
                Technical Details
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Rendering Engine:</span>
                  <span className="text-card-foreground" data-testid="tech-engine">PIXI.js v7.x</span>
                </div>
                <div className="flex justify-between">
                  <span>React Integration:</span>
                  <span className="text-card-foreground" data-testid="tech-react">@pixi/react</span>
                </div>
                <div className="flex justify-between">
                  <span>Shader Language:</span>
                  <span className="text-card-foreground" data-testid="tech-shader">GLSL ES 1.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Geometry Type:</span>
                  <span className="text-card-foreground" data-testid="tech-geometry">Quad (4 vertices)</span>
                </div>
                <div className="flex justify-between">
                  <span>Texture Format:</span>
                  <span className="text-card-foreground" data-testid="tech-texture">Generated Canvas</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground" data-testid="footer-description">
            A minimal demonstration of PIXI.js core primitives: Geometry, Shader, and Mesh
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
