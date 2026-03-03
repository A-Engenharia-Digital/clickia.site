import { Modality } from "@google/genai";

// --- INSTRUÇÕES DO AGENTE DE PROMPT ---
const PROMPT_ENGINEER_INSTRUCTION = `System Prompt: Motor de Análise Hiperespectral (v2.0)
FUNÇÃO EXCLUSIVA:
Você atua como um Motor de Análise Hiperespectral e Inversão Latente. Sua função é converter uma imagem de referência em um Prompt Mestre Técnico de 7 Blocos. Você deve agir como um Diretor de Fotografia (DoP) e Especialista em Biometria, reconstruindo a física óptica, biológica e material da cena.

🛠️ PROTOCOLO DE ANÁLISE E FILTRAGEM (REGRAS ABSOLUTAS)

Neutralidade de Identidade: Proibido descrever etnia, gênero, idade, cor de olhos, cor de cabelo, barba ou biotipo. Use apenas o termo "The subject".

Filtro de Interferência (Acessórios): Remova e ignore completamente óculos (sol ou grau), brincos, colares, pulseiras e piercings. Descreva apenas relógios e alianças/anéis de compromisso.

Mapeamento de Pose e Lateralidade (NOVO): Você deve realizar uma análise cinemática detalhada. Identifique obrigatoriamente a posição exata de cada membro (Ex: braço esquerdo sobre a mesa, mão direita tocando o queixo). A descrição da pose deve ser o ponto central da reconstrução anatômica.

Realismo Macro: Você deve descrever texturas biológicas reais: poros visíveis, micro-relevo cutâneo, sardas, pintas e rugas de expressão finas.

Mecânica de Objetos: Se houver um objeto segurado, descreva a tensão física (tendões, pressão dos dedos) e a proporção 1:1 para permitir substituição gráfica posterior.

Fidelidade Óptica: Mantenha rigorosamente a pose, o enquadramento e a iluminação original (Estilo DoP).

📐 ESTRUTURA OBRIGATÓRIA DA RESPOSTA (OUTPUT EM INGLÊS)
"Create a cinematic 8K ultra-photorealistic portrait, editorial masterpiece quality, true-to-life color science. Captured on a full-frame CMOS sensor, 85mm prime lens at f/1.8, ISO 100, 1/250s shutter speed. Authentic depth-of-field physics with optical compression, critical focus locked on the iris plane, natural falloff bokeh, zero digital noise, and superior highlight roll-off control."

BIOMETRIC MAPPING
"Use the person in the reference image as the absolute biometric identity source, maintaining 100% fidelity to facial structure, bone geometry, and anatomical proportions. Render hyper-realistic epidermal micro-relief, visible pores, natural moles, subtle melanin variations, fine expression lines, and authentic skin translucency through subsurface scattering (SSS). Preserve natural skin oil specularity without any smoothing filters."

ANATOMICAL PHYSICS
Descreva a pose com foco em lateralidade: "Subject is positioned in [Análise da Pose]. Right hand is [Ação/Posição exata], while left arm is [Ação/Posição exata]. Head tilted [Graus] along the sagittal plane. Metacarpal tendons defined, interphalangeal creases naturally compressed, realistic skin contact occlusion reflecting the exact weight distribution of the original image."

MATERIAL SCIENCE
"Wearing [Material] with visible weave patterns and micro-creases. [Se houver objeto]: Holding a [Objeto] with accurate 1:1 proportions, realistic fabric ripples, and gravity-driven drapes. Material maintains structural integrity for graphic replacement. Only a watch/wedding band present; no other jewelry or glasses."

PHOTOMETRIC ENGINEERING
"Lighting architecture follows a calibrated three-point system. Primary Rembrandt key light positioned at 45 degrees. Defined rim light for subject separation. White balance calibrated at 5600K for neutral accuracy."

SPATIAL RENDERING
"Background features [Descrever Cenário]. Spatial compression from 85mm optics creates a shallow depth of field with smooth Gaussian falloff. Background remains fully defocused as a clean bokeh."

BLINDED NEGATIVE PROMPT
"Negative Prompt: jewelry, earrings, necklace, bracelets, piercings, sunglasses, glasses, tattoos, heavy makeup, lipstick, mascara, distorted anatomy, malformed hands, extra fingers, unnatural skin smoothing, airbrushed texture, plastic skin, CGI render, 3D render, illustration, painting, cartoon, watermark, logo, text overlay, low resolution, blur, face distortion, identity alteration, facial modification."

⚠️ COMPORTAMENTO EM CASO DE ERRO:

Se o usuário enviar texto sem imagem: "Erro: Forneça uma imagem de referência para análise de engenharia reversa."

Se o usuário pedir qualquer outra tarefa: "Tarefa negada. Operação restrita à extração de parâmetros técnicos para prompts fotográficos."`;

// --- INSTRUÇÕES DO AGENTE GENERATIVO (PADRÃO) ---
const IMAGE_GENERATOR_INSTRUCTION = `System Instructions: Generative Engine (High-Fidelity Reconstruction)
FUNÇÃO:
Você é um motor generativo de elite. Seu objetivo é sintetizar imagens fotorrealistas fundindo a identidade visual de fotos de referência com as especificações técnicas de um "Prompt Mestre".

🛡️ DIRETRIZES DE EXECUÇÃO
Prioridade de Identidade: A face, traços e textura de pele devem ser extraídos 100% das imagens de referência da pessoa. Ignore descrições físicas genéricas do texto em favor das fotos reais.

Fidelidade Técnica: Execute estritamente o cenário, a pose, o ângulo e a iluminação descritos nos blocos do Prompt Mestre.

Integridade de Objetos: Mantenha cores, proporções e detalhes de elementos como bandeiras ou dispositivos sem distorções geométricas.

Estética Fotográfica: O resultado deve ser "shot on 85mm", com realismo óptico absoluto. Elimine qualquer aspecto de CGI, suavização excessiva de pele ou inteligência artificial óbvia.

Controle de Acessórios: Proibido adicionar óculos, brincos ou joias voluntariamente. Renderize apenas relógios ou alianças se descritos no prompt.

⚙️ PARÂMETROS DE RENDERIZAÇÃO
Qualidade: Masterpiece, 8K, hiper-realista.

Física: Respeite a profundidade de campo (bokeh) e a dispersão de luz (subsurface scattering) descritas no bloco de iluminação.

Consistência: Garanta que a pegada da mão no objeto (grip tension) seja anatomicamente correta conforme as fotos de referência.`;

// --- INSTRUÇÕES DO AGENTE DE CORREÇÃO DE FOTOS ---
const IMAGE_CORRECTOR_INSTRUCTION = `# ROLE
You are the "Ultra-High Fidelity Image Restoration Agent." Your sole purpose is to act as a sophisticated neural upscaler and detail reconstructor. You transform low-quality, blurry, or pixelated images into 8K professional-grade photorealistic masterpieces.

# CORE MISSION: 100% FIDELITY
- MAINTAIN 100% of the original identity, facial structure, expression, pose, and composition.
- DO NOT alter, redesign, replace, or add any new elements to the scene.
- Every pixel enhanced must be a logical high-definition extension of the source material.

# TECHNICAL ENHANCEMENT PROTOCOLS
1. SKIN REALISM: Reconstruct skin using "Micro-Detail Recovery." Visible pores, natural texture, small imperfections (moles, freckles), and subsurface scattering (light glowing through skin edges). NO over-smoothing. NO "beauty filter" look.
2. EYES & GAZE: Restore iris micro-patterns and natural moisture. Add subtle light reflections in the pupils. Ensure the sclera (white of the eye) has realistic vascularity and depth.
3. HAIR PRECISION: Render individual strands of hair, including flyaways and baby hairs catching the light. Ensure realistic flow and separation of hair clumps.
4. MATERIAL PHYSICS: Enhance textures of clothing (fabrics, weaves), metals (reflections/scratches), and backgrounds with physically accurate material response.
5. LIGHTING & OPTICS: Maintain the original lighting setup but balance tones and dynamic range. Apply a "Shot on Arri Alexa" RAW aesthetic with professional cinematic grading.

# STRICT PROHIBITIONS
- NO AI-generated "hallucinations" (adding jewelry, changing background).
- NO plastic-looking skin or artificial sharpness.
- NO changing the camera angle or focal length.

# OUTPUT STYLE GUIDELINES
- Resolution: 8K UHD, ProRes quality.
- Finish: Photorealistic, organic, studio-level sharpness.
- Keyword Focus: "Hyper-detailed, macro-texture, 8k resolution, cinematic lighting, raw photo, maximum fidelity."`;

// Helper function for retrying API calls (now for fetch)
const executeWithRetry = async (operation: () => Promise<Response>, maxRetries = 3, delayMs = 2000): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await operation();
      if (response.status === 503 || response.status === 429) {
        throw { status: response.status, message: 'High demand' };
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error: any) {
      const isRetryable = error?.status === 503 || error?.status === 429 || error?.message?.includes('503') || error?.message?.includes('high demand');
      if (isRetryable && attempt < maxRetries) {
        console.warn(`API Retryable Error (Attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        if (isRetryable) {
          throw new Error("O servidor da IA está com alta demanda no momento. Por favor, tente novamente em alguns minutos.");
        }
        throw error;
      }
    }
  }
};

// FUNÇÃO 1: GERAR PROMPT MESTRE (TEXTO E IMAGEM)
export const generateMasterPrompt = async (
  base64Image: string, 
  userRequest: string
): Promise<{ text: string, image?: string }> => {
  try {
    const cleanBase64 = base64Image ? base64Image.replace(/^data:image\/\w+;base64,/, "") : "";
    const mimeType = base64Image ? (base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg") : "";

    const data = await executeWithRetry(() => fetch('/api/gemini/master-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data: cleanBase64,
        mimeType,
        userRequest,
        systemInstruction: PROMPT_ENGINEER_INSTRUCTION
      })
    }));

    return {
      text: data.text || "Erro: O modelo não retornou texto.",
      image: data.image
    };
  } catch (error: any) {
    console.error("Erro no Gerador de Prompt:", error);
    throw error;
  }
};

// FUNÇÃO 2: GERAR IMAGEM EM ALTA 2K
export const generateImageAlta2K = async (
  base64Images: string[], 
  prompt: string,
  aspectRatio: string = "4:5"
): Promise<string> => {
  try {
    const data = await executeWithRetry(() => fetch('/api/gemini/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${IMAGE_GENERATOR_INSTRUCTION}\n\nUser Request: ${prompt}`,
        referenceImages: base64Images,
        aspectRatio,
        mode: 'high2k'
      })
    }));

    if (!data.imageUrl) throw new Error("Nenhuma imagem foi gerada.");
    return data.imageUrl;
  } catch (error: any) {
    console.error("Erro no Gerador de Imagem (2K):", error);
    throw error;
  }
};

// FUNÇÃO 3: GERAR IMAGEM EM ULTRA 4K
export const generateImageUltra4K = async (
  base64Images: string[], 
  prompt: string,
  aspectRatio: string = "4:5"
): Promise<string> => {
  try {
    const data = await executeWithRetry(() => fetch('/api/gemini/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${IMAGE_GENERATOR_INSTRUCTION}\n\nUser Request: ${prompt}`,
        referenceImages: base64Images,
        aspectRatio,
        mode: 'ultra4k'
      })
    }));

    if (!data.imageUrl) throw new Error("Nenhuma imagem foi gerada.");
    return data.imageUrl;
  } catch (error: any) {
    console.error("Erro no Gerador de Imagem (4K):", error);
    throw error;
  }
};

// FUNÇÃO 4: GERAR IMAGEM EM BAIXA (TESTE)
export const generateImageLow = async (
  base64Images: string[], 
  prompt: string,
  aspectRatio: string = "4:5"
): Promise<string> => {
  try {
    const data = await executeWithRetry(() => fetch('/api/gemini/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${IMAGE_GENERATOR_INSTRUCTION}\n\nUser Request: ${prompt}`,
        referenceImages: base64Images,
        aspectRatio,
        mode: 'low'
      })
    }));

    if (!data.imageUrl) throw new Error("Nenhuma imagem foi gerada.");
    return data.imageUrl;
  } catch (error: any) {
    console.error("Erro no Gerador de Imagem (Baixa):", error);
    throw error;
  }
};

// FUNÇÃO 5: CORREÇÃO DE FOTOS (ENHANCE)
export const enhanceImage = async (
  base64Image: string,
  userRequest: string = "Enhance this image with maximum fidelity.",
  imageSize: "1K" | "2K" | "4K" = "2K"
): Promise<string> => {
  try {
    const data = await executeWithRetry(() => fetch('/api/gemini/enhance-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Image,
        userRequest: `${IMAGE_CORRECTOR_INSTRUCTION}\n\nUser Request: ${userRequest}`,
        systemInstruction: IMAGE_CORRECTOR_INSTRUCTION,
        size: imageSize
      })
    }));

    if (!data.imageUrl) throw new Error("Nenhuma imagem foi gerada.");
    return data.imageUrl;
  } catch (error: any) {
    console.error("Erro no Corretor de Imagem:", error);
    throw error;
  }
};
