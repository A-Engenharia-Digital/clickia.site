import React from 'react';
import { Download, Mail, X } from 'lucide-react';
import { Button } from './Button';

interface FloatingActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDownload: () => void;
  onEmail: () => void;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
  selectedCount,
  onClearSelection,
  onDownload,
  onEmail
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-zinc-900/95 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-zinc-700 ring-1 ring-black/50">
        <div className="flex items-center gap-3 pr-4 border-r border-zinc-700">
          <span className="font-semibold text-sm whitespace-nowrap text-zinc-200">
            {selectedCount} Selecionado{selectedCount > 1 ? 's' : ''}
          </span>
          <button 
            onClick={onClearSelection}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 px-3 text-sm font-normal"
            onClick={onDownload}
            icon={<Download size={14} />}
          >
            Baixar TXT
          </Button>
          <Button 
            variant="primary" 
            className="h-8 px-4 text-sm bg-primary hover:bg-primaryDark border-none shadow-lg shadow-primary/20"
            onClick={onEmail}
            icon={<Mail size={14} />}
          >
            Enviar E-mail
          </Button>
        </div>
      </div>
    </div>
  );
};