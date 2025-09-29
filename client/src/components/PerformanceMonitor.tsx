import { useState } from 'react';
import { PerformanceSettings } from '../utils/performance';

interface PerformanceMonitorProps {
  fps: { current: number; average: number };
  deviceInfo: {
    isMobile: boolean;
    isTablet: boolean;
    isLowEnd: boolean;
    memory?: number;
    cores?: number;
    webglVersion: number;
  };
  performanceSettings: PerformanceSettings;
  onSettingsChange: (settings: PerformanceSettings) => void;
}

const PerformanceMonitor = ({ fps, deviceInfo, performanceSettings, onSettingsChange }: PerformanceMonitorProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleQualityChange = (quality: 'low' | 'medium' | 'high') => {
    const newSettings: PerformanceSettings = {
      ...performanceSettings,
      quality
    };

    // Update dependent settings based on quality
    switch (quality) {
      case 'low':
        newSettings.resolution = 0.5;
        newSettings.maxLights = 2;
        newSettings.enableShadows = false;
        newSettings.enableAmbientOcclusion = false;
        newSettings.enableNormalMapping = false;
        newSettings.enableLightMasks = false;
        newSettings.enablePCSS = false;
        newSettings.fpsTarget = 30;
        break;
      case 'medium':
        newSettings.resolution = 0.75;
        newSettings.maxLights = 4;
        newSettings.enableShadows = true;
        newSettings.enableAmbientOcclusion = false;
        newSettings.enableNormalMapping = true;
        newSettings.enableLightMasks = false;
        newSettings.enablePCSS = false;
        newSettings.fpsTarget = 45;
        break;
      case 'high':
        newSettings.resolution = 1.0;
        newSettings.maxLights = 999; // No limit for high quality
        newSettings.enableShadows = true;
        newSettings.enableAmbientOcclusion = true;
        newSettings.enableNormalMapping = true;
        newSettings.enableLightMasks = true;
        newSettings.enablePCSS = true;
        newSettings.fpsTarget = 60;
        break;
    }

    onSettingsChange(newSettings);
  };

  const toggleSetting = (setting: keyof PerformanceSettings) => {
    const newSettings = { ...performanceSettings };
    if (typeof newSettings[setting] === 'boolean') {
      (newSettings as any)[setting] = !(newSettings as any)[setting];
      // Mark as manual override when user manually toggles settings
      newSettings.manualOverride = true;
      onSettingsChange(newSettings);
    }
  };

  const getFpsColor = () => {
    if (fps.current >= performanceSettings.fpsTarget * 0.9) return 'text-green-400';
    if (fps.current >= performanceSettings.fpsTarget * 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDeviceIcon = () => {
    if (deviceInfo.isMobile) return '📱';
    if (deviceInfo.isTablet) return '📱';
    return '🖥️';
  };

  return (
    <div className="fixed top-4 right-4 bg-gray-900/90 backdrop-blur-sm text-white p-4 rounded-lg border border-gray-700 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Performance</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-400 hover:text-white"
          data-testid="toggle-performance-details"
        >
          {showDetails ? '▼' : '▶'}
        </button>
      </div>
      
      {/* FPS Display */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">FPS:</span>
        <span className={`text-sm font-mono ${getFpsColor()}`} data-testid="fps-current">
          {fps.current}
        </span>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">Avg:</span>
        <span className={`text-xs font-mono ${getFpsColor()}`} data-testid="fps-average">
          {fps.average}
        </span>
      </div>

      {/* Quality Control */}
      <div className="mb-3">
        <label className="text-xs text-gray-400 block mb-1">Quality:</label>
        <div className="flex gap-1">
          {(['low', 'medium', 'high'] as const).map((quality) => (
            <button
              key={quality}
              onClick={() => handleQualityChange(quality)}
              className={`px-2 py-1 text-xs rounded ${
                performanceSettings.quality === quality
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              data-testid={`quality-${quality}`}
            >
              {quality.charAt(0).toUpperCase() + quality.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Device Info */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{getDeviceIcon()}</span>
        <span data-testid="device-type">
          {deviceInfo.isMobile ? 'Mobile' : 'Desktop'}
          {deviceInfo.isLowEnd && ' (Low-end)'}
        </span>
      </div>

      {/* Detailed Info */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Resolution:</span>
            <span data-testid="setting-resolution">{(performanceSettings.resolution * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Max Lights:</span>
            <span data-testid="setting-max-lights">{performanceSettings.maxLights}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Shadows:</span>
            <button
              onClick={() => toggleSetting('enableShadows')}
              className={`w-6 h-3 rounded-full transition-colors ${
                performanceSettings.enableShadows ? 'bg-green-500' : 'bg-gray-600'
              }`}
              data-testid="toggle-shadows"
            >
              <div className={`w-2 h-2 bg-white rounded-full transition-transform ${
                performanceSettings.enableShadows ? 'translate-x-3' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">PCSS:</span>
            <button
              onClick={() => toggleSetting('enablePCSS')}
              className={`w-6 h-3 rounded-full transition-colors ${
                performanceSettings.enablePCSS ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              data-testid="toggle-pcss"
              disabled={!performanceSettings.enableShadows}
              title={!performanceSettings.enableShadows ? 'Enable shadows first' : 'Toggle soft shadows (PCSS)'}
            >
              <div className={`w-2 h-2 bg-white rounded-full transition-transform ${
                performanceSettings.enablePCSS ? 'translate-x-3' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">AO:</span>
            <button
              onClick={() => toggleSetting('enableAmbientOcclusion')}
              className={`w-6 h-3 rounded-full transition-colors ${
                performanceSettings.enableAmbientOcclusion ? 'bg-green-500' : 'bg-gray-600'
              }`}
              data-testid="toggle-ao"
            >
              <div className={`w-2 h-2 bg-white rounded-full transition-transform ${
                performanceSettings.enableAmbientOcclusion ? 'translate-x-3' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Normal Maps:</span>
            <button
              onClick={() => toggleSetting('enableNormalMapping')}
              className={`w-6 h-3 rounded-full transition-colors ${
                performanceSettings.enableNormalMapping ? 'bg-green-500' : 'bg-gray-600'
              }`}
              data-testid="toggle-normals"
            >
              <div className={`w-2 h-2 bg-white rounded-full transition-transform ${
                performanceSettings.enableNormalMapping ? 'translate-x-3' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Light Masks:</span>
            <button
              onClick={() => toggleSetting('enableLightMasks')}
              className={`w-6 h-3 rounded-full transition-colors ${
                performanceSettings.enableLightMasks ? 'bg-green-500' : 'bg-gray-600'
              }`}
              data-testid="toggle-masks"
            >
              <div className={`w-2 h-2 bg-white rounded-full transition-transform ${
                performanceSettings.enableLightMasks ? 'translate-x-3' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          {deviceInfo.memory && (
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span data-testid="device-memory">{deviceInfo.memory}GB</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">WebGL:</span>
            <span data-testid="device-webgl">v{deviceInfo.webglVersion}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;