import { useState, useEffect } from 'react';
import { Light } from '@shared/lights';

interface DynamicLightControlsProps {
  lights: Light[];
  ambientLight: number;
  onLightsChange: (lights: Light[]) => void;
  onAmbientChange: (ambient: number) => void;
}

const DynamicLightControls = ({ lights, ambientLight, onLightsChange, onAmbientChange }: DynamicLightControlsProps) => {
  const [localLights, setLocalLights] = useState<Light[]>(lights);
  const [localAmbient, setLocalAmbient] = useState(ambientLight);

  // Update local state when props change
  useEffect(() => {
    setLocalLights(lights);
  }, [lights]);

  useEffect(() => {
    setLocalAmbient(ambientLight);
  }, [ambientLight]);

  // Helper to update a specific light
  const updateLight = (lightId: string, updates: Partial<Light>) => {
    const updatedLights = localLights.map(light => 
      light.id === lightId ? { ...light, ...updates } : light
    );
    setLocalLights(updatedLights);
    onLightsChange(updatedLights);
  };

  // Helper to convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (val: number) => Math.round(val * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-accent status-active" data-testid="dynamic-controls-status"></div>
        <h3 className="text-lg font-semibold text-card-foreground" data-testid="dynamic-controls-title">
          Dynamic Light Controls
        </h3>
      </div>

      {/* Ambient Light Control */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          Ambient Light: {localAmbient.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={localAmbient}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setLocalAmbient(value);
            onAmbientChange(value);
          }}
          className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
          data-testid="slider-ambient-light"
        />
      </div>

      {/* Dynamic Light Controls */}
      {localLights.map((light) => (
        <div key={light.id} className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-foreground">
              {light.id} ({light.type})
            </h4>
            <input
              type="checkbox"
              checked={light.enabled}
              onChange={(e) => updateLight(light.id, { enabled: e.target.checked })}
              className="w-4 h-4"
              data-testid={`checkbox-${light.id}-enabled`}
            />
          </div>

          {light.enabled && (
            <div className="space-y-3">
              {/* Intensity Control */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Intensity: {light.intensity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.01"
                  value={light.intensity}
                  onChange={(e) => updateLight(light.id, { intensity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                  data-testid={`slider-${light.id}-intensity`}
                />
              </div>

              {/* Color Control */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Color</label>
                <input
                  type="color"
                  value={rgbToHex(light.color.r, light.color.g, light.color.b)}
                  onChange={(e) => {
                    const rgb = hexToRgb(e.target.value);
                    updateLight(light.id, { color: rgb });
                  }}
                  className="w-full h-8 rounded border border-border cursor-pointer"
                  data-testid={`color-${light.id}`}
                />
              </div>

              {/* Position Controls (for point and spotlight) */}
              {(light.type === 'point' || light.type === 'spotlight') && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">X: {light.position.x.toFixed(0)}</label>
                    <input
                      type="range"
                      min="0"
                      max="800"
                      step="10"
                      value={light.position.x}
                      onChange={(e) => updateLight(light.id, { 
                        position: { ...light.position, x: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-x`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Y: {light.position.y.toFixed(0)}</label>
                    <input
                      type="range"
                      min="0"
                      max="600"
                      step="10"
                      value={light.position.y}
                      onChange={(e) => updateLight(light.id, { 
                        position: { ...light.position, y: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-y`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Z: {light.position.z.toFixed(0)}</label>
                    <input
                      type="range"
                      min="-100"
                      max="300"
                      step="10"
                      value={light.position.z}
                      onChange={(e) => updateLight(light.id, { 
                        position: { ...light.position, z: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-z`}
                    />
                  </div>
                </div>
              )}

              {/* Mouse Following Toggle (for point lights) */}
              {light.type === 'point' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={light.followMouse || false}
                    onChange={(e) => updateLight(light.id, { followMouse: e.target.checked })}
                    className="w-4 h-4"
                    data-testid={`checkbox-${light.id}-follow-mouse`}
                  />
                  <label className="text-xs text-muted-foreground">Follow Mouse</label>
                </div>
              )}

              {/* Radius Control (for point and spotlight) */}
              {(light.type === 'point' || light.type === 'spotlight') && light.radius !== undefined && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Radius: {light.radius.toFixed(0)}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="400"
                    step="10"
                    value={light.radius}
                    onChange={(e) => updateLight(light.id, { radius: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                    data-testid={`slider-${light.id}-radius`}
                  />
                </div>
              )}

              {/* Direction Controls (for directional and spotlight) */}
              {(light.type === 'directional' || light.type === 'spotlight') && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Dir X: {light.direction.x.toFixed(1)}</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={light.direction.x}
                      onChange={(e) => updateLight(light.id, { 
                        direction: { ...light.direction, x: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-dir-x`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Dir Y: {light.direction.y.toFixed(1)}</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={light.direction.y}
                      onChange={(e) => updateLight(light.id, { 
                        direction: { ...light.direction, y: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-dir-y`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Dir Z: {light.direction.z.toFixed(1)}</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={light.direction.z}
                      onChange={(e) => updateLight(light.id, { 
                        direction: { ...light.direction, z: parseFloat(e.target.value) }
                      })}
                      className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                      data-testid={`slider-${light.id}-dir-z`}
                    />
                  </div>
                </div>
              )}

              {/* Spotlight-specific controls */}
              {light.type === 'spotlight' && (
                <>
                  {light.coneAngle !== undefined && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Cone Angle: {light.coneAngle.toFixed(0)}°
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="90"
                        step="1"
                        value={light.coneAngle}
                        onChange={(e) => updateLight(light.id, { coneAngle: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                        data-testid={`slider-${light.id}-cone-angle`}
                      />
                    </div>
                  )}
                  {light.softness !== undefined && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Softness: {light.softness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={light.softness}
                        onChange={(e) => updateLight(light.id, { softness: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-input rounded-lg appearance-none cursor-pointer"
                        data-testid={`slider-${light.id}-softness`}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DynamicLightControls;