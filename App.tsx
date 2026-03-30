import React, { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Grid, Html, useProgress, AdaptiveDpr, Bounds, useBounds } from '@react-three/drei';
import { ControlPanel } from './components/ControlPanel';
import { SceneModel } from './components/SceneModel';
import { GeminiAdvisor } from './components/GeminiAdvisor';
import { TexturePreview } from './components/TexturePreview';
import { UVViewer } from './components/UVViewer';
import { TextureTransform, Unit, TextureAdjustments, UVMeshData } from './types';
import { Loader2, Box as BoxIcon } from 'lucide-react';

// Default initial state
const INITIAL_TRANSFORM: TextureTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  textureWidth: 12, // Default width 12 inches
  textureHeight: 12, // Default height 12 inches
};

const INITIAL_ADJUSTMENTS: TextureAdjustments = {
  exposure: 0,
  red: 1,
  green: 1,
  blue: 1
};

// Fallback loader component
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center bg-white/90 p-4 rounded-xl shadow-xl backdrop-blur-md">
        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
        <span className="text-gray-700 font-semibold text-sm">{progress.toFixed(0)}% Loaded</span>
      </div>
    </Html>
  );
}

// Helper component to handle camera reset using Bounds
const CameraHandler = ({ resetTrigger }: { resetTrigger: number }) => {
  const api = useBounds();

  useEffect(() => {
    // Fit on manual trigger
    if (resetTrigger > 0) {
      api.refresh().fit();
    }
  }, [resetTrigger, api]);
  
  return null;
};

// Placeholder Mesh if no FBX is loaded
const PlaceholderMesh = ({ transform, textureUrl }: { transform: TextureTransform, textureUrl: string | null }) => {
  return (
     <group>
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color={textureUrl ? "white" : "#e0e0e0"} />
        </mesh>
          <Html position={[0, -1, 0]} center>
            <div className="text-gray-400 text-sm font-mono bg-white/50 px-2 py-1 rounded">
              No Model Loaded
            </div>
          </Html>
     </group>
  );
};

export default function App() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string>('');
  const [modelType, setModelType] = useState<'fbx' | 'obj' | null>(null);
  
  // originalTextureUrl holds the raw uploaded file
  const [originalTextureUrl, setOriginalTextureUrl] = useState<string | null>(null);
  // textureUrl holds the processed version (filters applied)
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  
  const [textureName, setTextureName] = useState<string>('');
  const [textureMeta, setTextureMeta] = useState<{width: number, height: number} | null>(null);
  
  // State for Selection and Transforms
  const [globalTransform, setGlobalTransform] = useState<TextureTransform>(INITIAL_TRANSFORM);
  const [submeshTransforms, setSubmeshTransforms] = useState<Record<string, TextureTransform>>({});
  const [selectedMeshId, setSelectedMeshId] = useState<string | null>(null);
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [selectedMeshHeight, setSelectedMeshHeight] = useState<number | null>(null);

  const [adjustments, setAdjustments] = useState<TextureAdjustments>(INITIAL_ADJUSTMENTS);
  
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showUVGrid, setShowUVGrid] = useState(false);
  const [unit, setUnit] = useState<Unit>('in');
  const [ambientIntensity, setAmbientIntensity] = useState(3.0);
  const [useTriplanar, setUseTriplanar] = useState(false);
  const [useSubmeshScale, setUseSubmeshScale] = useState(true);
  const [uvStandardSize, setUvStandardSize] = useState(24); // Default 24 inches
  
  // UV Viewer State
  const [showUVViewer, setShowUVViewer] = useState(false);
  const [uvData, setUvData] = useState<UVMeshData[]>([]);
  
  // State to manage OrbitControls availability
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  // Debounce ref for processing
  const processingTimeoutRef = useRef<number | null>(null);

  // Computed Active Transform based on selection
  const activeTransform = selectedMeshId 
    ? (submeshTransforms[selectedMeshId] || globalTransform) 
    : globalTransform;

  const handleTransformChange = (newTransform: TextureTransform) => {
    if (selectedMeshId) {
      setSubmeshTransforms(prev => ({
        ...prev,
        [selectedMeshId]: newTransform
      }));
    } else {
      setGlobalTransform(newTransform);
      // Optional: If we change global, do we wipe individual overrides? 
      // For now, let's say Global only affects meshes that don't have overrides, 
      // or we can implement a "Reset All to Global" button later.
    }
  };

  const handleMeshSelect = (id: string | null, name: string | null) => {
    setSelectedMeshId(id);
    setSelectedMeshName(name);
    
    if (!id) {
      setSelectedMeshHeight(null);
    }

    // If selecting a new mesh that doesn't have a transform yet, 
    // we could initialize it with the current global transform, or leave it undefined 
    // to fallback to global in the render logic. 
    // However, to make the UI sliders jump to the correct position, we need to ensure state exists.
    if (id && !submeshTransforms[id]) {
      setSubmeshTransforms(prev => ({
        ...prev,
        [id]: { ...globalTransform }
      }));
    }
  };

  const handleModelUpload = (file: File) => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    const url = URL.createObjectURL(file);
    setModelUrl(url);
    setModelName(file.name);
    
    // Determine type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'obj') {
      setModelType('obj');
    } else {
      setModelType('fbx');
    }

    // Reset Data
    setUvData([]);
    setSubmeshTransforms({});
    setSelectedMeshId(null);
    setSelectedMeshName(null);
  };

  const handleTextureUpload = (file: File) => {
    if (originalTextureUrl) URL.revokeObjectURL(originalTextureUrl);
    if (textureUrl) URL.revokeObjectURL(textureUrl);
    
    // Reset adjustments on new upload
    setAdjustments(INITIAL_ADJUSTMENTS);

    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const originalWidth = img.width;
      const originalHeight = img.height;
      setTextureMeta({ width: originalWidth, height: originalHeight });

      const aspect = originalHeight / originalWidth;
      
      const newTransform = {
        ...globalTransform,
        textureHeight: globalTransform.textureWidth * aspect
      };
      setGlobalTransform(newTransform);
      // We also reset individual transforms when a new texture loads to prevent skewed aspect ratios
      setSubmeshTransforms({});

      // Optimization: Resize strictly for storage if huge
      const MAX_SIZE = 2048; 
      let finalUrl = tempUrl;

      if (originalWidth > MAX_SIZE || originalHeight > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / originalWidth, MAX_SIZE / originalHeight);
        const newWidth = Math.round(originalWidth * scale);
        const newHeight = Math.round(originalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          canvas.toBlob((blob) => {
             if (blob) {
                const resizedUrl = URL.createObjectURL(blob);
                setOriginalTextureUrl(resizedUrl);
                URL.revokeObjectURL(tempUrl);
             } else {
                setOriginalTextureUrl(tempUrl);
             }
          }, file.type || 'image/jpeg', 0.95);
        } else {
           setOriginalTextureUrl(tempUrl);
        }
      } else {
        setOriginalTextureUrl(tempUrl);
      }
      
      setTextureName(file.name);
    };

    img.onerror = () => {
      setOriginalTextureUrl(tempUrl);
      setTextureName(file.name);
    };

    img.src = tempUrl;
  };

  // Process Texture Effect
  useEffect(() => {
    if (!originalTextureUrl) {
      setTextureUrl(null);
      return;
    }

    if (processingTimeoutRef.current) {
      window.clearTimeout(processingTimeoutRef.current);
    }

    processingTimeoutRef.current = window.setTimeout(() => {
      processTexture(originalTextureUrl, adjustments);
    }, 100);

    return () => {
      if (processingTimeoutRef.current) window.clearTimeout(processingTimeoutRef.current);
    };
  }, [originalTextureUrl, adjustments]);

  const processTexture = (src: string, adj: TextureAdjustments) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply RGB Levels & Exposure via Pixel Manipulation
      if (adj.exposure !== 0 || adj.red !== 1 || adj.green !== 1 || adj.blue !== 1) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const exposureMult = Math.pow(2, adj.exposure); // Logarithmic exposure
        
        for (let i = 0; i < data.length; i += 4) {
          data[i]     = Math.min(255, data[i]     * adj.red   * exposureMult); // R
          data[i + 1] = Math.min(255, data[i + 1] * adj.green * exposureMult); // G
          data[i + 2] = Math.min(255, data[i + 2] * adj.blue  * exposureMult); // B
        }
        ctx.putImageData(imgData, 0, 0);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          setTextureUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return newUrl;
          });
        }
      }, 'image/png');
    };
    img.src = src;
  };

  const handleClearScene = () => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    if (originalTextureUrl) URL.revokeObjectURL(originalTextureUrl);
    if (textureUrl) URL.revokeObjectURL(textureUrl);
    
    setModelUrl(null);
    setModelName('');
    setModelType(null);
    setOriginalTextureUrl(null);
    setTextureUrl(null);
    setTextureName('');
    setTextureMeta(null);
    setGlobalTransform(INITIAL_TRANSFORM);
    setSubmeshTransforms({});
    setSelectedMeshId(null);
    setSelectedMeshName(null);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setCameraResetTrigger(prev => prev + 1);
    setUvData([]);
  };

  const handleResetCamera = () => {
    setCameraResetTrigger(prev => prev + 1);
  };

  const handleUVsLoaded = useCallback((data: UVMeshData[]) => {
    setUvData(data);
  }, []);

  return (
    <div className="w-full h-screen bg-neutral-100 flex overflow-hidden font-sans text-gray-900">
      
      {/* 3D Canvas Area */}
      <div className="flex-1 relative h-full">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [4, 2, 4], fov: 50 }} flat>
          <AdaptiveDpr pixelated />
          <Suspense fallback={<Loader />}>
            <Bounds fit clip observe margin={1.2}>
              <ambientLight intensity={ambientIntensity} />
              <directionalLight position={[5, 10, 5]} intensity={0.4} castShadow />
              <directionalLight position={[-5, 5, -5]} intensity={0.2} />

              <Center>
                {modelUrl ? (
                  <SceneModel 
                    modelUrl={modelUrl} 
                    modelType={modelType}
                    textureUrl={textureUrl}
                    transform={globalTransform}
                    submeshTransforms={submeshTransforms}
                    selectedMeshId={selectedMeshId}
                    onMeshSelect={handleMeshSelect}
                    onAnchorCalculated={setSelectedMeshHeight}
                    showDimensions={showDimensions}
                    showWireframe={showWireframe}
                    showUVGrid={showUVGrid}
                    unit={unit}
                    onUVsLoaded={handleUVsLoaded}
                    useTriplanar={useTriplanar}
                    useSubmeshScale={useSubmeshScale}
                    uvStandardSize={uvStandardSize}
                  />
                ) : (
                  <PlaceholderMesh transform={globalTransform} textureUrl={textureUrl} />
                )}
              </Center>
              <CameraHandler resetTrigger={cameraResetTrigger} />
            </Bounds>
            
            <Grid 
              renderOrder={-1} 
              position={[0, -0.01, 0]} 
              infiniteGrid 
              cellSize={unit === 'in' ? 0.6 : 0.6 * 0.0254}
              sectionSize={3} 
              fadeDistance={25} 
              sectionColor={"#dedede"} 
              cellColor={"#ececec"} 
            />
          </Suspense>
          <OrbitControls 
            makeDefault 
            enabled={orbitEnabled && !showUVViewer}
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 2} 
            enableDamping={false}
          />
        </Canvas>

        {!modelUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white flex flex-col items-center text-center max-w-md mx-4">
              <div className="bg-indigo-100 p-4 rounded-full mb-4">
                <BoxIcon className="text-indigo-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Ready to Visualize</h2>
              <p className="text-gray-600 leading-relaxed">
                Upload your <strong>.FBX or .OBJ furniture model</strong> and a <strong>fabric texture</strong> using the panel on the left to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      <ControlPanel 
        transform={activeTransform}
        onTransformChange={handleTransformChange}
        onModelUpload={handleModelUpload}
        onTextureUpload={handleTextureUpload}
        onResetCamera={handleResetCamera}
        onClearScene={handleClearScene}
        showDimensions={showDimensions}
        onToggleDimensions={() => setShowDimensions(!showDimensions)}
        showWireframe={showWireframe}
        onToggleWireframe={() => setShowWireframe(!showWireframe)}
        showUVGrid={showUVGrid}
        onToggleUVGrid={() => setShowUVGrid(!showUVGrid)}
        showUVViewer={showUVViewer}
        onToggleUVViewer={() => setShowUVViewer(!showUVViewer)}
        modelName={modelName}
        textureName={textureName}
        unit={unit}
        setUnit={setUnit}
        textureMeta={textureMeta}
        onMouseEnter={() => setOrbitEnabled(false)}
        onMouseLeave={() => setOrbitEnabled(true)}
        ambientIntensity={ambientIntensity}
        onAmbientIntensityChange={setAmbientIntensity}
        selectedMeshName={selectedMeshName}
        onDeselectMesh={() => handleMeshSelect(null, null)}
        useTriplanar={useTriplanar}
        onToggleTriplanar={() => setUseTriplanar(!useTriplanar)}
        useSubmeshScale={useSubmeshScale}
        setUseSubmeshScale={setUseSubmeshScale}
        uvStandardSize={uvStandardSize}
        onUvStandardSizeChange={setUvStandardSize}
        selectedMeshHeight={selectedMeshHeight}
      />

      <TexturePreview 
        textureUrl={textureUrl}
        textureName={textureName}
        onMouseEnter={() => setOrbitEnabled(false)}
        onMouseLeave={() => setOrbitEnabled(true)}
        adjustments={adjustments}
        onAdjustmentsChange={setAdjustments}
      />
      
      <GeminiAdvisor 
        hasModel={!!modelUrl} 
        hasTexture={!!textureUrl}
        textureName={textureName}
        onMouseEnter={() => setOrbitEnabled(false)}
        onMouseLeave={() => setOrbitEnabled(true)}
      />

      <UVViewer 
        isOpen={showUVViewer} 
        onClose={() => setShowUVViewer(false)}
        textureUrl={textureUrl}
        uvData={uvData}
      />

    </div>
  );
}