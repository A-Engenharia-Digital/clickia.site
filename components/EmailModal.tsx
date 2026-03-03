import React, { useState } from 'react';
import { X, Mail, Check } from 'lucide-react';
import { Button } from './Button';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: string) => Promise<void>;
  count: number;
}

export const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, onSend, count }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Por favor, insira um e-mail válido');
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      await onSend(email);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setEmail('');
        onClose();
      }, 2000);
    } catch (err) {
      setError('Falha ao enviar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={20} />
        </button>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Enviado com Sucesso!</h3>
            <p className="text-zinc-400 mt-2">O arquivo TXT foi enviado para {email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Enviar Prompts</h3>
                <p className="text-zinc-400 text-sm">Enviando {count} item{count > 1 ? 's' : ''} selecionado{count > 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                E-mail do destinatário
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colega@empresa.com"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={loading}>
                Enviar Arquivo
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};