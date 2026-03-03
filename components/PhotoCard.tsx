import React from 'react';
import { PhotoData } from '../types';
import { Copy, Edit2, Heart, Eye, MoreHorizontal } from 'lucide-react';

interface PhotoCardProps {
  photo: PhotoData;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (photo: PhotoData) => void;
  onDuplicate: (photo: PhotoData) => void;
  onGenerate: (photo: PhotoData, mode: 'high2k' | 'ultra4k') => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onGenerate
}) => {
  // Mock stats for visual flair
  const likes = React.useMemo(() => Math.floor(Math.random() * 500) + 12, []);
  const views = React.useMemo(() => (likes * (Math.floor(Math.random() * 5) + 2)).toLocaleString(), [likes]);

  return (
    <div className="group flex flex-col gap-3">
      {/* Image Container */}
      <div 
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-900 cursor-pointer transition-all duration-300 ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}`}
        onClick={() => onToggleSelect(photo.id)}
      >
        <img 
          src={photo.imageUrl} 
          alt={photo.prompt.slice(0, 50)} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Overlay Actions (Behance style: appear on hover) */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-white/50 hover:border-white'}`}>
                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(photo); }}
                  className="p-2 bg-black/50 hover:bg-white hover:text-black text-white rounded-full backdrop-blur-sm transition-all"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
             </div>
          </div>

          {/* Generation Buttons */}
          <div className="flex flex-col gap-2 items-center justify-center">
            <button
                onClick={(e) => { e.stopPropagation(); onGenerate(photo, 'high2k'); }}
                className="px-3 py-1.5 bg-white/10 hover:bg-primary hover:text-black text-white text-xs font-bold uppercase tracking-wider rounded-md backdrop-blur-sm transition-all border border-white/20 w-full"
            >
                Gerar 2K
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onGenerate(photo, 'ultra4k'); }}
                className="px-3 py-1.5 bg-white/10 hover:bg-primary hover:text-black text-white text-xs font-bold uppercase tracking-wider rounded-md backdrop-blur-sm transition-all border border-white/20 w-full"
            >
                Gerar 4K
            </button>
          </div>

          <div className="flex justify-end">
             <button 
                onClick={(e) => { e.stopPropagation(); onDuplicate(photo); }}
                className="p-2 bg-black/50 hover:bg-white hover:text-black text-white rounded-full backdrop-blur-sm transition-all"
                title="Duplicar"
             >
                <Copy size={16} />
             </button>
          </div>
        </div>
      </div>

      {/* Meta Info (Behance style: Title left, Copy Button right) */}
      <div className="flex justify-between items-start px-1">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-sm font-bold text-zinc-100 truncate hover:underline cursor-pointer" title={photo.title}>
            {photo.title || 'Sem título'}
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
             <span className="text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer truncate">
               {photo.personType} • {photo.environment} • {Array.isArray(photo.style) ? photo.style.join(', ') : photo.style}
             </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-zinc-500 text-xs font-medium shrink-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(photo.prompt);
              // Ideally show a toast here, but for now just a console log or simple alert if needed, 
              // but the button visual feedback is usually enough if we add one.
              // Let's just make it a nice button.
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Copiar Prompt"
          >
            <Copy size={12} />
            <span>Prompt</span>
          </button>
        </div>
      </div>
    </div>
  );
};