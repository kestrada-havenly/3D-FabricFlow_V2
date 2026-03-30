import React, { useState, useEffect, useRef } from 'react';
import { Upload, Move, RotateCw, Maximize, FileBox, Image as ImageIcon, Trash2, Camera, Ruler, ScanLine, ChevronsLeftRight, ChevronsUpDown, Lock, Unlock, Sun, Minus, Plus, Grid3x3, BoxSelect, Map, MousePointer2 } from 'lucide-react';
import { TextureTransform, Unit } from '../types';

interface ControlPanelProps {
  transform: TextureTransform;
  onTransformChange: (newTransform: TextureTransform) => void;
  onModelUpload: (file: File) => void;
  onTextureUpload: (file: File) => void;
  onResetCamera: () => void;
  onClearScene: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  showWireframe?: boolean;
  onToggleWireframe?: () => void;
  showUVGrid: boolean;
  onToggleUVGrid: () => void;
  modelName?: string;
  textureName?: string;
  unit: Unit;
  setUnit: (unit: Unit) => void;
  textureMeta: { width: number; height: number } | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  ambientIntensity: number;
  onAmbientIntensityChange: (value: number) => void;
  selectedMeshName?: string | null;
  onDeselectMesh?: () => void;
  useTriplanar: boolean;
  onToggleTriplanar: () => void;
  useSubmeshScale: boolean;
  setUseSubmeshScale: (val: boolean) => void;
  uvStandardSize: number;
  onUvStandardSizeChange: (val: number) => void;
  selectedMeshHeight?: number | null;
}

// -- Sub-component for Enhanced Number Inputs --
interface SmartNumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unit: string;
  step?: number;
  min?: number;
  disabled?: boolean;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ 
  label, 
  value, 
  onChange, 
  unit, 
  step = 0.1, 
  min = 0.1, 
  disabled 
}) => {
  // Local string state to allow for smooth typing (e.g. typing "1." without auto-format kicking in)
  const [localStr, setLocalStr] = useState(value.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startValRef = useRef(value);
  const startXRef = useRef(0);

  // Sync with parent value when not being actively edited by keyboard
  useEffect(() => {
    if (!isFocused && !isDragging) {
      setLocalStr(value.toFixed(2));
    }
  }, [value, isFocused, isDragging]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setLocalStr(str);
    const num = parseFloat(str);
    if (!isNaN(num) && num >= min) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // On blur, force format to clean up (e.g. "12." becomes "12.00")
    setLocalStr(value.toFixed(2));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      onChange(value + (step * multiplier));
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      onChange(Math.max(min, value - (step * multiplier)));
    }
  };

  // Scrubbing (Drag) Logic for Label
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    startValRef.current = value;
    startXRef.current = e.clientX;
    document.body.style.cursor = 'ew-resize';
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - startXRef.current;
    // Sensitivity: 1 pixel = 1 step
    const change = deltaX * step; 
    const newVal = Math.max(min, startValRef.current + change);
    onChange(newVal);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex-1 min-w-[100px]">
      <div 
        className={`flex items-center justify-between mb-1 ${disabled ? 'opacity-50' : ''}`}
        title="Click and drag to adjust"
      >
        <label 
          onMouseDown={handleMouseDown}
          className={`text-[10px] uppercase font-bold tracking-wider block select-none transition-colors flex items-center gap-1 ${isDragging ? 'text-indigo-600 cursor-ew-resize' : 'text-gray-400 hover:text-indigo-500 cursor-ew-resize'}`}
        >
          {label} ({unit})
        </label>
      </div>
      
      <div className={`flex items-center bg-white border rounded-lg overflow-hidden transition-all ${isFocused ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}>
        <button 
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={disabled}
          className="px-2 py-2 hover:bg-gray-50 active:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors border-r border-gray-100"
        >
          <Minus size={12} />
        </button>
        
        <input
          type="text" // Using text to handle floating point typing better
          inputMode="decimal"
          value={localStr}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full py-1.5 text-center text-sm font-bold font-mono text-gray-900 bg-transparent focus:outline-none min-w-0 placeholder-gray-400"
        />

        <button 
          onClick={() => onChange(value + step)}
          disabled={disabled}
          className="px-2 py-2 hover:bg-gray-50 active:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors border-l border-gray-100"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  transform,
  onTransformChange,
  onModelUpload,
  onTextureUpload,
  onResetCamera,
  onClearScene,
  showDimensions,
  onToggleDimensions,
  showWireframe,
  onToggleWireframe,
  showUVGrid,
  onToggleUVGrid,
  modelName,
  textureName,
  unit,
  setUnit,
  textureMeta,
  onMouseEnter,
  onMouseLeave,
  ambientIntensity,
  onAmbientIntensityChange,
  selectedMeshName,
  onDeselectMesh,
  useTriplanar,
  onToggleTriplanar,
  useSubmeshScale,
  setUseSubmeshScale,
  uvStandardSize,
  onUvStandardSizeChange,
  selectedMeshHeight
}) => {
  const [lockRatio, setLockRatio] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'texture') => {
    if (e.target.files && e.target.files[0]) {
      if (type === 'model') onModelUpload(e.target.files[0]);
      else onTextureUpload(e.target.files[0]);
    }
  };

  const update = (key: keyof TextureTransform, value: number) => {
    onTransformChange({ ...transform, [key]: value });
  };

  // Convert internal inches to display unit
  const toDisplay = (val: number) => unit === 'mm' ? val * 25.4 : val;
  const toInternal = (val: number) => unit === 'mm' ? val / 25.4 : val;

  // New handler for SmartNumberInputs
  const updateDimension = (dimension: 'width' | 'height', newValDisplay: number) => {
    const newInches = toInternal(newValDisplay);
    const newTransform = { ...transform };

    if (dimension === 'width') {
      newTransform.textureWidth = Math.max(0.1, newInches);
      if (lockRatio && textureMeta) {
         const ratio = textureMeta.height / textureMeta.width;
         newTransform.textureHeight = newTransform.textureWidth * ratio;
      }
    } else {
      newTransform.textureHeight = Math.max(0.1, newInches);
      if (lockRatio && textureMeta) {
         const ratio = textureMeta.width / textureMeta.height;
         newTransform.textureWidth = newTransform.textureHeight * ratio;
      }
    }
    onTransformChange(newTransform);
  };

  // Helpers for Rotation (Radians <-> Degrees)
  const currentDegrees = Math.round((transform.rotation * 180) / Math.PI);
  
  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const deg = parseFloat(e.target.value);
    if (!isNaN(deg)) {
      update('rotation', (deg * Math.PI) / 180);
    }
  };

  return (
    <div 
      onMouseEnter={onMouseEnter} 
      onMouseLeave={onMouseLeave}
      className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm p-6 rounded-xl shadow-2xl w-80 max-h-[90vh] overflow-y-auto z-10 border border-gray-200 flex flex-col gap-6"
    >
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">FabricFlow 3D</h1>
          <p className="text-sm text-gray-500">Visualizer & Pattern Tool</p>
        </div>
      </div>

      {selectedMeshName && (
        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <BoxSelect size={14} className="text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-bold text-indigo-800 truncate" title={selectedMeshName}>
                {selectedMeshName}
              </span>
            </div>
            <button 
              onClick={onDeselectMesh}
              className="text-indigo-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-100 transition-colors flex-shrink-0"
              title="Deselect Mesh"
            >
              <Trash2 size={12} />
            </button>
          </div>
          
          <div className="text-[10px] text-indigo-600/70 mb-2 leading-tight">
            Adjusting texture for this part only.
          </div>
        </div>
      )}

      {/* Global Settings */}
      <div className="flex flex-col gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Units</span>
            <div className="flex bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setUnit('in')}
                className={`px-3 py-1 text-xs font-bold transition-colors ${unit === 'in' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                IN
              </button>
              <button
                onClick={() => setUnit('mm')}
                className={`px-3 py-1 text-xs font-bold transition-colors ${unit === 'mm' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                MM
              </button>
            </div>
        </div>
        
        {/* Ambient Light Control */}
        <div className="space-y-1">
             <div className="flex items-center justify-between text-xs text-gray-500 uppercase font-semibold">
                <div className="flex items-center gap-1"><Sun size={12}/> Light Intensity</div>
                <span className="font-mono">{ambientIntensity.toFixed(2)}</span>
             </div>
             <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={ambientIntensity}
                onChange={(e) => onAmbientIntensityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
        </div>
      </div>

      {/* File Uploads */}
      <div className="space-y-3">
        <div className="group relative">
          <label className="flex items-center justify-between w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer transition-colors border border-indigo-100">
            <div className="flex items-center gap-3">
              <FileBox size={20} />
              <span className="font-medium text-sm truncate max-w-[140px]">
                {modelName || 'Upload Model (FBX/OBJ)'}
              </span>
            </div>
            <Upload size={16} />
            <input
              type="file"
              accept=".fbx,.obj"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'model')}
            />
          </label>
        </div>

        <div className="group relative">
          <label className="flex items-center justify-between w-full px-4 py-3 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg cursor-pointer transition-colors border border-pink-100">
            <div className="flex items-center gap-3">
              <ImageIcon size={20} />
              <span className="font-medium text-sm truncate max-w-[140px]">
                {textureName || 'Upload Fabric (Img)'}
              </span>
            </div>
            <Upload size={16} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'texture')}
            />
          </label>
        </div>

        {/* Physical Size Input */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
           <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Physical Size</span>
              <span className="text-[10px] text-gray-400">Scale Reference</span>
           </div>
           <SmartNumberInput
              label="Size"
              value={toDisplay(uvStandardSize)}
              onChange={(val) => onUvStandardSizeChange(toInternal(val))}
              unit={unit}
              step={1}
           />
        </div>

        {/* Texture Size */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
           <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase">Texture Size</span>
              <button 
                onClick={() => setLockRatio(!lockRatio)}
                className={`p-1 rounded hover:bg-gray-200 ${lockRatio ? 'text-indigo-600' : 'text-gray-400'}`}
                title={lockRatio ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
              >
                {lockRatio ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
           </div>
           
           <div className="flex gap-2">
             <SmartNumberInput
                label="Width"
                value={toDisplay(transform.textureWidth)}
                onChange={(val) => updateDimension('width', val)}
                unit={unit}
                step={0.5}
             />
             <SmartNumberInput
                label="Height"
                value={toDisplay(transform.textureHeight)}
                onChange={(val) => updateDimension('height', val)}
                unit={unit}
                step={0.5}
             />
           </div>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <RotateCw size={16} />
              <span>Rotation (deg)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={currentDegrees}
              onChange={handleRotationChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <input
              type="number"
              min="0"
              max="360"
              value={currentDegrees}
              onChange={handleRotationChange}
              className="w-16 px-2 py-1 bg-white border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
            />
          </div>
        </div>

        {/* Position X */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Move size={16} className="rotate-90" />
              <span>Horizontal Shift</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={transform.offsetX}
            onChange={(e) => update('offsetX', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Position Y */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Move size={16} />
              <span>Vertical Shift</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={transform.offsetY}
            onChange={(e) => update('offsetY', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
        {/* View Options */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onToggleDimensions}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-colors border ${showDimensions ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            title="Toggle Dimensions"
          >
            <Ruler size={16} />
            Dims
          </button>
          <button
            onClick={onToggleWireframe}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-colors border ${showWireframe ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            title="Toggle Wireframe"
          >
            <ScanLine size={16} />
            Wire
          </button>
           <button
            onClick={onToggleUVGrid}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-colors border ${showUVGrid ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            title="Toggle UV Grid"
          >
            <Grid3x3 size={16} />
            UV Grid
          </button>
        </div>
      </div>
      
      {/* Scene Actions */}
      <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-3">
        <button 
          onClick={onResetCamera}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          title="Center Model"
        >
          <Camera size={16} />
          Reset View
        </button>
        <button 
          onClick={onClearScene}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
          title="Remove Model & Texture"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>

      <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-md">
        <strong>Tip:</strong> Drag inside the viewer background to rotate the model like a pottery wheel.
      </div>
    </div>
  );
}