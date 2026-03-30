import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Loader2, X } from 'lucide-react';

interface GeminiAdvisorProps {
  hasModel: boolean;
  hasTexture: boolean;
  textureName?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ 
  hasModel, 
  hasTexture, 
  textureName,
  onMouseEnter,
  onMouseLeave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const generateSuggestion = async () => {
    if (!process.env.API_KEY) {
      setSuggestion("API Key not configured in environment.");
      return;
    }

    setLoading(true);
    setSuggestion(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        You are an expert furniture designer and interior styling assistant.
        The user is visualizing a furniture piece${hasModel ? '' : ' (placeholder model)'} with a fabric pattern named "${textureName || 'Unknown Pattern'}".
        
        Please provide:
        1. A sophisticated marketing name for this combination.
        2. A short, elegant paragraph describing the mood this fabric creates on the furniture.
        3. A "Designer's Tip" on where to place this piece in a room (e.g., sunlit corner, formal living room).

        Keep it brief (under 100 words total).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setSuggestion(response.text);
    } catch (error) {
      console.error(error);
      setSuggestion("Sorry, I couldn't generate a suggestion right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute bottom-6 right-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 z-20"
      >
        <Sparkles size={20} />
        <span className="font-semibold">AI Style Assistant</span>
      </button>
    );
  }

  return (
    <div 
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute bottom-6 right-6 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-violet-100 overflow-hidden z-20 flex flex-col"
    >
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h3 className="font-semibold">Gemini Style Assistant</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
          <X size={18} />
        </button>
      </div>
      
      <div className="p-6 bg-gray-50 min-h-[200px] max-h-[400px] overflow-y-auto">
        {!suggestion && !loading && (
          <div className="text-center text-gray-500 py-4">
            <p className="mb-4">Need inspiration? I can generate a professional marketing description for your current design.</p>
            <button
              onClick={generateSuggestion}
              className="bg-white border border-violet-200 text-violet-700 px-4 py-2 rounded-lg font-medium hover:bg-violet-50 transition-colors shadow-sm"
            >
              Generate Description
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 text-violet-600">
            <Loader2 className="animate-spin mb-2" size={32} />
            <span className="text-sm font-medium">Analyzing patterns...</span>
          </div>
        )}

        {suggestion && (
          <div className="prose prose-sm prose-violet">
             <div className="text-gray-800 whitespace-pre-wrap">{suggestion}</div>
             <button
              onClick={generateSuggestion}
              className="mt-4 text-xs text-violet-600 underline hover:text-violet-800"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};