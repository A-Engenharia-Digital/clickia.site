import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, value = [], options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    const newValue = value.includes(option)
      ? value.filter(v => v !== option)
      : [...value, option];
    onChange(newValue);
  };

  const removeValue = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== option));
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="block text-sm font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div
          className={`w-full min-h-[48px] bg-zinc-950 border border-zinc-700 rounded-xl py-2 px-3 flex flex-wrap gap-2 items-center cursor-pointer hover:border-zinc-600 transition-all ${isOpen ? 'ring-2 ring-primary/50 border-primary' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {value.length === 0 && (
            <span className="text-zinc-500">Selecione...</span>
          )}
          
          {value.map(v => (
            <span key={v} className="bg-zinc-800 text-zinc-200 text-sm px-2 py-1 rounded-md flex items-center gap-1 border border-zinc-700">
              {v}
              <button onClick={(e) => removeValue(e, v)} className="hover:text-white">
                <X size={14} />
              </button>
            </span>
          ))}

          <div className="ml-auto text-zinc-500">
            <ChevronDown size={16} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-[100] w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-h-60 overflow-y-auto custom-scrollbar">
            {options.map(option => {
              const isSelected = value.includes(option);
              return (
                <div
                  key={option}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-zinc-800 transition-colors ${isSelected ? 'text-primary bg-zinc-900' : 'text-zinc-300'}`}
                  onClick={() => toggleOption(option)}
                >
                  <span>{option}</span>
                  {isSelected && <Check size={16} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
