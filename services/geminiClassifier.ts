import { PERSON_TYPES, STYLES, ENVIRONMENTS } from '../constants';

interface PhotoAnalysisResult {
  titulo: string;
  tipoDePessoa: string;
  estilo: string[];
  ambiente: string;
}

const resizeImage = (base64Str: string, maxWidth = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 70% quality
    };
  });
};

export const analyzeImageWithAI = async (base64Image: string): Promise<PhotoAnalysisResult> => {
  try {
    // Compress image before sending
    const compressedImage = await resizeImage(base64Image);
    
    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = compressedImage.replace(/^data:image\/\w+;base64,/, "");

    const systemPrompt = `🤖 System Instructions: Classificador de Imagens JSON (v1.3)
FUNÇÃO:
Você é um motor de classificação visual especializado em extração de metadados. Sua única tarefa é analisar a imagem enviada e retornar exclusivamente um objeto JSON válido, sem qualquer texto adicional ou formatação Markdown.

REGRAS OBRIGATÓRIAS DE EXECUÇÃO:

Output Exclusivo: Retorne apenas o JSON puro. Não use blocos de código (\`\`\`json).

Formato de Dados: Os campos tipoDePessoa e estilo devem ser arrays. O campo ambiente deve ser uma string única.

Preenchimento Total: Todos os campos devem existir. Se não houver classificação, use ["Nenhum"] para arrays ou "Nenhum" para strings.

Normalização: Não utilize acentos (ex: "Estudio", "Medico", "Fotografico").

Título: String curta e puramente descritiva da cena.

LÓGICA DE CLASSIFICAÇÃO:

Ambiente (Escolha Única):

Foto de Estudio: Fundo infinito/neutro sem qualquer objeto (cadeiras, mesas, janelas).

Foto Interna: Ambientes fechados (escritórios, clínicas) OU fundo infinito que contenha objetos (cadeira, mesa).

Ambiente: Fotos ao ar livre, locais abertos ou natureza.

Palestras e Eventos: Locais que remetam a cursos, salas de aula, palcos ou auditórios.

Estilo (Array):

Ensaio Fotografico: Fotos em estúdio com fundo infinito.

Lifestyle: Imagens que remetam a ostentação, luxo ou status.

Figura Publica: Imagens que remetam a políticos ou representação pública.

Profissoes: Executivo, Medico, Dentista, Corretor, Advogado.

ESQUEMA JSON OBRIGATÓRIO:

{
"titulo": "string",
"tipoDePessoa": ["Homem", "Mulher", "Dupla", "Casal", "Nenhum"],
"estilo": ["Ensaio Fotografico", "Executivo", "Medico", "Dentista", "Corretor", "Advogado", "Lifestyle", "Figura Publica", "Nenhum"],
"ambiente": "Foto de Estudio" | "Foto Interna" | "Ambiente" | "Palestras e Eventos" | "Nenhum"
}`;

    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, systemPrompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze image');
    }

    const data = await response.json();
    const outputText = data.text;

    if (!outputText) {
      throw new Error('Gemini did not return content.');
    }

    let result: any;
    try {
        // More robust JSON extraction: find the first { and last }
        const jsonMatch = outputText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON object found in response");
        }
        const cleanJson = jsonMatch[0];
        result = JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini:", outputText);
        throw new Error("Invalid JSON response from AI");
    }
    
    // Helper to validate and fallback with normalization
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const findMatch = (value: string, allowed: string[]): string | undefined => {
        if (!value) return undefined;
        const normalizedValue = normalize(value);
        if (normalizedValue === 'politica' || normalizedValue === 'foto politica') {
            return allowed.find(a => normalize(a).includes('politica'));
        }
        return allowed.find(a => normalize(a) === normalizedValue);
    };

    const validateSingle = (value: string | string[], allowed: string[]): string => {
      if (Array.isArray(value)) {
        for (const v of value) {
            const match = findMatch(v, allowed);
            if (match) return match;
        }
        return 'Nenhum';
      }
      return findMatch(value, allowed) || 'Nenhum';
    };

    const validateMulti = (value: string | string[], allowed: string[]): string[] => {
      let values: string[] = [];
      if (Array.isArray(value)) {
        values = value;
      } else {
        values = [value];
      }
      
      const valid = values
        .map(v => findMatch(v, allowed))
        .filter((v): v is string => !!v);
        
      return valid.length > 0 ? valid : ['Nenhum'];
    };

    // Map JSON arrays to our internal format
    const finalResult: PhotoAnalysisResult = {
        titulo: result.titulo || "Sem título",
        tipoDePessoa: validateSingle(result.tipoDePessoa, PERSON_TYPES),
        estilo: validateMulti(result.estilo, STYLES),
        ambiente: validateSingle(result.ambiente, ENVIRONMENTS)
    };

    return finalResult;
  } catch (e) {
    console.error('Error during AI analysis:', e);
    throw new Error('Failed to perform AI analysis.');
  }
};
