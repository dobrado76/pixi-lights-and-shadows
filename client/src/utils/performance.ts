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
  manualOverride?: boolean;
  // Enhanced mobile settings
  shaderPrecision?: 'lowp' | 'mediump' | 'highp';
  enableViewportCulling?: boolean;
  frameSkipThreshold?: number;
  updateFrequencyScale?: number;
  enableProgressiveEnhancement?: boolean;
  enableRenderTargetPooling?: boolean;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isLowEnd: boolean;
  memory?: number;
  memoryEstimate?: boolean; // True if memory is an estimate from browser API
  cores?: number;
  webglVersion: number;
  gpuInfo?: string;
  // Enhanced mobile detection
  batteryLevel?: number;
  isCharging?: boolean;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  gpuTier?: 'low' | 'medium' | 'high' | 'ultra';
  supportedTextureCompression?: string[];
  maxTextureSize?: number;
  isLowPowerMode?: boolean;
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
  let memoryEstimate = false;
  let cores = navigator.hardwareConcurrency || 4;
  let gpuInfo = '';
  
  // Check for device memory API (only available on some browsers)
  // Note: This API returns conservative estimates for privacy reasons
  if ('deviceMemory' in navigator) {
    memory = (navigator as any).deviceMemory || 0;
    memoryEstimate = true; // Browser API estimate, not actual RAM
    
    // Better heuristics: if we detect high core count, assume high-end system
    if (cores >= 12) {
      // High core count suggests workstation/gaming rig
      isLowEnd = false;
    } else {
      isLowEnd = memory <= 2; // 2GB or less considered low-end
    }
  } else {
    // Fallback heuristics for low-end detection
    isLowEnd = isMobile && cores <= 4;
  }
  
  // Get GPU information for better performance assessment
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      gpuInfo = renderer;
      
      // Common low-end mobile GPUs
      const isLowEndGPU = /Adreno 3|Mali-4|PowerVR SGX/i.test(renderer);
      
      // High-end GPU indicators
      const isHighEndGPU = /RTX|GTX 16|GTX 20|GTX 30|GTX 40|RX 6|RX 7|Arc A/i.test(renderer);
      
      if (isHighEndGPU) {
        isLowEnd = false; // Override if high-end GPU detected
      } else if (isLowEndGPU) {
        isLowEnd = true;
      }
    }
  }
  
  return {
    isMobile,
    isTablet,
    isLowEnd,
    memory,
    memoryEstimate,
    cores,
    webglVersion: gl2 ? 2 : (gl ? 1 : 0),
    gpuInfo
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
    // Desktop devices - check for high-end capabilities
    const isHighEnd = (device.cores && device.cores >= 12) || (device.gpuInfo && /RTX|GTX 16|GTX 20|GTX 30|GTX 40|RX 6|RX 7|Arc A/i.test(device.gpuInfo));
    
    if (isHighEnd) {
      return {
        quality: 'high',
        resolution: 1.0,
        maxLights: 999, // No limit for high-end systems - let them use 50+ lights!
        enableShadows: true,
        enableAmbientOcclusion: true,
        enableNormalMapping: true,
        enableLightMasks: true,
        textureScale: 1.0,
        fpsTarget: 60
      };
    } else {
      // Regular desktop - medium quality
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
    }
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
  
  update(): { current: number; average: number; samples: number } {
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
      
      return { current: this.fps, average: avgFps, samples: this.samples.length };
    }
    
    const avgFps = this.samples.length > 0 
      ? Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length)
      : 60;
      
    return { current: this.fps, average: avgFps, samples: this.samples.length };
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
    
    // Respect manual override - don't adjust if user has manual control
    if (this.currentSettings.manualOverride) {
      return { fps: fpsData.current, avgFps: fpsData.average, adjusted: false };
    }
    
    // Only adjust if cooldown has passed and we have enough samples
    if (now - this.lastAdjustment > this.adjustmentCooldown && fpsData.samples >= 30) {
      const targetFps = this.currentSettings.fpsTarget;
      const avgFps = fpsData.average;
      
      // Much more conservative thresholds - 59 FPS should NOT trigger downgrade!
      // If performance is severely below target, reduce quality
      if (avgFps < targetFps * 0.5 && this.currentSettings.quality !== 'low') {
        this.downgradeQuality();
        adjusted = true;
        this.lastAdjustment = now;
        console.log(`📉 Performance severely below target (${avgFps.toFixed(1)} < ${(targetFps * 0.5).toFixed(1)}), reducing quality...`);
      }
      // If performance is consistently excellent, consider upgrading
      else if (avgFps > targetFps * 0.95 && this.currentSettings.quality !== 'high') {
        this.upgradeQuality();
        adjusted = true;
        this.lastAdjustment = now;
        console.log(`📈 Performance excellent (${avgFps.toFixed(1)} > ${(targetFps * 0.95).toFixed(1)}), increasing quality...`);
      }
    }
    
    return { fps: fpsData.current, avgFps: fpsData.average, adjusted };
  }
  
  private downgradeQuality() {
    // Don't downgrade if manual override is set
    if (this.currentSettings.manualOverride) {
      return;
    }
    
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
    // Don't upgrade if manual override is set
    if (this.currentSettings.manualOverride) {
      return;
    }
    
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
        maxLights: 999, // No limit for high-end performance
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