import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.Agente_Gerador_de_Prompt': JSON.stringify(env.Agente_Gerador_de_Prompt || ''),
        'process.env.Agente_Gerador_Fotos_2k': JSON.stringify(env.Agente_Gerador_Fotos_2k || ''),
        'process.env.Agente_Gerador_Fotos_4k': JSON.stringify(env.Agente_Gerador_Fotos_4k || ''),
        'process.env.Agente_Gerador_Fotos_1k': JSON.stringify(env.Agente_Gerador_Fotos_1k || ''),
        'process.env.Agente_Classificador_de_Fotos': JSON.stringify(env.Agente_Classificador_de_Fotos || ''),
        'process.env.Agente_Corretor_de_Foto': JSON.stringify(env.Agente_Corretor_de_Foto || ''),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          // No external dependencies for client-side bundle
        },
      },
    };
});
