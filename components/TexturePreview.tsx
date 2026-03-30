import React, { useState } from 'react';
import { Eye, SlidersHorizontal, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { TextureAdjustments } from '../types';

interface TexturePreviewProps {
  textureUrl: string | null;
  textureName?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  adjustments?: TextureAdjustments;
  onAdjustmentsChange?: (adj: TextureAdjustments) => void;
}

export const TexturePreview: React.FC<TexturePreviewProps> = ({ 
  textureUrl, 
  textureName, 
  onMouseEnter, 
  onMouseLeave,
  adjustments,
  onAdjustmentsChange
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!textureUrl) return null;

  const update = (key: keyof TextureAdjustments, value: number) => {
    if (onAdjustmentsChange && adjustments) {
      onAdjustmentsChange({ ...adjustments, [key]: value });
    }
  };

  const handleReset = () => {
    if (onAdjustmentsChange) {
      onAdjustmentsChange({
        exposure: 0,
        red: 1,
        green: 1,
        blue: 1
      });
    }
  };

  const Slider = ({ label, value, min, max, step, param }: { label: string, value: number, min: number, max: number, step: number, param: keyof TextureAdjustments }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => update(param, parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
    </div>
  );

  return (
    <div 
      className={`absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 z-10 w-64 flex flex-col transition-all duration-300 ${expanded ? 'max-h-[85vh]' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-gray-500">
          <div className="flex items-center gap-2">
            <Eye size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">Pattern Preview</span>
          </div>
          <button 
             onClick={() => setExpanded(!expanded)}
             className="text-gray-400 hover:text-indigo-600 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        
        <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-gray-100 shadow-inner bg-gray-50">
          <img 
            src={textureUrl} 
            alt={textureName} 
            className="w-full h-full object-cover" 
          />
        </div>
        
        <div className="text-[10px] text-gray-400 font-mono truncate text-center">
          {textureName}
        </div>
      </div>

      {/* Adjustments Section */}
      {expanded && adjustments && (
        <div className="px-4 pb-4 overflow-y-auto border-t border-gray-100 custom-scrollbar">
          <div className="pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700">
              <SlidersHorizontal size={14} />
              <span className="text-xs font-bold">Adjust Texture</span>
            </div>
            <button 
              onClick={handleReset}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Reset Adjustments"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="space-y-4">
            <Slider label="Exposure" param="exposure" value={adjustments.exposure} min={-1} max={1} step={0.05} />
            
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase">RGB Levels</span>
              <Slider label="Red" param="red" value={adjustments.red} min={0} max={2} step={0.05} />
              <Slider label="Green" param="green" value={adjustments.green} min={0} max={2} step={0.05} />
              <Slider label="Blue" param="blue" value={adjustments.blue} min={0} max={2} step={0.05} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};