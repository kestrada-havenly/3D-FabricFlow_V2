import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { TextureLoader, RepeatWrapping, Mesh, Texture, MeshStandardMaterial, DoubleSide, Box3, Vector3, SRGBColorSpace, CanvasTexture, NearestFilter, WireframeGeometry, LineSegments, LineBasicMaterial, Group, Color } from 'three';
import { Html, Line } from '@react-three/drei';
import { ModelProps, Unit, UVMeshData } from '../types';

// Helper component for dimension labels and lines
const DimensionLabels = ({ box, unit }: { box: Box3, unit: Unit }) => {
  const { size, center, min, max } = useMemo(() => {
    const s = new Vector3();
    box.getSize(s);
    const c = new Vector3();
    box.getCenter(c);
    return { size: s, center: c, min: box.min, max: box.max };
  }, [box]);

  const Label = ({ position, text }: { position: [number, number, number], text: string }) => (
    <Html position={position} center zIndexRange={[100, 0]}>
      <div className="px-2 py-1 bg-black text-white text-xs font-bold font-mono rounded-md shadow-sm border border-gray-600 whitespace-nowrap opacity-90">
        {text}
      </div>
    </Html>
  );

  // Define line points corresponding to the labels
  // Width: Along the bottom front edge
  const widthPoints = useMemo(() => [
    [min.x, min.y, max.z],
    [max.x, min.y, max.z]
  ] as [number, number, number][], [min, max]);

  // Height: Along the right front edge
  const heightPoints = useMemo(() => [
    [max.x, min.y, max.z],
    [max.x, max.y, max.z]
  ] as [number, number, number][], [min, max]);

  // Depth: Along the right bottom edge
  const depthPoints = useMemo(() => [
    [max.x, min.y, min.z],
    [max.x, min.y, max.z]
  ] as [number, number, number][], [min, max]);

  const lineColor = "#000000"; // Black
  const lineWidth = 1.5;

  // Format values based on Unit (1 inch = 25.4 mm)
  const formatVal = (val: number) => {
    if (unit === 'mm') {
      return `${(val * 25.4).toFixed(0)} mm`;
    }
    return `${val.toFixed(1)} in`;
  };

  return (
    <group>
      {/* Visual Lines with depthTest={false} so they are always visible */}
      <Line points={widthPoints} color={lineColor} lineWidth={lineWidth} depthTest={false} opacity={0.5} transparent />
      <Line points={heightPoints} color={lineColor} lineWidth={lineWidth} depthTest={false} opacity={0.5} transparent />
      <Line points={depthPoints} color={lineColor} lineWidth={lineWidth} depthTest={false} opacity={0.5} transparent />

      {/* Width (X) - Bottom Center */}
      <Label 
        position={[center.x, min.y, max.z]} 
        text={`W: ${formatVal(size.x)}`} 
      />
      {/* Height (Y) - Right Center */}
      <Label 
        position={[max.x, center.y, max.z]} 
        text={`H: ${formatVal(size.y)}`} 
      />
      {/* Depth (Z) - Right Bottom */}
      <Label 
        position={[max.x, min.y, center.z]} 
        text={`D: ${formatVal(size.z)}`} 
      />
    </group>
  );
};

// Generate a procedural checkerboard UV Grid texture
const createUVGridTexture = () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    const tileSize = 64;
    
    // Draw checkerboard
    for (let y = 0; y < size / tileSize; y++) {
      for (let x = 0; x < size / tileSize; x++) {
        const isWhite = (x + y) % 2 === 0;
        ctx.fillStyle = isWhite ? '#e0e0e0' : '#404040';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        
        // Add coordinates
        ctx.font = '10px monospace';
        ctx.fillStyle = isWhite ? '#000000' : '#ffffff';
        ctx.fillText(`${x},${y}`, x * tileSize + 4, y * tileSize + 14);
      }
    }
    
    // Draw borders
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);
    
    // Draw diagonal
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(size, size);
    ctx.strokeStyle = 'rgba(0,0,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
};

export const SceneModel: React.FC<ModelProps> = ({ 
  modelUrl, 
  modelType,
  textureUrl, 
  transform, 
  submeshTransforms,
  selectedMeshId,
  onMeshSelect,
  onAnchorCalculated,
  showDimensions = true, 
  showWireframe = false,
  showUVGrid = false,
  unit,
  onUVsLoaded,
  useTriplanar,
  useSubmeshScale,
  uvStandardSize
}) => {
  const { gl } = useThree();
  const groupRef = useRef<Group>(null);
  
  // Select Loader based on type
  const Loader = useMemo(() => {
    return modelType === 'obj' ? OBJLoader : FBXLoader;
  }, [modelType]);

  // Load the Model if URL exists
  // @ts-ignore - Three.js loaders are compatible enough for this usage
  const model = useLoader(Loader, modelUrl || '');

  // Keep track of all meshes for iteration
  const meshRefs = useRef<Mesh[]>([]);

  // 1. Initial Processing of Model
  useEffect(() => {
    if (model) {
      meshRefs.current = [];
      const data: UVMeshData[] = [];

      model.traverse((child: any) => {
        if ((child as Mesh).isMesh) {
          const m = child as Mesh;
          
          // IMPORTANT: Clone material so each mesh can have independent texture transforms
          // If the model shares materials, we need to break that link for our editor
          if (!Array.isArray(m.material)) {
             m.material = m.material.clone();
          }

          // Generate UUID if missing (standard Three.js objects have them)
          meshRefs.current.push(m);

          // Collect UV Data for Viewer
          if (m.geometry.attributes.uv) {
            data.push({
              uvs: m.geometry.attributes.uv.array as Float32Array,
              index: m.geometry.index ? (m.geometry.index.array as Uint16Array | Uint32Array) : null,
              count: m.geometry.attributes.position.count
            });
          }
        }
      });
      
      if (onUVsLoaded) onUVsLoaded(data);
    }
  }, [model, onUVsLoaded]);

  // Calculate bounding box for dimensions based on Meshes only
  const boundingBox = useMemo(() => {
    if (!model) return null;
    model.updateMatrixWorld(true);
    const box = new Box3();
    let hasMesh = false;
    model.traverse((child: any) => {
      if ((child as Mesh).isMesh) {
        box.expandByObject(child);
        hasMesh = true;
      }
    });
    if (!hasMesh) box.setFromObject(model);
    if (box.isEmpty()) {
       box.min.set(-0.5, -0.5, -0.5);
       box.max.set(0.5, 0.5, 0.5);
    }
    return box;
  }, [model]);

  // Load the User Texture (Base)
  const userTextureBase = useMemo(() => {
    if (!textureUrl) return null;
    const tex = new TextureLoader().load(textureUrl);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    return tex;
  }, [textureUrl, gl]);

  const uvGridTextureBase = useMemo(() => createUVGridTexture(), []);
  
  const baseTexture = showUVGrid ? uvGridTextureBase : userTextureBase;

  // 2. Texture Assignment Logic
  // We need to assign a CLONE of the texture to each mesh so we can offset UVs independently
  useEffect(() => {
    meshRefs.current.forEach(mesh => {
       // Reset material to standard if needed
       if (!(mesh.material instanceof MeshStandardMaterial)) {
          mesh.material = new MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.8 });
       }
       const mat = mesh.material as MeshStandardMaterial;

       // Inject Triplanar Shader Logic
       mat.onBeforeCompile = (shader) => {
          shader.uniforms.uTextureSize = { value: new Vector3(1, 1, 1) }; // Using vec3 for flexibility, though vec2 is enough
          shader.uniforms.uScale = { value: 1.0 };
          shader.uniforms.uUseTriplanar = { value: 0.0 }; // 0 = false, 1 = true
          
          // Inject Vertex Logic
          shader.vertexShader = 'varying vec3 vWorldPosition;\nvarying vec3 vWorldNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            `
          );

          // Inject Fragment Logic
          shader.fragmentShader = `
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            uniform vec3 uTextureSize;
            uniform float uScale;
            uniform float uUseTriplanar;
          ` + shader.fragmentShader;

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #ifdef USE_MAP
              vec4 sampledDiffuseColor = vec4(1.0);
              
              if (uUseTriplanar > 0.5) {
                  // Triplanar Mapping
                  vec3 blend = abs(vWorldNormal);
                  blend = normalize(max(blend, 0.00001)); // Avoid div by zero
                  float b = blend.x + blend.y + blend.z;
                  blend /= b;
                  
                  // Calculate UVs
                  // uTextureSize contains (width, height, unused)
                  // We map world units to texture units.
                  // If textureWidth is 10, then 10 world units = 1 texture repeat.
                  // So uv = pos / textureWidth.
                  // We also apply uScale (scale modifier).
                  
                  // Effective size in world units
                  float effW = max(0.01, uTextureSize.x);
                  float effH = max(0.01, uTextureSize.y);
                  
                  // Adjust by scale slider (uScale)
                  // If scale is 2.0, texture looks 2x bigger? Or repeats 2x more?
                  // In the existing logic: repeat = (modelSize / texSize) * scale
                  // So higher scale = more repeats = smaller texture features.
                  // So uv = pos * (scale / texSize)
                  
                  float sx = uScale / effW;
                  float sy = uScale / effH;
                  
                  vec2 uvX = vWorldPosition.yz * vec2(sx, sy);
                  vec2 uvY = vWorldPosition.xz * vec2(sx, sy);
                  vec2 uvZ = vWorldPosition.xy * vec2(sx, sy);
                  
                  vec4 cx = texture2D(map, uvX);
                  vec4 cy = texture2D(map, uvY);
                  vec4 cz = texture2D(map, uvZ);
                  
                  sampledDiffuseColor = cx * blend.x + cy * blend.y + cz * blend.z;
              } else {
                  // Standard UV Mapping
                  sampledDiffuseColor = texture2D( map, vMapUv );
              }
              
              diffuseColor *= sampledDiffuseColor;
            #endif
            `
          );
          
          mat.userData.shader = shader;
       };

       if (baseTexture) {
          // Clone the texture structure (shares the image data, lightweight)
          const texClone = baseTexture.clone();
          texClone.colorSpace = baseTexture.colorSpace; // Important to copy encoding
          texClone.wrapS = RepeatWrapping;
          texClone.wrapT = RepeatWrapping;
          
          mat.map = texClone;
          mat.roughness = 1.0;
          mat.metalness = 0.0;
          mat.transparent = true;
          mat.needsUpdate = true; // Trigger recompile
       } else {
          mat.map = null;
          mat.color.set('#f0f0f0');
          mat.needsUpdate = true;
       }
    });
  }, [baseTexture]);


  // 3. Render Loop: Apply Transforms & Highlights
  useFrame((state) => {
    if (!boundingBox) return;
    const modelSize = new Vector3();
    boundingBox.getSize(modelSize);
    const time = state.clock.getElapsedTime();

    meshRefs.current.forEach(mesh => {
      const mat = mesh.material as MeshStandardMaterial;
      const isSelected = mesh.uuid === selectedMeshId;

      // --- A. Selection Highlight ---
      if (isSelected) {
         // Pulse emissive color
         const pulse = (Math.sin(time * 4) + 1) * 0.15 + 0.1; 
         mat.emissive.setRGB(0.2, 0.4, 1.0); // Blueish tint
         mat.emissiveIntensity = pulse;
      } else {
         mat.emissive.setRGB(0, 0, 0);
         mat.emissiveIntensity = 0;
      }

      // --- B. Texture Transforms ---
      if (mat.map) {
        // Determine which transform to use
        const t = (submeshTransforms && submeshTransforms[mesh.uuid]) ? submeshTransforms[mesh.uuid] : transform;
        
        const tex = mat.map;
        const texWidth = Math.max(0.1, t.textureWidth);
        const texHeight = Math.max(0.1, t.textureHeight);

        // Update Uniforms if shader is compiled
        if (mat.userData.shader) {
            mat.userData.shader.uniforms.uUseTriplanar.value = useTriplanar ? 1.0 : 0.0;
            mat.userData.shader.uniforms.uTextureSize.value.set(texWidth, texHeight, 1.0);
            mat.userData.shader.uniforms.uScale.value = t.scale;
        }

        // Standard UV Logic (Fallback or if Triplanar disabled)
        // Even if Triplanar is enabled, we update these so if user toggles back, it's correct.
        // Also, standard UV logic is used for 'map' texture reference in standard shader.
        
        let repeatX = 1;
        let repeatY = 1;

        if (useSubmeshScale) {
            // If using Standard UV Scale, we assume 1 UV unit = uvStandardSize (e.g. 20 inches)
            // So if texture is 10 inches, it should repeat 2 times (20/10).
            // We ignore the model size because the UVs are already scaled to physical units.
            repeatX = (uvStandardSize / texWidth) * t.scale;
            repeatY = (uvStandardSize / texHeight) * t.scale;
        } else {
            // Default: Fit texture to model bounds (or submesh bounds if we kept that logic, but let's stick to global for now)
            repeatX = (modelSize.x / texWidth) * t.scale;
            repeatY = (modelSize.y / texHeight) * t.scale;
        }

        tex.repeat.set(repeatX, repeatY);
        tex.offset.set(t.offsetX, t.offsetY);
        tex.rotation = t.rotation;
        tex.center.set(0.5, 0.5);
      }
    });
  });

  // 4. Wireframe Logic
  useEffect(() => {
    meshRefs.current.forEach(mesh => {
      let wireframeChild = mesh.children.find(c => c.name === '__wireframe__');
      if (showWireframe) {
        if (!wireframeChild) {
          const wireframeGeo = new WireframeGeometry(mesh.geometry);
          const wireframeMat = new LineBasicMaterial({ 
            color: 0x000000, 
            opacity: 0.2, 
            transparent: true,
            depthTest: false 
          });
          const lines = new LineSegments(wireframeGeo, wireframeMat);
          lines.name = '__wireframe__';
          mesh.add(lines);
        } else {
          wireframeChild.visible = true;
        }
      } else {
        if (wireframeChild) wireframeChild.visible = false;
      }
    });
  }, [showWireframe, model]);

  const handlePointerDown = (e: any) => {
    // Stop propagation so we don't click "through" to other meshes easily if overlapping
    e.stopPropagation();
    
    // Check if we clicked a mesh
    if (e.object && (e.object as Mesh).isMesh) {
       // Toggle selection: if clicking same mesh, deselect? Or keep selected? 
       // Usually keep selected. Clicking background (handled by OrbitControls/Canvas) handles deselect? 
       // We need a background click handler for that.
       // For now, just select.
       const mesh = e.object as Mesh;
       if (onMeshSelect) {
         onMeshSelect(mesh.uuid, mesh.name || "Untitled Part");
       }
       if (onAnchorCalculated) {
         mesh.updateMatrixWorld(true);
         const box = new Box3().setFromObject(mesh);
         const size = new Vector3();
         box.getSize(size);
         onAnchorCalculated(size.y);
       }
    }
  };

  const handleMissed = () => {
    if (onMeshSelect) onMeshSelect(null, null);
  };

  return (
    <group 
      ref={groupRef} 
      onPointerDown={handlePointerDown}
      onPointerMissed={handleMissed}
    >
      <primitive object={model} dispose={null} />
      {showDimensions && boundingBox && <DimensionLabels box={boundingBox} unit={unit} />}
    </group>
  );
};