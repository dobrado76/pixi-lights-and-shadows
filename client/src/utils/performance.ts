/**
 * Performance utilities for mobile optimization
 */

export interface PerformanceSettings {
  quality: 'low' | 'medium' | 'high';
  resolution: number;
  maxLights: number;
  enableShadows: boolean;
  enableAmbientOcclusion: boolean;
  enableNormalMapping: boolean;
  enableLightMasks: boolean;
  textureScale: number;
  fpsTarget: number;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isLowEnd: boolean;
  memory?: number;
  cores?: number;
  webglVersion: number;
}

// Detect device capabilities
export const detectDevice = (): DeviceInfo => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
  const gl2 = canvas.getContext('webgl2');
  
  // Check if mobile/tablet
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = /iPad|Android.*Tablet/i.test(navigator.userAgent);
  
  // Estimate device performance
  let isLowEnd = false;
  let memory = 0;
  let cores = navigator.hardwareConcurrency || 4;
  
  // Check for device memory API (only available on some browsers)
  if ('deviceMemory' in navigator) {
    memory = (navigator as any).deviceMemory || 0;
    isLowEnd = memory <= 2; // 2GB or less considered low-end
  } else {
    // Fallback heuristics for low-end detection
    isLowEnd = isMobile && cores <= 4;
  }
  
  // Additional low-end indicators
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // Common low-end mobile GPUs
      isLowEnd = isLowEnd || /Adreno 3|Mali-4|PowerVR SGX/i.test(renderer);
    }
  }
  
  return {
    isMobile,
    isTablet,
    isLowEnd,
    memory,
    cores,
    webglVersion: gl2 ? 2 : (gl ? 1 : 0)
  };
};

// Get optimal performance settings based on device
export const getOptimalSettings = (device: DeviceInfo): PerformanceSettings => {
  if (device.isLowEnd || (device.isMobile && device.memory && device.memory <= 3)) {
    // Low-end mobile devices
    return {
      quality: 'low',
      resolution: 0.5,
      maxLights: 2,
      enableShadows: false,
      enableAmbientOcclusion: false,
      enableNormalMapping: false,
      enableLightMasks: false,
      textureScale: 0.5,
      fpsTarget: 30
    };
  } else if (device.isMobile) {
    // Standard mobile devices
    return {
      quality: 'medium',
      resolution: 0.75,
      maxLights: 4,
      enableShadows: true,
      enableAmbientOcclusion: false,
      enableNormalMapping: true,
      enableLightMasks: false,
      textureScale: 0.75,
      fpsTarget: 45
    };
  } else {
    // Desktop devices
    return {
      quality: 'high',
      resolution: 1.0,
      maxLights: 8,
      enableShadows: true,
      enableAmbientOcclusion: true,
      enableNormalMapping: true,
      enableLightMasks: true,
      textureScale: 1.0,
      fpsTarget: 60
    };
  }
};

// FPS monitoring
export class FPSMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private samples: number[] = [];
  private readonly maxSamples = 60; // 1 second at 60fps
  
  constructor(private callback?: (fps: number, avgFps: number) => void) {}
  
  update(): { current: number; average: number } {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    if (deltaTime >= 1000) { // Update every second
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = currentTime;
      
      // Add to samples for rolling average
      this.samples.push(this.fps);
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
      
      const avgFps = Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
      
      if (this.callback) {
        this.callback(this.fps, avgFps);
      }
      
      return { current: this.fps, average: avgFps };
    }
    
    const avgFps = this.samples.length > 0 
      ? Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length)
      : 60;
      
    return { current: this.fps, average: avgFps };
  }
  
  getCurrentFPS(): number {
    return this.fps;
  }
  
  getAverageFPS(): number {
    return this.samples.length > 0 
      ? Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length)
      : 60;
  }
}

// Adaptive quality manager
export class AdaptiveQuality {
  private currentSettings: PerformanceSettings;
  private fpsMonitor: FPSMonitor;
  private adjustmentCooldown = 5000; // 5 seconds between adjustments
  private lastAdjustment = 0;
  
  constructor(
    initialSettings: PerformanceSettings,
    private onSettingsChange: (settings: PerformanceSettings) => void
  ) {
    this.currentSettings = { ...initialSettings };
    this.fpsMonitor = new FPSMonitor();
  }
  
  update(): { fps: number; avgFps: number; adjusted: boolean } {
    const fpsData = this.fpsMonitor.update();
    const now = performance.now();
    let adjusted = false;
    
    // Only adjust if cooldown has passed
    if (now - this.lastAdjustment > this.adjustmentCooldown) {
      const targetFps = this.currentSettings.fpsTarget;
      const avgFps = fpsData.average;
      
      // If performance is significantly below target, reduce quality
      if (avgFps < targetFps * 0.8 && this.currentSettings.quality !== 'low') {
        this.downgradeQuality();
        adjusted = true;
        this.lastAdjustment = now;
      }
      // If performance is stable above target, consider upgrading
      else if (avgFps > targetFps * 1.1 && this.currentSettings.quality !== 'high') {
        this.upgradeQuality();
        adjusted = true;
        this.lastAdjustment = now;
      }
    }
    
    return { fps: fpsData.current, avgFps: fpsData.average, adjusted };
  }
  
  private downgradeQuality() {
    console.log('📉 Performance below target, reducing quality...');
    
    if (this.currentSettings.quality === 'high') {
      this.currentSettings = {
        ...this.currentSettings,
        quality: 'medium',
        resolution: 0.75,
        maxLights: 4,
        enableAmbientOcclusion: false,
        enableLightMasks: false
      };
    } else if (this.currentSettings.quality === 'medium') {
      this.currentSettings = {
        ...this.currentSettings,
        quality: 'low',
        resolution: 0.5,
        maxLights: 2,
        enableShadows: false,
        enableNormalMapping: false
      };
    }
    
    this.onSettingsChange(this.currentSettings);
  }
  
  private upgradeQuality() {
    console.log('📈 Performance stable, increasing quality...');
    
    if (this.currentSettings.quality === 'low') {
      this.currentSettings = {
        ...this.currentSettings,
        quality: 'medium',
        resolution: 0.75,
        maxLights: 4,
        enableShadows: true,
        enableNormalMapping: true
      };
    } else if (this.currentSettings.quality === 'medium') {
      this.currentSettings = {
        ...this.currentSettings,
        quality: 'high',
        resolution: 1.0,
        maxLights: 8,
        enableAmbientOcclusion: true,
        enableLightMasks: true
      };
    }
    
    this.onSettingsChange(this.currentSettings);
  }
  
  getSettings(): PerformanceSettings {
    return { ...this.currentSettings };
  }
  
  setSettings(settings: PerformanceSettings) {
    this.currentSettings = { ...settings };
    this.onSettingsChange(this.currentSettings);
  }
}