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
    <div className="bg-card rounded-lg border border-border p-4 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-accent" data-testid="dynamic-controls-status"></div>
          <h3 className="text-sm font-semibold text-card-foreground" data-testid="dynamic-controls-title">
            Lighting Controls
          </h3>
        </div>
        
        {/* Compact Add Light Controls */}
        <div className="flex items-center space-x-1">
          <select
            value={newLightType}
            onChange={(e) => setNewLightType(e.target.value as 'point' | 'directional' | 'spotlight')}
            className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground"
            data-testid="dropdown-light-type"
          >
            <option value="point">Point</option>
            <option value="directional">Directional</option>
            <option value="spotlight">Spotlight</option>
          </select>
          <button
            onClick={addNewLight}
            className="flex items-center bg-primary text-primary-foreground px-2 py-1 rounded text-xs hover:bg-primary/90"
            data-testid="button-add-light"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Compact Ambient Light Control */}
      <div className="border-b border-border pb-2">
        <div className="flex items-center space-x-2">
          <label className="text-xs text-muted-foreground min-w-[80px]">
            Ambient: {localAmbient.toFixed(2)}
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
            className="flex-1"
            data-testid="slider-ambient-light"
          />
        </div>
      </div>

      {/* Compact Light Controls */}
      {localLights.map((light) => {
        // Calculate angle from direction for directional lights
        const directionAngle = light.type === 'directional' 
          ? Math.atan2(light.direction.y, light.direction.x) * 180 / Math.PI + 180
          : 0;

        return (
          <div key={light.id} className="border border-border rounded p-2 bg-muted/5">
            {/* Compact Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={light.enabled}
                  onChange={(e) => updateLight(light.id, { enabled: e.target.checked })}
                  className="w-3 h-3"
                  data-testid={`checkbox-${light.id}-enabled`}
                />
                <span className="text-xs font-medium text-foreground">
                  {light.id}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({light.type})
                </span>
              </div>
              <button
                onClick={() => deleteLight(light.id)}
                className="bg-red-600 hover:bg-red-700 text-white p-1 rounded text-xs flex items-center"
                data-testid={`button-delete-${light.id}`}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {light.enabled && (
              <div className="space-y-2">
                {/* Row 1: Intensity & Color */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-muted-foreground min-w-[40px]">
                      I: {light.intensity.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={light.intensity}
                      onChange={(e) => updateLight(light.id, { intensity: parseFloat(e.target.value) })}
                      className="flex-1"
                      data-testid={`slider-${light.id}-intensity`}
                    />
                  </div>
                  <input
                    type="color"
                    value={rgbToHex(light.color.r, light.color.g, light.color.b)}
                    onChange={(e) => {
                      const rgb = hexToRgb(e.target.value);
                      updateLight(light.id, { color: rgb });
                    }}
                    className="w-full h-6 rounded border border-border cursor-pointer"
                    data-testid={`color-${light.id}`}
                  />
                </div>

                {/* Point Light Controls */}
                {light.type === 'point' && (
                  <>
                    {/* Row 2: Position X, Y, Z */}
                    <div className="grid grid-cols-3 gap-1">
                      {['x', 'y', 'z'].map((axis, idx) => {
                        const value = axis === 'x' ? light.position.x : axis === 'y' ? light.position.y : light.position.z;
                        const max = axis === 'z' ? 300 : axis === 'x' ? 800 : 600;
                        const min = axis === 'z' ? -100 : 0;
                        return (
                          <div key={axis} className="flex items-center space-x-1">
                            <label className="text-xs text-muted-foreground min-w-[20px]">
                              {axis.toUpperCase()}: {value.toFixed(0)}
                            </label>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step="10"
                              value={value}
                              onChange={(e) => updateLight(light.id, { 
                                position: { ...light.position, [axis]: parseFloat(e.target.value) }
                              })}
                              className="flex-1"
                              data-testid={`slider-${light.id}-${axis}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Row 3: Radius & Follow Mouse */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-1">
                        <label className="text-xs text-muted-foreground min-w-[40px]">
                          R: {light.radius?.toFixed(0)}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="400"
                          step="10"
                          value={light.radius || 200}
                          onChange={(e) => updateLight(light.id, { radius: parseFloat(e.target.value) })}
                          className="flex-1"
                          data-testid={`slider-${light.id}-radius`}
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={light.followMouse || false}
                          onChange={(e) => updateLight(light.id, { followMouse: e.target.checked })}
                          className="w-3 h-3"
                          data-testid={`checkbox-${light.id}-follow-mouse`}
                        />
                        <label className="text-xs text-muted-foreground">Mouse</label>
                      </div>
                    </div>
                  </>
                )}

                {/* Directional Light Controls - SINGLE ANGLE */}
                {light.type === 'directional' && (
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-muted-foreground min-w-[50px]">
                      Angle: {directionAngle.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={directionAngle}
                      onChange={(e) => {
                        const angle = parseFloat(e.target.value);
                        const radians = (angle - 180) * Math.PI / 180;
                        updateLight(light.id, { 
                          direction: { 
                            x: Math.cos(radians), 
                            y: Math.sin(radians), 
                            z: -1 
                          }
                        });
                      }}
                      className="flex-1"
                      data-testid={`slider-${light.id}-angle`}
                    />
                  </div>
                )}

                {/* Spotlight Controls */}
                {light.type === 'spotlight' && (
                  <>
                    {/* Position */}
                    <div className="grid grid-cols-3 gap-1">
                      {['x', 'y', 'z'].map((axis, idx) => {
                        const value = axis === 'x' ? light.position.x : axis === 'y' ? light.position.y : light.position.z;
                        const max = axis === 'z' ? 300 : axis === 'x' ? 800 : 600;
                        const min = axis === 'z' ? -100 : 0;
                        return (
                          <div key={axis} className="flex items-center space-x-1">
                            <label className="text-xs text-muted-foreground min-w-[20px]">
                              {axis.toUpperCase()}: {value.toFixed(0)}
                            </label>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step="10"
                              value={value}
                              onChange={(e) => updateLight(light.id, { 
                                position: { ...light.position, [axis]: parseFloat(e.target.value) }
                              })}
                              className="flex-1"
                              data-testid={`slider-${light.id}-${axis}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Spotlight Properties */}
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center space-x-1">
                        <label className="text-xs text-muted-foreground min-w-[20px]">
                          R: {light.radius?.toFixed(0)}
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="400"
                          step="10"
                          value={light.radius || 150}
                          onChange={(e) => updateLight(light.id, { radius: parseFloat(e.target.value) })}
                          className="flex-1"
                          data-testid={`slider-${light.id}-radius`}
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <label className="text-xs text-muted-foreground min-w-[20px]">
                          A: {light.coneAngle?.toFixed(0)}°
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="90"
                          step="1"
                          value={light.coneAngle || 30}
                          onChange={(e) => updateLight(light.id, { coneAngle: parseFloat(e.target.value) })}
                          className="flex-1"
                          data-testid={`slider-${light.id}-cone-angle`}
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <label className="text-xs text-muted-foreground min-w-[20px]">
                          S: {light.softness?.toFixed(1)}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={light.softness || 0.5}
                          onChange={(e) => updateLight(light.id, { softness: parseFloat(e.target.value) })}
                          className="flex-1"
                          data-testid={`slider-${light.id}-softness`}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

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