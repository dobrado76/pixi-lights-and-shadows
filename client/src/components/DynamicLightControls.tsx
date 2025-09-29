import { useState, useEffect } from 'react';
import { Light, MaskConfig, ShadowConfig, AmbientOcclusionConfig } from '@/lib/lights';
import { Plus, Trash2, Copy, Edit3, ImageIcon, Eye, EyeOff, Moon, Contrast } from 'lucide-react';
import { useSceneState } from './SceneStateManager';

/**
 * Dynamic lighting control panel supporting unlimited lights with real-time editing.
 * Manages light creation, configuration, masking, and auto-save to external JSON.
 * Handles all three light types: point, directional, and spotlight.
 */

const DynamicLightControls = () => {
  // Use SceneState Manager context
  const context = useSceneState();
  
  // If context not available yet, show loading
  if (!context) {
    return <div className="p-4 text-muted-foreground">Loading lights configuration...</div>;
  }
  
  const { lightsConfig, ambientLight, shadowConfig, ambientOcclusionConfig, updateLights, updateAmbientLight, updateShadowConfig, updateAmbientOcclusionConfig } = context;
  
  const [localLights, setLocalLights] = useState<Light[]>(lightsConfig || []);
  const [localAmbient, setLocalAmbient] = useState(ambientLight);
  const [localShadowConfig, setLocalShadowConfig] = useState<ShadowConfig>(shadowConfig);
  const [localAOConfig, setLocalAOConfig] = useState<AmbientOcclusionConfig>(ambientOcclusionConfig || {
    enabled: false,
    strength: 0.3,
    radius: 25,
    samples: 8,
    bias: 2.0,
  });
  const [newLightType, setNewLightType] = useState<'point' | 'directional' | 'spotlight'>('point');
  const [editingLightId, setEditingLightId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [availableMasks, setAvailableMasks] = useState<string[]>([]);

  // Bootstrap mask file list - in production this could be dynamically loaded
  useEffect(() => {
    const loadMasks = async () => {
      try {
        // Hardcoded mask inventory - could be replaced with dynamic directory scanning
        const maskFiles = [
          'corona.png',
          'doughnut.png',
          'focus.png',
          'god-rays.png',
          'ring.png',
          'spot.png',
          'stage-3.png',
          'stage-6.png',
          'sun.png'
        ];
        setAvailableMasks(maskFiles);
      } catch (error) {
        console.error('Error loading mask files:', error);
      }
    };
    loadMasks();
  }, []);

  // Sync local state with external configuration changes
  useEffect(() => {
    setLocalLights(lights);
  }, [lights]);

  useEffect(() => {
    setLocalAmbient(ambientLight);
  }, [ambientLight]);

  useEffect(() => {
    setLocalShadowConfig(shadowConfig);
  }, [shadowConfig]);

  // Core light mutation function - triggers auto-save via parent callback
  const updateLight = (lightId: string, updates: Partial<Light>) => {
    const updatedLights = localLights.map(light => 
      light.id === lightId ? { ...light, ...updates } : light
    );
    setLocalLights(updatedLights);
    updateLights(updatedLights);
  };

  // Helper to delete a light
  const deleteLight = (lightId: string) => {
    const updatedLights = localLights.filter(light => light.id !== lightId);
    setLocalLights(updatedLights);
    updateLights(updatedLights);
  };

  // Light duplication with timestamp-based unique naming
  const duplicateLight = (lightId: string) => {
    const originalLight = localLights.find(light => light.id === lightId);
    if (!originalLight) return;

    // Generate unique ID using timestamp to prevent conflicts
    const timestamp = Date.now();
    const newLight: Light = {
      ...originalLight,
      id: `${originalLight.type}_copy_${timestamp}`
    };

    const updatedLights = [...localLights, newLight];
    setLocalLights(updatedLights);
    updateLights(updatedLights);
  };

  // Light renaming system with validation to prevent ID conflicts
  const startRename = (lightId: string, currentName: string) => {
    setEditingLightId(lightId);
    setEditingName(currentName);
  };

  const finishRename = (lightId: string) => {
    // Validation: reject empty strings and whitespace (IDs must be clean)
    if (!editingName.trim() || /\s/.test(editingName)) {
      setEditingLightId(null);
      setEditingName('');
      return;
    }

    // Prevent duplicate IDs - each light must have unique identifier
    const nameExists = localLights.some(light => light.id === editingName && light.id !== lightId);
    if (nameExists) {
      setEditingLightId(null);
      setEditingName('');
      return;
    }

    // Update the light's ID
    const updatedLights = localLights.map(light => 
      light.id === lightId ? { ...light, id: editingName } : light
    );
    setLocalLights(updatedLights);
    updateLights(updatedLights);
    setEditingLightId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingLightId(null);
    setEditingName('');
  };

  // Mask creation with sensible defaults - only for point/spotlight types
  const addMask = (lightId: string) => {
    const defaultMask: MaskConfig = {
      image: availableMasks[0] || '',  // Use first available mask
      offset: { x: 0, y: 0 },          // Centered by default
      rotation: 0,                     // No rotation
      scale: 1                         // 1:1 pixel scale
    };
    updateLight(lightId, { mask: defaultMask });
  };

  // Helper to remove mask from a light
  const removeMask = (lightId: string) => {
    updateLight(lightId, { mask: undefined });
  };

  // Mask texture switching while preserving transform properties
  const changeMask = (lightId: string, maskFile: string) => {
    const currentMask = localLights.find(l => l.id === lightId)?.mask;
    const newMask: MaskConfig = {
      image: maskFile,
      offset: currentMask?.offset || { x: 0, y: 0 },    // Preserve position
      rotation: currentMask?.rotation || 0,             // Preserve rotation
      scale: currentMask?.scale || 1                    // Preserve scale
    };
    updateLight(lightId, { mask: newMask });
  };

  // Live mask property updates for real-time transformation feedback
  const updateMaskProperty = (lightId: string, property: keyof MaskConfig, value: any) => {
    const currentMask = localLights.find(l => l.id === lightId)?.mask;
    if (currentMask) {
      const newMask = { ...currentMask, [property]: value };
      updateLight(lightId, { mask: newMask });
    }
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
    updateLights(updatedLights);
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
        <div className="flex items-center space-x-2 mb-1">
          <label className="text-xs text-muted-foreground min-w-[80px]">
            Ambient: {localAmbient.intensity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={localAmbient.intensity}
            onChange={(e) => {
              const newIntensity = parseFloat(e.target.value);
              const newAmbient = { ...localAmbient, intensity: newIntensity };
              setLocalAmbient(newAmbient);
              updateAmbientLight(newAmbient);
            }}
            className="flex-1"
            data-testid="slider-ambient-light"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-muted-foreground min-w-[80px]">
            Color:
          </label>
          <input
            type="color"
            value={rgbToHex(localAmbient.color.r, localAmbient.color.g, localAmbient.color.b)}
            onChange={(e) => {
              const rgb = hexToRgb(e.target.value);
              const newAmbient = { ...localAmbient, color: rgb };
              setLocalAmbient(newAmbient);
              updateAmbientLight(newAmbient);
            }}
            className="w-20 h-6 rounded border border-border cursor-pointer"
            data-testid="color-ambient-light"
          />
        </div>
      </div>

      {/* Directional Light Control (always enabled, like ambient) */}
      {(() => {
        const directionalLight = localLights.find(light => light.type === 'directional');
        if (!directionalLight) return null;
        
        const directionAngle = Math.atan2(directionalLight.direction.y, directionalLight.direction.x) * 180 / Math.PI + 180;
        
        return (
          <div className="border-b border-border pb-2">
            <div className="mb-2">
              <span className="text-xs font-medium text-foreground">Directional Light</span>
            </div>
            
            {/* Intensity */}
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Intensity: {directionalLight.intensity.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={directionalLight.intensity}
                onChange={(e) => updateLight(directionalLight.id, { intensity: parseFloat(e.target.value) })}
                className="flex-1"
                data-testid="slider-directional-intensity"
              />
            </div>
            
            {/* Direction */}
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Direction: {directionAngle.toFixed(0)}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={directionAngle}
                onChange={(e) => {
                  const angle = parseFloat(e.target.value);
                  const radians = (angle - 180) * Math.PI / 180;
                  const newDirection = {
                    x: Math.cos(radians),
                    y: Math.sin(radians),
                    z: directionalLight.direction.z
                  };
                  updateLight(directionalLight.id, { direction: newDirection });
                }}
                className="flex-1"
                data-testid="slider-directional-direction"
              />
            </div>
            
            {/* Color */}
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Color:
              </label>
              <input
                type="color"
                value={rgbToHex(directionalLight.color.r, directionalLight.color.g, directionalLight.color.b)}
                onChange={(e) => {
                  const rgb = hexToRgb(e.target.value);
                  updateLight(directionalLight.id, { color: rgb });
                }}
                className="w-20 h-6 rounded border border-border cursor-pointer"
                data-testid="color-directional-light"
              />
            </div>
            
            {/* Cast Shadows */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={directionalLight.castsShadows || false}
                onChange={(e) => updateLight(directionalLight.id, { castsShadows: e.target.checked })}
                className="w-3 h-3"
                data-testid="checkbox-directional-cast-shadows"
              />
              <label className="text-xs text-muted-foreground">Cast Shadows</label>
            </div>
          </div>
        );
      })()}

      {/* Shadow Configuration Panel */}
      <div className="border-b border-border pb-2">
        <div className="flex items-center space-x-2 mb-2">
          <Moon size={14} className="text-muted-foreground" />
          <h4 className="text-xs font-medium text-foreground">Shadow Configuration</h4>
          <button
            onClick={() => {
              const newConfig = { ...localShadowConfig, enabled: !localShadowConfig.enabled };
              setLocalShadowConfig(newConfig);
              updateShadowConfig(newConfig);
            }}
            className={`ml-auto p-1 rounded text-xs ${
              localShadowConfig.enabled 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
            data-testid="button-toggle-shadows"
          >
            {localShadowConfig.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>
        
        {localShadowConfig.enabled && (
          <>
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Strength: {localShadowConfig.strength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localShadowConfig.strength}
                onChange={(e) => {
                  const newStrength = parseFloat(e.target.value);
                  const newConfig = { ...localShadowConfig, strength: newStrength };
                  setLocalShadowConfig(newConfig);
                  updateShadowConfig(newConfig);
                }}
                className="flex-1"
                data-testid="slider-shadow-strength"
              />
            </div>
            
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Max Length: {localShadowConfig.maxLength}
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={localShadowConfig.maxLength}
                onChange={(e) => {
                  const newLength = parseFloat(e.target.value);
                  const newConfig = { ...localShadowConfig, maxLength: newLength };
                  setLocalShadowConfig(newConfig);
                  updateShadowConfig(newConfig);
                }}
                className="flex-1"
                data-testid="slider-shadow-max-length"
              />
            </div>
            
            <div className="flex items-center space-x-2 mb-1">
              <label className="text-xs text-muted-foreground min-w-[80px]">
                Shadow Bias: {(localShadowConfig.bias || 3.0).toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={localShadowConfig.bias || 3.0}
                onChange={(e) => {
                  const newBias = parseFloat(e.target.value);
                  const newConfig = { ...localShadowConfig, bias: newBias };
                  setLocalShadowConfig(newConfig);
                  updateShadowConfig(newConfig);
                }}
                className="flex-1"
                data-testid="slider-shadow-bias"
              />
            </div>
            
            {/* Removed shadow sharpness slider */}
            
            {/* Ambient Occlusion Controls - part of shadow system */}
            <div className="mt-3 pt-2 border-t border-border/50">
              <div className="flex items-center space-x-2 mb-2">
                <Contrast size={12} className="text-muted-foreground" />
                <h5 className="text-xs font-medium text-muted-foreground">Ambient Occlusion</h5>
                <button
                  onClick={() => {
                    const newConfig = { ...localAOConfig, enabled: !localAOConfig.enabled };
                    setLocalAOConfig(newConfig);
                    updateAmbientOcclusionConfig(newConfig);
                  }}
                  className={`ml-auto p-1 rounded text-xs ${
                    localAOConfig.enabled 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid="button-toggle-ao"
                >
                  {localAOConfig.enabled ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              </div>
              
              {localAOConfig.enabled && (
                <>
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="text-xs text-muted-foreground min-w-[70px]">
                      Strength: {localAOConfig.strength.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.05"
                      value={localAOConfig.strength}
                      onChange={(e) => {
                        const newStrength = parseFloat(e.target.value);
                        const newConfig = { ...localAOConfig, strength: newStrength };
                        setLocalAOConfig(newConfig);
                        updateAmbientOcclusionConfig(newConfig);
                      }}
                      className="flex-1"
                      data-testid="slider-ao-strength"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="text-xs text-muted-foreground min-w-[70px]">
                      Radius: {localAOConfig.radius}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={localAOConfig.radius}
                      onChange={(e) => {
                        const newRadius = parseFloat(e.target.value);
                        const newConfig = { ...localAOConfig, radius: newRadius };
                        setLocalAOConfig(newConfig);
                        updateAmbientOcclusionConfig(newConfig);
                      }}
                      className="flex-1"
                      data-testid="slider-ao-radius"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="text-xs text-muted-foreground min-w-[70px]">
                      Samples: {localAOConfig.samples}
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="16"
                      step="2"
                      value={localAOConfig.samples}
                      onChange={(e) => {
                        const newSamples = parseInt(e.target.value);
                        const newConfig = { ...localAOConfig, samples: newSamples };
                        setLocalAOConfig(newConfig);
                        updateAmbientOcclusionConfig(newConfig);
                      }}
                      className="flex-1"
                      data-testid="slider-ao-samples"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-1">
                    <label className="text-xs text-muted-foreground min-w-[70px]">
                      Bias: {localAOConfig.bias.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.5"
                      value={localAOConfig.bias}
                      onChange={(e) => {
                        const newBias = parseFloat(e.target.value);
                        const newConfig = { ...localAOConfig, bias: newBias };
                        setLocalAOConfig(newConfig);
                        updateAmbientOcclusionConfig(newConfig);
                      }}
                      className="flex-1"
                      data-testid="slider-ao-bias"
                    />
                  </div>
                  
                </>
              )}
            </div>
            
          </>
        )}
      </div>

      {/* Compact Light Controls - exclude directional lights (they have their own section) */}
      {localLights.filter(light => light.type !== 'directional').map((light) => {
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
                {editingLightId === light.id ? (
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => finishRename(light.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishRename(light.id);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      className="text-xs font-medium bg-input border border-border rounded px-1 py-0.5 w-20 text-foreground"
                      placeholder="No spaces"
                      autoFocus
                      data-testid={`input-rename-${light.id}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      ({light.type})
                    </span>
                  </div>
                ) : (
                  <>
                    <span 
                      className="text-xs font-medium text-foreground cursor-pointer hover:text-primary flex items-center space-x-1"
                      onClick={() => startRename(light.id, light.id)}
                      data-testid={`text-light-name-${light.id}`}
                    >
                      <span>{light.id}</span>
                      <Edit3 size={10} className="opacity-50" />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({light.type})
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {!light.mask && (light.type === 'point' || light.type === 'spotlight') && (
                  <button
                    onClick={() => addMask(light.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-1 rounded text-xs flex items-center"
                    data-testid={`button-add-mask-${light.id}`}
                    title="Add Mask"
                  >
                    <ImageIcon size={12} />
                  </button>
                )}
                <button
                  onClick={() => duplicateLight(light.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded text-xs flex items-center"
                  data-testid={`button-duplicate-${light.id}`}
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => deleteLight(light.id)}
                  className="bg-red-600 hover:bg-red-700 text-white p-1 rounded text-xs flex items-center"
                  data-testid={`button-delete-${light.id}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
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
                      max="10"
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
                          max="5000"
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
                    {/* Row 4: Shadow Casting */}
                    <div className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={light.castsShadows !== false}
                        onChange={(e) => updateLight(light.id, { castsShadows: e.target.checked })}
                        className="w-3 h-3"
                        data-testid={`checkbox-${light.id}-casts-shadows`}
                      />
                      <label className="text-xs text-muted-foreground">Cast Shadows</label>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Z: {light.position.z}
                      </span>
                    </div>
                  </>
                )}

                {/* Directional Light Controls - SINGLE ANGLE */}
                {light.type === 'directional' && (
                  <>
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
                    {/* Shadow Casting */}
                    <div className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={light.castsShadows !== false}
                        onChange={(e) => updateLight(light.id, { castsShadows: e.target.checked })}
                        className="w-3 h-3"
                        data-testid={`checkbox-${light.id}-casts-shadows`}
                      />
                      <label className="text-xs text-muted-foreground">Cast Shadows</label>
                    </div>
                  </>
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
                          max="5000"
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
                    {/* Direction Controls */}
                    <div className="grid grid-cols-3 gap-1 mt-2">
                      {['x', 'y', 'z'].map((axis, idx) => {
                        const value = axis === 'x' ? light.direction.x : axis === 'y' ? light.direction.y : light.direction.z;
                        const max = 1;
                        const min = -1;
                        return (
                          <div key={`dir-${axis}`} className="flex items-center space-x-1">
                            <label className="text-xs text-muted-foreground min-w-[25px]">
                              D{axis.toUpperCase()}: {value.toFixed(1)}
                            </label>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step="0.1"
                              value={value}
                              onChange={(e) => updateLight(light.id, { 
                                direction: { ...light.direction, [axis]: parseFloat(e.target.value) }
                              })}
                              className="flex-1"
                              data-testid={`slider-${light.id}-direction-${axis}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Shadow Casting */}
                    <div className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={light.castsShadows !== false}
                        onChange={(e) => updateLight(light.id, { castsShadows: e.target.checked })}
                        className="w-3 h-3"
                        data-testid={`checkbox-${light.id}-casts-shadows`}
                      />
                      <label className="text-xs text-muted-foreground">Cast Shadows</label>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Z: {light.position.z}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mask Controls - Show at bottom when mask is present for enabled point/spotlight only */}
            {light.enabled && light.mask && (light.type === 'point' || light.type === 'spotlight') && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between space-x-2">
                  <label className="text-xs text-muted-foreground min-w-[40px]">
                    Mask:
                  </label>
                  <select
                    value={light.mask?.image || ''}
                    onChange={(e) => changeMask(light.id, e.target.value)}
                    className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground"
                    data-testid={`dropdown-mask-${light.id}`}
                  >
                    {availableMasks.map((maskFile) => (
                      <option key={maskFile} value={maskFile}>
                        {maskFile.replace('.png', '')}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeMask(light.id)}
                    className="bg-red-600 hover:bg-red-700 text-white p-1 rounded text-xs"
                    data-testid={`button-remove-mask-${light.id}`}
                    title="Remove Mask"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                
                {/* Mask Properties Controls */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {/* Offset X/Y */}
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-muted-foreground min-w-[30px]">
                      OX: {light.mask?.offset.x || 0}
                    </label>
                    <input
                      type="range"
                      min="-1000"
                      max="1000"
                      step="5"
                      value={light.mask?.offset.x || 0}
                      onChange={(e) => updateMaskProperty(light.id, 'offset', { 
                        ...light.mask?.offset, 
                        x: parseFloat(e.target.value) 
                      })}
                      className="flex-1"
                      data-testid={`slider-${light.id}-mask-offset-x`}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-muted-foreground min-w-[30px]">
                      OY: {light.mask?.offset.y || 0}
                    </label>
                    <input
                      type="range"
                      min="-1000"
                      max="1000"
                      step="5"
                      value={light.mask?.offset.y || 0}
                      onChange={(e) => updateMaskProperty(light.id, 'offset', { 
                        ...light.mask?.offset, 
                        y: parseFloat(e.target.value) 
                      })}
                      className="flex-1"
                      data-testid={`slider-${light.id}-mask-offset-y`}
                    />
                  </div>
                  
                  {/* Rotation and Scale */}
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-muted-foreground min-w-[30px]">
                      R: {light.mask?.rotation || 0}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={light.mask?.rotation || 0}
                      onChange={(e) => updateMaskProperty(light.id, 'rotation', parseFloat(e.target.value))}
                      className="flex-1"
                      data-testid={`slider-${light.id}-mask-rotation`}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-muted-foreground min-w-[30px]">
                      S: {light.mask?.scale.toFixed(1) || 1.0}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={light.mask?.scale || 1}
                      onChange={(e) => updateMaskProperty(light.id, 'scale', parseFloat(e.target.value))}
                      className="flex-1"
                      data-testid={`slider-${light.id}-mask-scale`}
                    />
                  </div>
                </div>
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