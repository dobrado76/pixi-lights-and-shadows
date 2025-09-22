import { useState } from 'react';

const CodeDisplay = () => {
  const [activeTab, setActiveTab] = useState('geometry');
  
  const codeExamples = {
    geometry: `// Custom PIXI.Geometry Creation
const geometry = new PIXI.Geometry();

// Fullscreen quad vertices
const vertices = [
    0, 0,           // top-left
    width, 0,       // top-right  
    width, height,  // bottom-right
    0, height       // bottom-left
];

// UV coordinates for texture mapping
const uvs = [0, 0, 1, 0, 1, 1, 0, 1];

// Triangle indices
const indices = [0, 1, 2, 0, 2, 3];

geometry.addAttribute('aVertexPosition', vertices, 2);
geometry.addAttribute('aTextureCoord', uvs, 2);
geometry.addIndex(indices);`,

    shader: `// PIXI.Shader with custom vertex/fragment
const vertexShader = \`
    attribute vec2 aVertexPosition;
    attribute vec2 aTextureCoord;
    uniform mat3 projectionMatrix;
    varying vec2 vTextureCoord;

    void main(void) {
        gl_Position = vec4((projectionMatrix * 
            vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        vTextureCoord = aTextureCoord;
    }
\`;

const fragmentShader = \`
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec3 uColor;
    
    void main(void) {
        vec2 uv = vTextureCoord;
        float wave = sin(uv.x * 8.0 + uTime) * 0.02;
        uv.y += wave;
        
        vec4 texColor = texture2D(uTexture, uv);
        gl_FragColor = vec4(texColor.rgb * uColor, 1.0);
    }
\`;`,

    mesh: `// PIXI.Mesh combining geometry and shader
const shader = PIXI.Shader.from(
    vertexShader, 
    fragmentShader, 
    {
        uTexture: texture,
        uTime: 0,
        uColor: [1.0, 1.0, 1.0]
    }
);

const mesh = new PIXI.Mesh(geometry, shader);
app.stage.addChild(mesh);

// Update uniforms in render loop
app.ticker.add(() => {
    shader.uniforms.uTime += 0.02;
});`
  };
  
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex border-b border-border">
        {Object.keys(codeExamples).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
            data-testid={`code-tab-${tab}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="code-block p-4">
        <pre className="text-xs text-card-foreground font-mono overflow-x-auto" data-testid="code-content">
          <code>{codeExamples[activeTab as keyof typeof codeExamples]}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeDisplay;
