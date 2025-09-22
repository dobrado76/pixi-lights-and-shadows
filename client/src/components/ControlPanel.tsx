import { ShaderParams } from '../App';

interface ControlPanelProps {
  shaderParams: ShaderParams;
  setShaderParams: React.Dispatch<React.SetStateAction<ShaderParams>>;
}

const ControlPanel = ({ shaderParams, setShaderParams }: ControlPanelProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-accent status-active" data-testid="control-status-indicator"></div>
        <h3 className="text-lg font-semibold text-card-foreground" data-testid="control-panel-title">
          Shader Controls
        </h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Color Tint (RGB)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={shaderParams.colorR}
                onChange={(e) => setShaderParams(prev => ({...prev, colorR: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-color-r"
              />
              <span className="text-xs text-muted-foreground" data-testid="value-color-r">
                R: {shaderParams.colorR.toFixed(1)}
              </span>
            </div>
            <div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={shaderParams.colorG}
                onChange={(e) => setShaderParams(prev => ({...prev, colorG: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-color-g"
              />
              <span className="text-xs text-muted-foreground" data-testid="value-color-g">
                G: {shaderParams.colorG.toFixed(1)}
              </span>
            </div>
            <div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={shaderParams.colorB}
                onChange={(e) => setShaderParams(prev => ({...prev, colorB: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-color-b"
              />
              <span className="text-xs text-muted-foreground" data-testid="value-color-b">
                B: {shaderParams.colorB.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
        

        {/* Canvas Resolution Controls */}
        <div className="border-t border-border pt-4">
          <h4 className="text-md font-medium text-card-foreground mb-3">
            Canvas Resolution
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Width: <span data-testid="value-canvas-width">{shaderParams.canvasWidth}</span>
              </label>
              <input
                type="range"
                min="200"
                max="800"
                step="50"
                value={shaderParams.canvasWidth}
                onChange={(e) => setShaderParams(prev => ({...prev, canvasWidth: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-canvas-width"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Height: <span data-testid="value-canvas-height">{shaderParams.canvasHeight}</span>
              </label>
              <input
                type="range"
                min="200"
                max="600"
                step="50"
                value={shaderParams.canvasHeight}
                onChange={(e) => setShaderParams(prev => ({...prev, canvasHeight: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-canvas-height"
              />
            </div>
          </div>
        </div>

        {/* Enhanced Lighting Controls */}
        <div className="border-t border-border pt-4">
          <h4 className="text-md font-medium text-card-foreground mb-3">
            Mouse Lighting Effects
          </h4>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Light Intensity: <span data-testid="value-light-intensity">{shaderParams.lightIntensity.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={shaderParams.lightIntensity}
              onChange={(e) => setShaderParams(prev => ({...prev, lightIntensity: parseFloat(e.target.value)}))}
              className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
              data-testid="slider-light-intensity"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Light Radius: <span data-testid="value-light-radius">{shaderParams.lightRadius.toFixed(0)}</span>
            </label>
            <input
              type="range"
              min="50"
              max="400"
              step="10"
              value={shaderParams.lightRadius}
              onChange={(e) => setShaderParams(prev => ({...prev, lightRadius: parseFloat(e.target.value)}))}
              className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
              data-testid="slider-light-radius"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Ambient Light: <span data-testid="value-ambient-light">{shaderParams.ambientLight.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shaderParams.ambientLight}
              onChange={(e) => setShaderParams(prev => ({...prev, ambientLight: parseFloat(e.target.value)}))}
              className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
              data-testid="slider-ambient-light"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Light Color (RGB)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={shaderParams.lightColorR}
                  onChange={(e) => setShaderParams(prev => ({...prev, lightColorR: parseFloat(e.target.value)}))}
                  style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                  data-testid="slider-light-color-r"
                />
                <span className="text-xs text-muted-foreground" data-testid="value-light-color-r">
                  R: {shaderParams.lightColorR.toFixed(1)}
                </span>
              </div>
              <div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={shaderParams.lightColorG}
                  onChange={(e) => setShaderParams(prev => ({...prev, lightColorG: parseFloat(e.target.value)}))}
                  style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                  data-testid="slider-light-color-g"
                />
                <span className="text-xs text-muted-foreground" data-testid="value-light-color-g">
                  G: {shaderParams.lightColorG.toFixed(1)}
                </span>
              </div>
              <div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={shaderParams.lightColorB}
                  onChange={(e) => setShaderParams(prev => ({...prev, lightColorB: parseFloat(e.target.value)}))}
                  style={{
                  width: '100%',
                  height: '6px',
                  background: '#374151',
                  borderRadius: '4px',
                  border: '1px solid #4B5563',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                  data-testid="slider-light-color-b"
                />
                <span className="text-xs text-muted-foreground" data-testid="value-light-color-b">
                  B: {shaderParams.lightColorB.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Light Z Position
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            value={shaderParams.lightZ || 0}
            onChange={(e) => setShaderParams(prev => ({...prev, lightZ: parseFloat(e.target.value)}))}
            style={{
              width: '100%',
              height: '6px',
              background: '#374151',
              borderRadius: '4px',
              border: '1px solid #4B5563',
              outline: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
              appearance: 'none'
            }}
            data-testid="slider-light-z"
          />
          <span className="text-xs text-muted-foreground" data-testid="value-light-z">
            Z: {(shaderParams.lightZ || 0).toFixed(0)} units
          </span>
        </div>

        {/* Directional Light Controls */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-foreground">Directional Light (Shows Normal Maps)</h3>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="directional-intensity">
              Directional Intensity: {(shaderParams.directionalIntensity !== undefined ? shaderParams.directionalIntensity : 0.5).toFixed(2)}
            </label>
            <input
              id="directional-intensity"
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={shaderParams.directionalIntensity !== undefined ? shaderParams.directionalIntensity : 0.5}
              onChange={(e) => setShaderParams(prev => ({...prev, directionalIntensity: parseFloat(e.target.value)}))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: 'linear-gradient(to right, #000, #fff)',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
              data-testid="slider-directional-intensity"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor="directional-angle">
              Light Angle: {(shaderParams.directionalAngle || 315).toFixed(0)}° (0=Right, 90=Down, 180=Left, 270=Up)
            </label>
            <input
              id="directional-angle"
              type="range"
              min="0"
              max="360"
              step="5"
              value={shaderParams.directionalAngle || 315}
              onChange={(e) => setShaderParams(prev => ({...prev, directionalAngle: parseFloat(e.target.value)}))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
              data-testid="slider-directional-angle"
            />
          </div>
        </div>

        {/* Spotlight Controls */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Spotlight System</h3>
            <input
              type="checkbox"
              checked={shaderParams.spotlightEnabled}
              onChange={(e) => setShaderParams(prev => ({...prev, spotlightEnabled: e.target.checked}))}
              className="w-4 h-4"
              data-testid="checkbox-spotlight-enabled"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Position Controls */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Position X: {(shaderParams.spotlightX || 200).toFixed(0)}
              </label>
              <input
                type="range"
                min="0"
                max="800"
                step="10"
                value={shaderParams.spotlightX || 200}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightX: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #444, #fff)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-x"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Position Y: {(shaderParams.spotlightY || 150).toFixed(0)}
              </label>
              <input
                type="range"
                min="0"
                max="600"
                step="10"
                value={shaderParams.spotlightY || 150}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightY: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #444, #fff)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-y"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Position Z: {(shaderParams.spotlightZ || 100).toFixed(0)}
            </label>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={shaderParams.spotlightZ || 100}
              onChange={(e) => setShaderParams(prev => ({...prev, spotlightZ: parseFloat(e.target.value)}))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: 'linear-gradient(to right, #f44, #44f)',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
              data-testid="slider-spotlight-z"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Dir X: {(shaderParams.spotlightDirX || 0).toFixed(1)}
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={shaderParams.spotlightDirX || 0}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightDirX: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #f00, #0f0)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-dir-x"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Dir Y: {(shaderParams.spotlightDirY || 0).toFixed(1)}
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={shaderParams.spotlightDirY || 0}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightDirY: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #0f0, #00f)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-dir-y"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Dir Z: {(shaderParams.spotlightDirZ || -1).toFixed(1)}
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={shaderParams.spotlightDirZ || -1}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightDirZ: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #00f, #f0f)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-dir-z"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Intensity: {(shaderParams.spotlightIntensity || 2).toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={shaderParams.spotlightIntensity || 2}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightIntensity: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #000, #fff)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-intensity"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Cone Angle: {(shaderParams.spotlightConeAngle || 30).toFixed(0)}°
              </label>
              <input
                type="range"
                min="5"
                max="90"
                step="5"
                value={shaderParams.spotlightConeAngle || 30}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightConeAngle: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #ff0, #f00)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-cone-angle"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Inner Radius: {(shaderParams.spotlightInnerRadius || 50).toFixed(0)}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={shaderParams.spotlightInnerRadius || 50}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightInnerRadius: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #4f4, #44f)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-inner-radius"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Outer Radius: {(shaderParams.spotlightOuterRadius || 150).toFixed(0)}
              </label>
              <input
                type="range"
                min="20"
                max="400"
                step="10"
                value={shaderParams.spotlightOuterRadius || 150}
                onChange={(e) => setShaderParams(prev => ({...prev, spotlightOuterRadius: parseFloat(e.target.value)}))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '5px',
                  background: 'linear-gradient(to right, #44f, #f44)',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
                data-testid="slider-spotlight-outer-radius"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Softness: {(shaderParams.spotlightSoftness || 0.5).toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shaderParams.spotlightSoftness || 0.5}
              onChange={(e) => setShaderParams(prev => ({...prev, spotlightSoftness: parseFloat(e.target.value)}))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: 'linear-gradient(to right, #333, #fff)',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
              data-testid="slider-spotlight-softness"
            />
          </div>
        </div>
        
        <button
          onClick={() => setShaderParams({
            colorR: 1, colorG: 1, colorB: 1,
            waveAmplitude: 0.02, waveFrequency: 8,
            lightIntensity: 1.0, lightRadius: 200,
            lightColorR: 1.0, lightColorG: 0.9, lightColorB: 0.8,
            ambientLight: 0.3,
            normalMapIntensity: 1.0, specularPower: 32.0, specularIntensity: 0.5,
            metallic: 0.0, roughness: 0.5, timeMultiplier: 1.0, animationEnabled: true,
            contrast: 1.0, saturation: 1.0, brightness: 1.0,
            uvScaleX: 1.0, uvScaleY: 1.0, uvOffsetX: 0.0, uvOffsetY: 0.0,
            rimLightIntensity: 0.0, rimLightPower: 4.0,
            lightZ: 0.0,
            directionalIntensity: 0.5, directionalAngle: 315,
            spotlightEnabled: false, spotlightX: 200, spotlightY: 150, spotlightZ: 100,
            spotlightDirX: 0.0, spotlightDirY: 0.0, spotlightDirZ: -1.0,
            spotlightIntensity: 2.0, spotlightInnerRadius: 50, spotlightOuterRadius: 150,
            spotlightConeAngle: 30, spotlightSoftness: 0.5,
            canvasWidth: 400, canvasHeight: 300
          })}
          className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          data-testid="button-reset-defaults"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
