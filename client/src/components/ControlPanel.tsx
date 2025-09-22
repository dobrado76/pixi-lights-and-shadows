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
                className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
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
                className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
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
                className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                data-testid="slider-color-b"
              />
              <span className="text-xs text-muted-foreground" data-testid="value-color-b">
                B: {shaderParams.colorB.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Wave Amplitude: <span data-testid="value-wave-amplitude">{shaderParams.waveAmplitude.toFixed(3)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            value={shaderParams.waveAmplitude}
            onChange={(e) => setShaderParams(prev => ({...prev, waveAmplitude: parseFloat(e.target.value)}))}
            className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
            data-testid="slider-wave-amplitude"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Wave Frequency: <span data-testid="value-wave-frequency">{shaderParams.waveFrequency.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={shaderParams.waveFrequency}
            onChange={(e) => setShaderParams(prev => ({...prev, waveFrequency: parseFloat(e.target.value)}))}
            className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
            data-testid="slider-wave-frequency"
          />
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
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
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
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
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
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                  data-testid="slider-light-color-b"
                />
                <span className="text-xs text-muted-foreground" data-testid="value-light-color-b">
                  B: {shaderParams.lightColorB.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShaderParams({
            colorR: 1, colorG: 1, colorB: 1,
            waveAmplitude: 0.02, waveFrequency: 8,
            lightIntensity: 1.0, lightRadius: 200,
            lightColorR: 1.0, lightColorG: 0.9, lightColorB: 0.8,
            ambientLight: 0.3
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
