import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface SpriteConfig {
  id: string;
  image: string;
  normal?: string;
  position: { x: number; y: number };
  rotation?: number;
  scale?: number;
  zOrder: number;
  castsShadows: boolean;
  visible: boolean;
  useNormalMap?: boolean;
  metallic?: number;
  smoothness?: number;
  metallicMap?: string;
  smoothnessMap?: string;
  pivot?: {
    preset: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    offsetX?: number;
    offsetY?: number;
  };
}

interface SceneConfig {
  scene: Record<string, SpriteConfig>;
}

interface DynamicSpriteControlsProps {
  sceneConfig: SceneConfig;
  onSceneConfigChange: (newConfig: SceneConfig) => void;
  onImmediateSpriteChange?: (spriteId: string, updates: any) => void;
}

export function DynamicSpriteControls({ sceneConfig, onSceneConfigChange, onImmediateSpriteChange }: DynamicSpriteControlsProps) {
  const [expandedSprites, setExpandedSprites] = useState<Set<string>>(new Set());

  const toggleExpanded = (spriteId: string) => {
    const newExpanded = new Set(expandedSprites);
    if (newExpanded.has(spriteId)) {
      newExpanded.delete(spriteId);
    } else {
      newExpanded.add(spriteId);
    }
    setExpandedSprites(newExpanded);
  };

  const updateSpriteConfig = (spriteId: string, updates: Partial<SpriteConfig>) => {
    const currentSprite = sceneConfig.scene[spriteId];
    const newConfig = {
      ...sceneConfig,
      scene: {
        ...sceneConfig.scene,
        [spriteId]: {
          ...currentSprite,
          ...updates
        }
      }
    };
    
    console.log(`🎮 UI: ${spriteId} config changed:`, Object.keys(updates));
    
    // IMMEDIATE UPDATE for ALL sprite controls - bypass React state for instant feedback
    if (onImmediateSpriteChange) {
      onImmediateSpriteChange(spriteId, updates);
    }
    
    // Always update React state, but delay for visual-heavy changes to prevent conflicts
    if (updates.zOrder !== undefined) {
      // Only delay React state update for zOrder changes
      setTimeout(() => {
        onSceneConfigChange(newConfig);
      }, 100); // Short delay to avoid overriding immediate changes
    } else {
      // Immediate React state update for other changes (including useNormalMap)
      onSceneConfigChange(newConfig);
    }
  };

  const sprites = Object.entries(sceneConfig.scene || {});

  return (
    <Card className="w-full max-w-md bg-card/95 backdrop-blur border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          🎭 Scene Sprites
          <span className="text-xs text-muted-foreground">({sprites.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
        {sprites.map(([spriteId, sprite]) => {
          const isExpanded = expandedSprites.has(spriteId);
          
          return (
            <Collapsible key={spriteId} open={isExpanded} onOpenChange={() => toggleExpanded(spriteId)}>
              <Card className="border border-border/50 bg-card/50">
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-1 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sprite.visible ? (
                          <Eye className="h-4 w-4 text-green-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-red-500" />
                        )}
                        <div className="text-sm font-medium text-card-foreground">
                          {spriteId}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={sprite.visible}
                          onCheckedChange={(checked) => updateSpriteConfig(spriteId, { visible: checked })}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`switch-visible-${spriteId}`}
                        />
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    {sprite.visible && (
                      <>
                        {/* Position Controls */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">Position</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">X</Label>
                                <span className="text-xs text-muted-foreground">{Math.round(sprite.position.x)}</span>
                              </div>
                              <Slider
                                value={[sprite.position.x]}
                                onValueChange={([value]) => updateSpriteConfig(spriteId, {
                                  position: { ...sprite.position, x: value }
                                })}
                                min={-200}
                                max={800}
                                step={1}
                                className="h-4"
                                data-testid={`slider-position-x-${spriteId}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Y</Label>
                                <span className="text-xs text-muted-foreground">{Math.round(sprite.position.y)}</span>
                              </div>
                              <Slider
                                value={[sprite.position.y]}
                                onValueChange={([value]) => updateSpriteConfig(spriteId, {
                                  position: { ...sprite.position, y: value }
                                })}
                                min={-200}
                                max={600}
                                step={1}
                                className="h-4"
                                data-testid={`slider-position-y-${spriteId}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Rotation Control */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">Rotation</Label>
                            <span className="text-xs text-muted-foreground">{Math.round(((sprite.rotation || 0) * 180 / Math.PI + 360) % 360)}°</span>
                          </div>
                          <Slider
                            value={[((sprite.rotation || 0) * 180 / Math.PI + 360) % 360]}
                            onValueChange={([value]) => updateSpriteConfig(spriteId, {
                              rotation: value * Math.PI / 180
                            })}
                            min={0}
                            max={360}
                            step={1}
                            className="w-full"
                            data-testid={`slider-rotation-${spriteId}`}
                          />
                        </div>

                        {/* Scale Control */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">Scale</Label>
                            <span className="text-xs text-muted-foreground">{((sprite.scale || 1) * 100).toFixed(0)}%</span>
                          </div>
                          <Slider
                            value={[sprite.scale || 1]}
                            onValueChange={([value]) => updateSpriteConfig(spriteId, {
                              scale: value
                            })}
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            className="w-full"
                            data-testid={`slider-scale-${spriteId}`}
                          />
                        </div>

                        {/* Pivot Control */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium text-muted-foreground">Pivot</Label>
                            <Select
                              value={sprite.pivot?.preset || 'middle-center'}
                              onValueChange={(value: string) => {
                                updateSpriteConfig(spriteId, {
                                  pivot: {
                                    preset: value as any,
                                    offsetX: sprite.pivot?.offsetX || 0,
                                    offsetY: sprite.pivot?.offsetY || 0
                                  }
                                });
                              }}
                              data-testid={`select-pivot-${spriteId}`}
                            >
                              <SelectTrigger className="h-8 flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border border-border">
                                <SelectItem value="top-left" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Top Left</SelectItem>
                                <SelectItem value="top-center" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Top Center</SelectItem>
                                <SelectItem value="top-right" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Top Right</SelectItem>
                                <SelectItem value="middle-left" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Middle Left</SelectItem>
                                <SelectItem value="middle-center" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Middle Center</SelectItem>
                                <SelectItem value="middle-right" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Middle Right</SelectItem>
                                <SelectItem value="bottom-left" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Bottom Left</SelectItem>
                                <SelectItem value="bottom-center" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Bottom Center</SelectItem>
                                <SelectItem value="bottom-right" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Bottom Right</SelectItem>
                                <SelectItem value="custom-offset" className="bg-card text-foreground hover:bg-muted hover:text-foreground">Custom Offset</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Offset X</Label>
                              <Input
                                type="number"
                                value={sprite.pivot?.offsetX || 0}
                                onChange={(e) => updateSpriteConfig(spriteId, {
                                  pivot: {
                                    preset: sprite.pivot?.preset || 'middle-center',
                                    offsetX: parseFloat(e.target.value) || 0,
                                    offsetY: sprite.pivot?.offsetY || 0
                                  }
                                })}
                                className="h-8 text-xs"
                                data-testid={`input-pivot-offset-x-${spriteId}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Offset Y</Label>
                              <Input
                                type="number"
                                value={sprite.pivot?.offsetY || 0}
                                onChange={(e) => updateSpriteConfig(spriteId, {
                                  pivot: {
                                    preset: sprite.pivot?.preset || 'middle-center',
                                    offsetX: sprite.pivot?.offsetX || 0,
                                    offsetY: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-8 text-xs"
                                data-testid={`input-pivot-offset-y-${spriteId}`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Z-Order Control */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">Z-Order (Depth)</Label>
                            <span className="text-xs text-muted-foreground">
                              z:{sprite.zOrder} • {sprite.zOrder < 0 ? 'Behind' : sprite.zOrder === 0 ? 'Default' : 'Front'}
                            </span>
                          </div>
                          <Slider
                            value={[sprite.zOrder]}
                            onValueChange={([value]) => updateSpriteConfig(spriteId, { zOrder: value })}
                            min={-10}
                            max={10}
                            step={1}
                            className="w-full"
                            data-testid={`slider-zorder-${spriteId}`}
                          />
                        </div>

                        {/* Shadow & Rendering Controls */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-card-foreground">Casts Shadows & AO</Label>
                            <Switch
                              checked={sprite.castsShadows}
                              onCheckedChange={(checked) => updateSpriteConfig(spriteId, { castsShadows: checked })}
                              data-testid={`switch-casts-shadows-${spriteId}`}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-card-foreground">Use Normal Map</Label>
                            <Switch
                              checked={sprite.useNormalMap ?? true}
                              onCheckedChange={(checked) => updateSpriteConfig(spriteId, { useNormalMap: checked })}
                              data-testid={`switch-use-normal-map-${spriteId}`}
                            />
                          </div>
                        </div>

                        {/* PBR Material Properties */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-card-foreground">Metallic</Label>
                              <span className="text-xs text-muted-foreground">{((sprite.metallic ?? 0.0) * 100).toFixed(0)}%</span>
                            </div>
                            <Slider
                              value={[sprite.metallic ?? 0.0]}
                              onValueChange={([value]) => updateSpriteConfig(spriteId, { metallic: value })}
                              min={0.0}
                              max={1.0}
                              step={0.01}
                              className="w-full"
                              data-testid={`slider-metallic-${spriteId}`}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-card-foreground">Smoothness</Label>
                              <span className="text-xs text-muted-foreground">{((sprite.smoothness ?? 0.5) * 100).toFixed(0)}%</span>
                            </div>
                            <Slider
                              value={[sprite.smoothness ?? 0.5]}
                              onValueChange={([value]) => updateSpriteConfig(spriteId, { smoothness: value })}
                              min={0.0}
                              max={1.0}
                              step={0.01}
                              className="w-full"
                              data-testid={`slider-smoothness-${spriteId}`}
                            />
                          </div>
                        </div>

                        {/* Texture Info */}
                        <div className="space-y-1 pt-2 border-t border-border/50">
                          <div className="text-xs text-muted-foreground break-all">
                            <div><span className="font-medium">Diffuse:</span> {sprite.image}</div>
                            {sprite.normal && (
                              <div><span className="font-medium">Normal:</span> {sprite.normal}</div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    
                    {!sprite.visible && (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <EyeOff className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        Sprite is hidden - enable visibility to access controls
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
        
        {sprites.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No sprites found in scene configuration
          </div>
        )}
      </CardContent>
    </Card>
  );
}