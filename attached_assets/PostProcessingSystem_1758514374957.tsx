import React, { useEffect, useMemo, useRef } from 'react';
import { useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { fullscreenVertexShader, finalCompositeShader } from './shaders';

export const PostProcessingSystem = ({ children }: { children?: React.ReactNode }) => {
    const app = useApp();
    
    // Create containers for two-pass rendering: diffuse and normal maps
    const diffuseContainer = useRef(new PIXI.Container());
    const normalContainer = useRef(new PIXI.Container());

    // 1. Create the render textures and the final shader material
    const pipeline = useMemo(() => {
        const screen = app.screen;
        
        // Textures for two-pass rendering: diffuse and normal maps
        const diffuseTexture = PIXI.RenderTexture.create({ width: screen.width, height: screen.height });
        const normalTexture = PIXI.RenderTexture.create({ width: screen.width, height: screen.height });

        // The shader for normal-mapped lighting
        const finalShader = PIXI.Shader.from(fullscreenVertexShader, finalCompositeShader, {
            uDiffuse: diffuseTexture,
            uNormal: normalTexture,
            uLightPos: [screen.width / 2, screen.height / 2],
            uResolution: [screen.width, screen.height],
            uLightColor: [1.0, 0.9, 0.7], // Warm light
            uAmbient: [0.2, 0.2, 0.3], // Cool ambient
            uRadius: 300.0,
            uIntensity: 1.5
        });

        // The fullscreen "TV screen" mesh
        const geometry = new PIXI.Geometry()
            .addAttribute('aVertexPosition', [0, 0, screen.width, 0, screen.width, screen.height, 0, screen.height], 2)
            .addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2)
            .addIndex([0, 1, 2, 0, 2, 3]);
        
        const quad = new PIXI.Mesh(geometry, finalShader);

        // Expose mouse update function globally for light position
        (window as any).pixiPostProcessingMouse = (x: number, y: number) => {
            finalShader.uniforms.uLightPos = [x, y];
            console.log('PostProcessingSystem: Light position updated to', x, y);
        };
        
        console.log('PostProcessingSystem: Normal-mapped lighting pipeline initialized');
        console.log('PostProcessingSystem: PIXI.Geometry created with attributes and indices');
        console.log('PostProcessingSystem: PIXI.Shader created from vertex/fragment shaders');
        console.log('PostProcessingSystem: PIXI.Mesh created with geometry + shader');

        return { diffuseTexture, normalTexture, quad, finalShader };
    }, [app.screen.width, app.screen.height]);

    // Main render-to-texture pipeline
    useEffect(() => {
        // Add containers to stage but keep them invisible (only for RTT)
        app.stage.addChild(diffuseContainer.current);
        app.stage.addChild(normalContainer.current);
        diffuseContainer.current.visible = false;
        normalContainer.current.visible = false;

        // Add the fullscreen quad that will display the final result
        app.stage.addChild(pipeline.quad);
        
        console.log('PostProcessingSystem: Added fullscreen quad to stage for normal-mapped lighting');

        const ticker = () => {
            // PASS 1: Render diffuse sprites to diffuse texture
            app.renderer.render(diffuseContainer.current, {
                renderTexture: pipeline.diffuseTexture,
                clear: true,
            });

            // PASS 2: Render normal sprites to normal texture  
            app.renderer.render(normalContainer.current, {
                renderTexture: pipeline.normalTexture,
                clear: true,
            });
            
            // Debug: Periodically log render info
            if (Math.random() < 0.01) {
                console.log('PostProcessingSystem: RTT Pipeline active - Diffuse:', diffuseContainer.current.children.length, 'Normal:', normalContainer.current.children.length);
                console.log('PostProcessingSystem: PIXI.Mesh quad rendering with custom shader');
            }
        };

        app.ticker.add(ticker);

        return () => {
            app.ticker.remove(ticker);
            app.stage.removeChild(diffuseContainer.current);
            app.stage.removeChild(normalContainer.current); 
            app.stage.removeChild(pipeline.quad);
            pipeline.diffuseTexture.destroy();
            pipeline.normalTexture.destroy();
        };
    }, [app, pipeline]);

    // Create paired sprites for diffuse and normal containers
    useEffect(() => {
        if (!diffuseContainer.current || !normalContainer.current) return;
        
        const createPairedSprites = () => {
            try {
                console.log('PostProcessingSystem: Creating paired diffuse/normal sprites...');
                
                // Clear existing sprites
                diffuseContainer.current.removeChildren();
                normalContainer.current.removeChildren();
                
                // Load diffuse textures
                const bgDiffuse = PIXI.Texture.from("/Breakout_assets/images/BGTextureTest.jpg");
                const ballDiffuse = PIXI.Texture.from("/Breakout_assets/images/ball.png");
                const blockDiffuse = PIXI.Texture.from("/Breakout_assets/images/block.png");
                
                // Load normal map textures
                const bgNormal = PIXI.Texture.from("/Breakout_assets/images/BGTextureNORM.jpg");
                const ballNormal = PIXI.Texture.from("/Breakout_assets/images/ballN.png");
                const blockNormal = PIXI.Texture.from("/Breakout_assets/images/blockNormalMap.png");
                
                // Create paired background sprites
                const bgSpriteD = new PIXI.Sprite(bgDiffuse);
                const bgSpriteN = new PIXI.Sprite(bgNormal);
                [bgSpriteD, bgSpriteN].forEach(sprite => {
                    sprite.x = 0; sprite.y = 0;
                    sprite.width = app.screen.width;
                    sprite.height = app.screen.height;
                });
                diffuseContainer.current.addChild(bgSpriteD);
                normalContainer.current.addChild(bgSpriteN);
                
                // Create paired block sprites (3x2 grid)
                for (let i = 0; i < 6; i++) {
                    const blockSpriteD = new PIXI.Sprite(blockDiffuse);
                    const blockSpriteN = new PIXI.Sprite(blockNormal);
                    [blockSpriteD, blockSpriteN].forEach(sprite => {
                        sprite.x = 150 + (i % 3) * 250;
                        sprite.y = 150 + Math.floor(i / 3) * 100;
                        sprite.scale.set(1.5);
                    });
                    diffuseContainer.current.addChild(blockSpriteD);
                    normalContainer.current.addChild(blockSpriteN);
                }
                
                // Create paired ball sprites
                for (let i = 0; i < 3; i++) {
                    const ballSpriteD = new PIXI.Sprite(ballDiffuse);
                    const ballSpriteN = new PIXI.Sprite(ballNormal);
                    [ballSpriteD, ballSpriteN].forEach(sprite => {
                        sprite.x = 200 + i * 200;
                        sprite.y = 400;
                        sprite.scale.set(2.0);
                    });
                    diffuseContainer.current.addChild(ballSpriteD);
                    normalContainer.current.addChild(ballSpriteN);
                }
                
                console.log('PostProcessingSystem: Paired sprites created - Diffuse:', diffuseContainer.current.children.length, 'Normal:', normalContainer.current.children.length);
            } catch (error) {
                console.error('PostProcessingSystem: Failed to create paired sprites:', error);
            }
        };
        
        createPairedSprites();
        
        // Retry after delay to ensure textures load
        setTimeout(createPairedSprites, 1000);
    }, [app.screen.width, app.screen.height]);

    // Return null since we handle all rendering manually
    return null;
};