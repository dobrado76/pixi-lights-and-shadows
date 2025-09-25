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
  zOrder: number;
  castsShadows: boolean;
  visible: boolean;
  useNormalMap?: boolean;
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
    
    // IMMEDIATE UPDATE for critical controls - bypass React rebuilds
    if (onImmediateSpriteChange) {
      onImmediateSpriteChange(spriteId, updates);
    }
    
    // For zOrder/normalMap: Update UI but delay React state to prevent rebuilds
    if (updates.zOrder !== undefined || updates.useNormalMap !== undefined) {
      // Update React state immediately for UI controls to move
      onSceneConfigChange(newConfig);
      console.log('🛡️ Immediate change - UI updated, PIXI handles visual');
    } else {
      // Normal React state update for non-critical changes
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
                            <Label className="text-xs text-card-foreground">Casts Shadows</Label>
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