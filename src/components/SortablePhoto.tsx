import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PhotoData } from '../../types';
import { Copy, Edit2, Heart, Eye, MoreHorizontal, Download, Zap } from 'lucide-react';

interface SortablePhotoProps {
  photo: PhotoData;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (photo: PhotoData) => void;
  onDuplicate: (photo: PhotoData) => void;
  onGenerate: (photo: PhotoData, mode: 'high2k' | 'ultra4k') => void;
}

export const SortablePhoto: React.FC<SortablePhotoProps> = ({
  photo,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onGenerate
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <div className="group flex flex-col gap-3 h-full">
        {/* Image Container */}
        <div 
          className={`relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-900 cursor-pointer transition-all duration-300 ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}`}
          onClick={(e) => {
            // Prevent drag from triggering selection if it was a click
            if (!isDragging) onToggleSelect(photo.id);
          }}
        >
          <img 
            src={photo.imageUrl} 
            alt={photo.prompt?.slice(0, 50) || 'Photo'} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4">
            <div className="flex justify-between items-start">
               <div 
                 className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-white/50 hover:border-white'}`}
                 onClick={(e) => { e.stopPropagation(); onToggleSelect(photo.id); }}
               >
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
               </div>
               
               <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(photo); }}
                    className="p-2 bg-black/50 hover:bg-white hover:text-black text-white rounded-full backdrop-blur-sm transition-all"
                    title="Editar"
                    onPointerDown={(e) => e.stopPropagation()} 
                  >
                    <Edit2 size={16} />
                  </button>
               </div>
            </div>

            {/* Generation Buttons */}
            <div className="flex flex-col gap-2 items-center justify-center">
              <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(photo, 'high2k'); }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-primary hover:text-black text-white text-xs font-bold uppercase tracking-wider rounded-md backdrop-blur-sm transition-all border border-white/20 w-full flex items-center justify-center gap-2"
                  onPointerDown={(e) => e.stopPropagation()}
              >
                  <Zap size={12} />
                  Gerar 2K
              </button>
              <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(photo, 'ultra4k'); }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-primary hover:text-black text-white text-xs font-bold uppercase tracking-wider rounded-md backdrop-blur-sm transition-all border border-white/20 w-full flex items-center justify-center gap-2"
                  onPointerDown={(e) => e.stopPropagation()}
              >
                  <Zap size={12} />
                  Gerar 4K
              </button>
            </div>

            <div className="flex justify-end">
               <button 
                  onClick={(e) => { e.stopPropagation(); onDuplicate(photo); }}
                  className="p-2 bg-black/50 hover:bg-white hover:text-black text-white rounded-full backdrop-blur-sm transition-all"
                  title="Duplicar"
                  onPointerDown={(e) => e.stopPropagation()}
               >
                  <Copy size={16} />
               </button>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex justify-between items-start px-1 mt-auto">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-sm font-bold text-zinc-100 truncate" title={photo.title}>
              {photo.title || 'Sem título'}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
               <span className="text-xs text-zinc-400 truncate block">
                 {photo.personType} • {photo.environment}
               </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-zinc-500 text-xs font-medium shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(photo.prompt);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Copiar Prompt"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
