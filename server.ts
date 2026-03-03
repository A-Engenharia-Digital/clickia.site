import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Configuration (Moved to backend for CORS bypass and security)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wdmixpockvsrvkfuxjls.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbWl4cG9ja3ZzcnZrZnV4amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODkzNjcsImV4cCI6MjA4ODA2NTM2N30.ymsRiY3T-JxQwCNs9N7JiekbO0AQ27MtQMIbWe14kCI';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to parse JSON request bodies
app.use(express.json({ limit: '50mb' })); // Increase limit for image base64

// Helper to handle Supabase errors gracefully in offline mode
function logSupabaseError(context: string, error: any) {
  let message = '';
  
  if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    message = error.message || error.details || error.hint || JSON.stringify(error);
  } else {
    message = String(error);
  }

  const isHtml = message.includes('<!DOCTYPE html>') || message.includes('<html');
  const isCloudflare = message.includes('cloudflare') || message.includes('522');
  const isTimeout = message.includes('timed out') || message.includes('timeout');

  if (isHtml || isCloudflare || isTimeout) {
    console.warn(`${context}: Supabase unreachable (Offline Mode active).`);
  } else {
    console.warn(`${context}:`, message);
  }
}

// --- Database Endpoints (Proxy to Supabase) ---

async function checkDatabaseConnection() {
  try {
    const { count, error } = await supabase.from('photos').select('*', { count: 'exact', head: true });
    if (error) {
      logSupabaseError('Supabase Connection Check Failed', error);
    } else {
      console.log(`Supabase Connection Successful. Photo count: ${count}`);
    }
  } catch (err: any) {
    logSupabaseError('Supabase Connection Check Exception', err);
  }
}

checkDatabaseConnection();

app.get('/api/health/supabase', async (req, res) => {
  try {
    const { count, error } = await supabase.from('photos').select('*', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ status: 'ok', count: count });
  } catch (error: any) {
    logSupabaseError('Supabase Health Check Failed', error);
    res.status(500).json({ error: 'Supabase unreachable', details: error.message || String(error) });
  }
});

app.get('/api/photos', async (req, res) => {
  try {
    const { page = '0', pageSize = '30' } = req.query;
    console.log(`API: Fetching photos page=${page}, pageSize=${pageSize}`);
    const from = parseInt(page as string) * parseInt(pageSize as string);
    const to = from + parseInt(pageSize as string) - 1;

    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    logSupabaseError('DB Fetch Error', error);
    res.status(500).json({ error: 'Supabase unreachable', details: error.message || String(error) });
  }
});

app.get('/api/photos/count', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('photos')
      .select('id', { count: 'exact', head: true });
    
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error: any) {
    logSupabaseError('DB Count Error', error);
    res.status(500).json({ error: 'Supabase unreachable', details: error.message || String(error) });
  }
});

app.get('/api/photos/max-order', async (req, res) => {
  try {
    // Return the global maximum display_order regardless of filters
    // This ensures new items are always added to the end of any list
    const { data, error } = await supabase
      .from('photos')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    
    res.json({ maxOrder: data?.display_order ?? -1 });
  } catch (error: any) {
    logSupabaseError('Max Order Fetch Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.post('/api/photos/upsert', async (req, res) => {
  try {
    const payload = req.body;
    const { data, error } = await supabase
      .from('photos')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    logSupabaseError('DB Upsert Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.post('/api/photos/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    const { error } = await supabase
      .from('photos')
      .delete()
      .in('id', ids);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    logSupabaseError('DB Delete Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.post('/api/photos/update-batch', async (req, res) => {
  try {
    const { updates } = req.body;
    const promises = updates.map((u: any) => {
      const { id, ...payload } = u;
      return supabase.from('photos').update(payload).eq('id', id);
    });
    await Promise.all(promises);
    res.json({ success: true });
  } catch (error: any) {
    logSupabaseError('DB Batch Update Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.get('/api/photos/ids', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id');
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    logSupabaseError('DB Fetch IDs Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.get('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    logSupabaseError('DB Fetch Single Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

app.post('/api/photos/update', async (req, res) => {
  try {
    const { id, ...payload } = req.body;
    const { data, error } = await supabase
      .from('photos')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    logSupabaseError('DB Update Error', error);
    res.status(500).json({ error: 'Supabase unreachable' });
  }
});

// Storage Proxy (to avoid CORS on upload)
app.post('/api/storage/upload', async (req, res) => {
  try {
    const { fileName, base64Data, contentType } = req.body;
    console.log(`Upload request received: ${fileName}, size: ${base64Data.length} chars`);
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      logSupabaseError('Supabase Storage Upload Failed', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    res.json({ publicUrl: publicUrlData.publicUrl });
  } catch (error: any) {
    logSupabaseError('Storage Upload Exception', error);
    res.status(500).json({ error: error.message || 'Unknown upload error' });
  }
});

// --- Gemini API Endpoints ---

const getApiKey = (keyName: string) => {
  return process.env.API_KEY || process.env[keyName] || '';
};

// 1. Classifier Endpoint
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { base64Data, systemPrompt } = req.body;
    const apiKey = getApiKey('Agente_Classificador_de_Fotos') || 'AIzaSyDXzg1h-GQlLhy16o8wbmdxSRNl9bXOvsk';
    
    if (!apiKey) return res.status(500).json({ error: 'Agente_Classificador_de_Fotos not configured' });

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Classifique esta imagem seguindo estritamente o esquema JSON fornecido." },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } }
          ]
        }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        imageConfig: { imageSize: "512px" },
        responseModalities: [Modality.TEXT]
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini Analyze Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Master Prompt Endpoint
app.post('/api/gemini/master-prompt', async (req, res) => {
  try {
    const { base64Data, mimeType, userRequest, systemInstruction } = req.body;
    const apiKey = getApiKey('Agente_Gerador_de_Prompt') || 'AIzaSyA8kktcxyAutXYcgQqRpJx3dpXenZGqEvc';

    if (!apiKey) return res.status(500).json({ error: 'Agente_Gerador_de_Prompt not configured' });

    const client = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [];
    if (base64Data) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    }
    parts.push({ text: userRequest || "Analyze this image and generate a technical master prompt." });

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: {
        temperature: 0.35,
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingLevel: "MINIMAL" as any },
        imageConfig: { imageSize: "512px" as any },
        responseModalities: [Modality.IMAGE, Modality.TEXT]
      }
    });

    // Extract text output and image output
    let textOutput = "";
    let imageOutput = "";
    
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) textOutput += part.text;
        if (part.inlineData) {
          imageOutput = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
        }
      }
    }

    res.json({ 
      text: textOutput || response.text,
      image: imageOutput 
    });
  } catch (error: any) {
    console.error('Gemini Master Prompt Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Image Generation Endpoint
app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const { prompt, referenceImages, aspectRatio, mode } = req.body;
    
    let apiKeyName = 'Agente_Gerador_Fotos_1k';
    let defaultKey = 'AIzaSyDVJGKqgPk_LHZi-5o1iNLTjHcWyoGUJ7g';
    if (mode === 'high2k') {
      apiKeyName = 'Agente_Gerador_Fotos_2k';
      defaultKey = 'AIzaSyCBJ6DZzOKMVUZZu6s5NpFtg1tN-1Ed7tM';
    }
    if (mode === 'ultra4k') {
      apiKeyName = 'Agente_Gerador_Fotos_4k';
      defaultKey = 'AIzaSyDPmRhTq22JwnYd5R84BZX2Y-q4VQx-8RU';
    }
    
    const apiKey = getApiKey(apiKeyName) || defaultKey;
    if (!apiKey) return res.status(500).json({ error: `${apiKeyName} not configured` });

    const client = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [{ text: prompt }];
    
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((base64: string) => {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = base64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
        parts.push({ inlineData: { data: cleanBase64, mimeType } });
      });
    }

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: mode === 'ultra4k' ? "4K" : mode === 'high2k' ? "2K" : "1K"
        }
      }
    });

    let imageUrl = '';
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Gemini Generate Image Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Enhance Image Endpoint
app.post('/api/gemini/enhance-image', async (req, res) => {
  try {
    const { base64Image, userRequest, systemInstruction, size } = req.body;
    const apiKey = getApiKey('Agente_Corretor_de_Foto') || 'AIzaSyD4IkCGTS3Pq6s9ive0katKJG_N4JO80lk';

    if (!apiKey) return res.status(500).json({ error: 'Agente_Corretor_de_Foto not configured' });

    const client = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType } },
          { text: userRequest || "Enhance this image with maximum fidelity." }
        ]
      },
      config: {
        systemInstruction,
        imageConfig: { imageSize: size as any }
      }
    });

    let imageUrl = '';
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    res.json({ imageUrl });
  } catch (error: any) {
    console.error('Gemini Enhance Image Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

async function startServer() {
  console.log(`Starting server in ${process.env.NODE_ENV} mode`);
  const distPath = path.resolve(__dirname, 'dist');
  console.log(`Serving static files from: ${distPath}`);

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        console.log(`Serving index.html for request: ${req.url}`);
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.error('Production build not found! Please run npm run build.');
      // Fallback to prevent crash, but this will likely fail to serve the app correctly
      app.get('/', (req, res) => res.send('Production build not found. Check server logs.'));
    }
  } else {
    // Vite middleware for development
    console.log('Initializing Vite middleware...');
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (error) {
      console.error('Failed to load Vite:', error);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
