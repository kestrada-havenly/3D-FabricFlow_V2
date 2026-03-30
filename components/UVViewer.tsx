import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { UVMeshData } from '../types';

interface UVViewerProps {
  isOpen: boolean;
  onClose: () => void;
  textureUrl: string | null;
  uvData: UVMeshData[];
}

export const UVViewer: React.FC<UVViewerProps> = ({ isOpen, onClose, textureUrl, uvData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !textureUrl) return;

    const img = new Image();
    img.src = textureUrl;
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
  }, [isOpen, textureUrl]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !imageSize) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw UVs
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    uvData.forEach((meshData) => {
      const { uvs, index } = meshData;
      
      if (index) {
        // Indexed geometry
        for (let i = 0; i < index.length; i += 3) {
          const i1 = index[i];
          const i2 = index[i + 1];
          const i3 = index[i + 2];

          const u1 = uvs[i1 * 2] * canvas.width;
          const v1 = (1 - uvs[i1 * 2 + 1]) * canvas.height; // Flip V

          const u2 = uvs[i2 * 2] * canvas.width;
          const v2 = (1 - uvs[i2 * 2 + 1]) * canvas.height;

          const u3 = uvs[i3 * 2] * canvas.width;
          const v3 = (1 - uvs[i3 * 2 + 1]) * canvas.height;

          ctx.moveTo(u1, v1);
          ctx.lineTo(u2, v2);
          ctx.lineTo(u3, v3);
          ctx.lineTo(u1, v1);
        }
      } else {
        // Non-indexed geometry (triangle soup)
        for (let i = 0; i < uvs.length; i += 6) {
          const u1 = uvs[i] * canvas.width;
          const v1 = (1 - uvs[i + 1]) * canvas.height;

          const u2 = uvs[i + 2] * canvas.width;
          const v2 = (1 - uvs[i + 3]) * canvas.height;

          const u3 = uvs[i + 4] * canvas.width;
          const v3 = (1 - uvs[i + 5]) * canvas.height;

          ctx.moveTo(u1, v1);
          ctx.lineTo(u2, v2);
          ctx.lineTo(u3, v3);
          ctx.lineTo(u1, v1);
        }
      }
    });

    ctx.stroke();
  }, [isOpen, imageSize, uvData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">UV Map Inspector</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 bg-neutral-100 flex items-center justify-center">
          <div className="relative shadow-lg bg-white">
            {textureUrl && (
              <img 
                src={textureUrl} 
                alt="Texture Base" 
                className="max-w-full max-h-[70vh] block"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            {imageSize && (
              <canvas
                ref={canvasRef}
                width={imageSize.width}
                height={imageSize.height}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            )}
            {!textureUrl && (
               <div className="w-[512px] h-[512px] flex items-center justify-center text-gray-400">
                 No Texture Loaded
               </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-500 flex justify-between">
            <div>
                {uvData.length} Meshes Loaded
            </div>
            <div>
                Green lines indicate UV islands
            </div>
        </div>
      </div>
    </div>
  );
};
