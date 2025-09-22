import { useState, useEffect } from 'react';
import PixiDemo from './components/PixiDemo';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import CodeDisplay from './components/CodeDisplay';

export interface ShaderParams {
  colorR: number;
  colorG: number;
  colorB: number;
  // Enhanced lighting controls
  lightIntensity: number;
  lightRadius: number;
  lightColorR: number;
  lightColorG: number;
  lightColorB: number;
  ambientLight: number;
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
  // Light positioning
  lightZ: number;
  // Directional light
  directionalIntensity: number;
  directionalAngle: number;
  // Spotlight
  spotlightEnabled: boolean;
  spotlightX: number;
  spotlightY: number;
  spotlightZ: number;
  spotlightDirX: number;
  spotlightDirY: number;
  spotlightDirZ: number;
  spotlightIntensity: number;
  spotlightInnerRadius: number;
  spotlightOuterRadius: number;
  spotlightConeAngle: number;
  spotlightSoftness: number;
  // Resolution controls
  canvasWidth: number;
  canvasHeight: number;
}

function App() {
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
      // Enhanced lighting defaults
      lightIntensity: 1.0,
      lightRadius: 200,
      lightColorR: 1.0,
      lightColorG: 0.9,
      lightColorB: 0.8,
      ambientLight: 0.3,
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
      // Light positioning
      lightZ: 0.0,
      // Directional light
      directionalIntensity: 0.5,
      directionalAngle: 315,
      // Spotlight
      spotlightEnabled: false,
      spotlightX: 200,
      spotlightY: 150,
      spotlightZ: 100,
      spotlightDirX: 0.0,
      spotlightDirY: 0.0,
      spotlightDirZ: -1.0,
      spotlightIntensity: 2.0,
      spotlightInnerRadius: 50,
      spotlightOuterRadius: 150,
      spotlightConeAngle: 30,
      spotlightSoftness: 0.5,
      // Resolution controls
      canvasWidth: 800,
      canvasHeight: 600
    };
  };

  const [shaderParams, setShaderParams] = useState<ShaderParams>(getInitialParams());

  const [geometryStatus, setGeometryStatus] = useState('Initializing...');
  const [shaderStatus, setShaderStatus] = useState('Initializing...');
  const [meshStatus, setMeshStatus] = useState('Initializing...');

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
                <PixiDemo
                  shaderParams={shaderParams}
                  onGeometryUpdate={setGeometryStatus}
                  onShaderUpdate={setShaderStatus}
                  onMeshUpdate={setMeshStatus}
                />
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
            <ControlPanel
              shaderParams={shaderParams}
              setShaderParams={setShaderParams}
            />

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
