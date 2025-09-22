import { useState, useEffect } from 'react';
import { Light } from '@shared/lights';
import { Plus, Trash2 } from 'lucide-react';

interface DynamicLightControlsProps {
  lights: Light[];
  ambientLight: number;
  onLightsChange: (lights: Light[]) => void;
  onAmbientChange: (ambient: number) => void;
}

const DynamicLightControls = ({ lights, ambientLight, onLightsChange, onAmbientChange }: DynamicLightControlsProps) => {
  const [localLights, setLocalLights] = useState<Light[]>(lights);
  const [localAmbient, setLocalAmbient] = useState(ambientLight);
  const [newLightType, setNewLightType] = useState<'point' | 'directional' | 'spotlight'>('point');

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

  // Helper to delete a light
  const deleteLight = (lightId: string) => {
    const updatedLights = localLights.filter(light => light.id !== lightId);
    setLocalLights(updatedLights);
    onLightsChange(updatedLights);
  };

  // Helper to add a new light
  const addNewLight = () => {
    const newId = `${newLightType}_${Date.now()}`;
    const baseLight: Light = {
      id: newId,
      type: newLightType,
      enabled: true,
      position: { x: 400, y: 300, z: 50 },
      direction: { x: 0, y: 0, z: -1 },
      color: { r: 1, g: 1, b: 1 },
      intensity: 1.0,
    };

    // Add type-specific properties
    if (newLightType === 'point') {
      baseLight.radius = 200;
      baseLight.followMouse = false;
    } else if (newLightType === 'spotlight') {
      baseLight.radius = 150;
      baseLight.coneAngle = 30;
      baseLight.softness = 0.5;
    }

    const updatedLights = [...localLights, baseLight];
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

      {/* Add New Light Section */}
      <div className="border border-border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center space-x-2 mb-3">
          <h4 className="text-sm font-medium text-foreground">Add New Light</h4>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={newLightType}
            onChange={(e) => setNewLightType(e.target.value as 'point' | 'directional' | 'spotlight')}
            className="flex-1 bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
            data-testid="dropdown-light-type"
          >
            <option value="point">Point Light</option>
            <option value="directional">Directional Light</option>
            <option value="spotlight">Spotlight</option>
          </select>
          <button
            onClick={addNewLight}
            className="flex items-center space-x-1 bg-primary text-primary-foreground px-3 py-2 rounded text-sm hover:bg-primary/90 transition-colors"
            data-testid="button-add-light"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>
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
        <div key={light.id} className="border border-border rounded-lg p-4 bg-muted/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
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
              <span className="text-xs text-muted-foreground">
                {light.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <button
              onClick={() => deleteLight(light.id)}
              className="flex items-center space-x-1 bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs hover:bg-destructive/90 transition-colors"
              data-testid={`button-delete-${light.id}`}
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
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

      {localLights.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No lights configured</p>
          <p className="text-xs">Use the "Add New Light" section above to create lights</p>
        </div>
      )}
    </div>
  );
};

export default DynamicLightControls;