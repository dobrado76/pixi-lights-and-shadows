import { useState } from 'react';
import PixiDemo from './components/PixiDemo';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import CodeDisplay from './components/CodeDisplay';

export interface ShaderParams {
  colorR: number;
  colorG: number;
  colorB: number;
  waveAmplitude: number;
  waveFrequency: number;
  // Enhanced lighting controls
  lightIntensity: number;
  lightRadius: number;
  lightColorR: number;
  lightColorG: number;
  lightColorB: number;
  ambientLight: number;
}

function App() {
  const [shaderParams, setShaderParams] = useState<ShaderParams>({
    colorR: 1,
    colorG: 1,
    colorB: 1,
    waveAmplitude: 0.02,
    waveFrequency: 8,
    // Enhanced lighting defaults
    lightIntensity: 1.0,
    lightRadius: 200,
    lightColorR: 1.0,
    lightColorG: 0.9,
    lightColorB: 0.8,
    ambientLight: 0.3
  });

  const [geometryStatus, setGeometryStatus] = useState('Initializing...');
  const [shaderStatus, setShaderStatus] = useState('Initializing...');
  const [meshStatus, setMeshStatus] = useState('Initializing...');

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
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span data-testid="canvas-dimensions">400×300</span>
                  <div className="w-1 h-1 rounded-full bg-accent"></div>
                  <span data-testid="canvas-fps">60 FPS</span>
                </div>
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
