interface StatusPanelProps {
  geometryStatus: string;
  shaderStatus: string;
  meshStatus: string;
}

const StatusPanel = ({ geometryStatus, shaderStatus, meshStatus }: StatusPanelProps) => {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-card-foreground" data-testid="status-panel-title">
        PIXI Primitives Status
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 rounded-full bg-primary mt-2" data-testid="status-geometry-indicator"></div>
          <div>
            <div className="text-sm font-medium text-card-foreground">PIXI.Geometry</div>
            <div className="text-xs text-muted-foreground" data-testid="status-geometry-text">
              {geometryStatus}
            </div>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 rounded-full bg-secondary mt-2" data-testid="status-shader-indicator"></div>
          <div>
            <div className="text-sm font-medium text-card-foreground">PIXI.Shader</div>
            <div className="text-xs text-muted-foreground" data-testid="status-shader-text">
              {shaderStatus}
            </div>
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 rounded-full bg-accent mt-2" data-testid="status-mesh-indicator"></div>
          <div>
            <div className="text-sm font-medium text-card-foreground">PIXI.Mesh</div>
            <div className="text-xs text-muted-foreground" data-testid="status-mesh-text">
              {meshStatus}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
