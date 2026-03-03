import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutGrid, 
  PlusCircle, 
  Search, 
  Upload, 
  Image as ImageIcon,
  Save,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Aperture,
  Edit2,
  Bell,
  MessageSquare,
  User,
  Filter,
  ChevronDown,
  Download,
  X,
  Copy,
  Check,
  Zap,
  GripVertical,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Smartphone,
  Monitor,
  Brush
} from 'lucide-react';

import { 
  DndContext, 
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';

import { PhotoData, FilterState, TabView, ToastNotification } from './types';
import { PERSON_TYPES, STYLES, ENVIRONMENTS } from './constants';
import * as db from './services/mockBackend';
import { analyzeImageWithAI } from './services/geminiClassifier';
import { generateImageAlta2K, generateImageUltra4K, generateImageLow, generateMasterPrompt, enhanceImage } from './services/geminiService';
import { Button } from './components/Button';
import { PhotoCard } from './components/PhotoCard';
import { SortablePhoto } from './src/components/SortablePhoto';
import { FloatingActions } from './components/FloatingActions';
import { EmailModal } from './components/EmailModal';
import { MultiSelect } from './components/MultiSelect';
import { savePendingAction, getPendingAction, deletePendingAction } from './services/storageService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  // State: Data
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [totalPhotosCount, setTotalPhotosCount] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  // State: UI
  const [currentTab, setCurrentTab] = useState<TabView>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false); // New state for filter panel
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // State: Editing/Form
  const [editingPhoto, setEditingPhoto] = useState<Partial<PhotoData>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  
  // State: Generator
  const [generatorPhotos, setGeneratorPhotos] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<'low' | 'high2k' | 'ultra4k' | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('4:5');
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', text?: string, images?: string[], generatedImage?: string, photoCode?: string}[]>([]);
  const [expandedImage, setExpandedImage] = useState<{url: string, prompt: string, code?: string} | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    
    const checkSupabaseHealth = async () => {
      try {
        const res = await fetch('/api/health/supabase');
        if (!res.ok) {
          const err = await res.json();
          const details = err.details ? `: ${err.details}` : '';
          throw new Error(`${err.error || 'Supabase unreachable'}${details}`);
        }
      } catch (e: any) {
        console.warn('Supabase Health Check Failed:', e.message || e);
        addToast(`Modo Offline: Usando armazenamento local.`, 'success');
      }
    };

    checkApiKey();
    checkSupabaseHealth();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per guidelines
    }
  };

  const handleAiError = (error: any, defaultMessage: string) => {
    console.error(error);
    const errorMessage = error?.message || '';
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('Requested entity was not found') || errorMessage.includes('permission')) {
      setHasApiKey(false);
      addToast('Erro de permissão na chave de API. Por favor, selecione uma chave válida.', 'error');
    } else {
      addToast(defaultMessage, 'error');
    }
  };

  // State: Optimization
  const [optimizationStatus, setOptimizationStatus] = useState({ 
    isOptimizing: false, 
    current: 0, 
    total: 0, 
    status: '' 
  });

  // State: Prompt Generator
  const [promptGenPhotos, setPromptGenPhotos] = useState<string[]>([]);
  const [promptGenRequest, setPromptGenRequest] = useState<string>('');
  const [generatedMasterPrompt, setGeneratedMasterPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptChatHistory, setPromptChatHistory] = useState<{role: 'user' | 'assistant', text?: string, images?: string[], generatedPrompt?: string}[]>([]);
  
  // State: Photo Corrector
  const [correctorImage, setCorrectorImage] = useState<string | null>(null);
  const [correctedImage, setCorrectedImage] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctorSize, setCorrectorSize] = useState<'1K' | '2K' | '4K'>('2K');
  const [correctorHistory, setCorrectorHistory] = useState<{role: 'user' | 'assistant', image?: string, correctedImage?: string, text?: string, photoCode?: string}[]>([]);
  const [correctorRequest, setCorrectorRequest] = useState<string>('');

  // State: Filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    personType: [],
    style: [],
    environment: []
  });

  const [displayMode, setDisplayMode] = useState<'date' | 'grouped'>('grouped');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  // Infinite Scroll Observer
  const observerTarget = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Effects ---

  useEffect(() => {
    loadData();

    // Check for pending actions from new tab
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    const checkPending = async () => {
        if (action === 'generate') {
            try {
                const pending = await getPendingAction('pending_generation');
                if (pending) {
                    const { mode, prompt, images } = pending;
                    setGenerationMode(mode);
                    setCustomPrompt(prompt);
                    setGeneratorPhotos(images || []);
                    setIsGenerationModalOpen(true);
                    setCurrentTab('generator');
                    // Clear storage to prevent reopening on refresh
                    await deletePendingAction('pending_generation');
                    // Clean URL
                    window.history.replaceState({}, '', window.location.pathname);
                }
            } catch (e) {
                console.error("Failed to parse pending generation data", e);
            }
        } else if (action === 'register') {
            try {
                const pending = await getPendingAction('pending_registration');
                if (pending) {
                    setEditingPhoto({
                        ...pending,
                        code: pending.code
                    });
                    setCurrentTab('editor');
                    await deletePendingAction('pending_registration');
                    window.history.replaceState({}, '', window.location.pathname);

                    // Trigger AI Analysis
                    if (pending.imageUrl) {
                        setIsAnalyzingAI(true);
                        try {
                            const aiAnalysis = await analyzeImageWithAI(pending.imageUrl);
                            setEditingPhoto(prev => ({
                                ...prev,
                                title: aiAnalysis.titulo,
                                personType: aiAnalysis.tipoDePessoa,
                                style: aiAnalysis.estilo,
                                environment: aiAnalysis.ambiente,
                            }));
                            addToast('Análise de IA concluída!', 'success');
                        } catch (aiError) {
                            console.error('Erro na análise de IA:', aiError);
                            addToast('Falha na análise de IA. Preencha manualmente.', 'error');
                        } finally {
                            setIsAnalyzingAI(false);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse pending registration data", e);
            }
        }
    };
    
    checkPending();
  }, []);

  const loadData = async (retryCount = 0) => {
    if (retryCount === 0 && photos.length === 0) setIsLoading(true);
    setPage(0);
    setHasMore(true);
    try {
      // Fetch total count
      db.getTotalPhotosCount().then(setTotalPhotosCount);

      // Force refresh on initial load to bypass stale cache
      // Increased page size to 30 to display more photos
      const data = await db.getPhotos(0, 30, true);
      setPhotos(data);
      if (data.length < 30) setHasMore(false);
      setIsLoading(false); // Success
    } catch (e: any) {
      console.error('Error loading data:', e);
      if (retryCount < 2) {
        console.log(`Retrying loadData... Attempt ${retryCount + 1}`);
        setTimeout(() => loadData(retryCount + 1), 1500); // Increased delay
      } else {
        setIsLoading(false); // Give up
        const errorMessage = e.message || 'Erro de conexão';
        addToast(`Erro ao carregar fotos: ${errorMessage}`, 'error');
      }
    }
  };

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;
    
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const data = await db.getPhotos(nextPage, 30);
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setPhotos(prev => {
          // Filter out duplicates to prevent "duplicate key" errors
          const existingIds = new Set(prev.map(p => p.id));
          const newPhotos = data.filter(p => !existingIds.has(p.id));
          return [...prev, ...newPhotos];
        });
        setPage(nextPage);
        if (data.length < 30) setHasMore(false);
      }
    } catch (e) {
      addToast('Erro ao carregar mais fotos', 'error');
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, isFetchingMore, loadMore]);

  // --- Helpers ---

  const addToast = (message: string, type: ToastNotification['type'] = 'info') => {
    const id = crypto.randomUUID(); // Use UUID instead of Date.now()
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent, target: 'generator' | 'prompt-generator' | 'photo-corrector') => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files) as File[];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    const base64Promises = imageFiles.map(f => db.fileToBase64(f));
    const base64s = await Promise.all(base64Promises);

    if (target === 'generator') {
      setGeneratorPhotos(prev => {
        const combined = [...prev, ...base64s];
        return combined.slice(0, 17);
      });
    } else if (target === 'prompt-generator') {
      setPromptGenPhotos(prev => {
        const combined = [...prev, ...base64s];
        return combined.slice(0, 17);
      });
    } else if (target === 'photo-corrector') {
      setCorrectorImage(base64s[0]);
    }
    
    addToast(`${imageFiles.length} imagem(ns) adicionada(s)`, 'success');
  };

  // --- Handlers: Gallery ---

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDownloadTxt = () => {
    const selected = photos.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const date = new Date().toLocaleDateString('pt-BR');
    let content = `Data de Geração: ${date}\n`;
    content += `Quantidade de Prompts: ${selected.length}\n\n`;
    content += `========================================\n\n`;

    selected.forEach((p, index) => {
      content += `PROMPT ${String(index + 1).padStart(2, '0')}:\n`;
      content += `${p.prompt}\n\n`;
      content += `----------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_export_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast('Arquivo TXT baixado com sucesso', 'success');
  };

  const handleSendEmail = async (email: string) => {
    // Simulation of API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    // In a real app, we would post the IDs and Email to backend
    console.log(`Enviando e-mail para ${email} com IDs:`, Array.from(selectedIds));
    addToast('E-mail enviado com sucesso', 'success');
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await db.exportBackup();
      addToast('Backup concluído com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erro ao gerar backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // --- Handlers: CRUD ---

  const resetForm = () => {
    setIsSaveSuccess(false);
    setSelectedFile(null);
    setEditingPhoto({
      personType: PERSON_TYPES[0],
      style: [], // Initialize as empty array
      environment: ENVIRONMENTS[0], // Initialize as string
      tags: [],
      imageUrl: '',
      title: '', // New field
      prompt: ''
    });
  };

  const handleSwitchToAdd = () => {
    resetForm();
    setCurrentTab('editor');
  };

  const handleEdit = (photo: PhotoData) => {
    setIsSaveSuccess(false);
    setEditingPhoto({ ...photo });
    setCurrentTab('editor');
  };

  const handleDuplicate = async (photo: PhotoData) => {
    const newId = db.generateId();
    const newPhoto = {
      ...photo,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Optimistic UI update
    setPhotos(prev => [newPhoto, ...prev]);
    
    // Save to DB
    await db.savePhoto(newPhoto);
    
    // Go to edit mode for the new duplicate
    handleEdit(newPhoto);
    addToast('Foto duplicada', 'success');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto.imageUrl && !selectedFile) {
      addToast('Imagem e Prompt são obrigatórios', 'error');
      return;
    }
    if (!editingPhoto.prompt) {
      addToast('Prompt é obrigatório', 'error');
      return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = editingPhoto.imageUrl || '';

      // Upload image if a new file was selected
      if (selectedFile) {
        try {
          finalImageUrl = await db.uploadImage(selectedFile);
        } catch (uploadError) {
          console.error(uploadError);
          addToast('Erro ao fazer upload da imagem', 'error');
          setIsSaving(false);
          return;
        }
      }

      const isNew = !editingPhoto.id;
      const id = editingPhoto.id || db.generateId();
      const now = new Date().toISOString();

      const payload: PhotoData = {
        id,
        imageUrl: finalImageUrl,
        title: editingPhoto.title || 'Sem título',
        prompt: editingPhoto.prompt,
        personType: editingPhoto.personType || PERSON_TYPES[0],
        style: Array.isArray(editingPhoto.style) ? editingPhoto.style : [editingPhoto.style || 'Nenhum'],
        environment: Array.isArray(editingPhoto.environment) ? (editingPhoto.environment[0] || 'Nenhum') : (editingPhoto.environment || 'Nenhum'),
        tags: editingPhoto.tags || [],
        code: editingPhoto.code,
        createdAt: editingPhoto.createdAt || now,
        updatedAt: now
      };

      const saved = await db.savePhoto(payload);
      
      setPhotos(prev => {
        const idx = prev.findIndex(p => p.id === saved.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        // Add new photo to the END of the list
        return [...prev, saved];
      });

      addToast(isNew ? 'Foto cadastrada' : 'Foto atualizada', 'success');
      setIsSaveSuccess(true);
      setSelectedFile(null);
    } catch (err) {
      addToast('Erro ao salvar dados', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const processImageFile = async (file: File) => {
    try {
      setSelectedFile(file);
      const base64 = await db.fileToBase64(file);
      setEditingPhoto(prev => ({ ...prev, imageUrl: base64 }));

      setIsAnalyzingAI(true);
      try {
        const aiAnalysis = await analyzeImageWithAI(base64);
        setEditingPhoto(prev => ({
          ...prev,
          title: aiAnalysis.titulo,
          personType: aiAnalysis.tipoDePessoa,
          style: aiAnalysis.estilo,
          environment: aiAnalysis.ambiente,
        }));
        addToast('Análise de IA concluída!', 'success');
      } catch (aiError) {
        console.error('Erro na análise de IA:', aiError);
        addToast('Falha na análise de IA. Preencha manualmente.', 'error');
      } finally {
        setIsAnalyzingAI(false);
      }
    } catch (err) {
      addToast('Erro ao ler arquivo', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  // --- Handlers: Generator ---

  const handleGeneratorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (generatorPhotos.length + files.length > 17) {
      addToast('Limite máximo de 17 fotos atingido', 'error');
      return;
    }

    try {
      const newPhotos = await Promise.all(files.map(file => db.fileToBase64(file)));
      setGeneratorPhotos(prev => [...prev, ...newPhotos]);
    } catch (err) {
      addToast('Erro ao carregar imagens', 'error');
    }
  };

  const handleGenerateImage = async () => {
    if (generatorPhotos.length === 0) {
      addToast('Adicione pelo menos uma foto', 'error');
      return;
    }
    if (!customPrompt.trim()) {
      addToast('Digite um prompt', 'error');
      return;
    }

    setIsGenerating(true);
    
    // Add user message to history
    const userMsg = { role: 'user' as const, text: customPrompt, images: [...generatorPhotos] };
    setChatHistory(prev => [...prev, userMsg]);

    // Clear inputs for next message
    const currentPrompt = customPrompt;
    const currentPhotos = [...generatorPhotos];
    setCustomPrompt('');
    setGeneratorPhotos([]);

    try {
      // For follow-up, we might want to include the last generated image as a reference
      const lastGenerated = chatHistory.filter(m => m.generatedImage).pop()?.generatedImage;
      const allRefs = [...currentPhotos];
      if (lastGenerated) allRefs.push(lastGenerated);

      let result = '';
      if (generationMode === 'ultra4k') {
        result = await generateImageUltra4K(allRefs, currentPrompt, aspectRatio);
      } else if (generationMode === 'high2k') {
        result = await generateImageAlta2K(allRefs, currentPrompt, aspectRatio);
      } else {
        result = await generateImageLow(allRefs, currentPrompt, aspectRatio);
      }
      
      const photoCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      setGeneratedImage(result);
      setChatHistory(prev => [...prev, { role: 'assistant', generatedImage: result, photoCode }]);
      addToast('Imagem gerada com sucesso!', 'success');
    } catch (error) {
      handleAiError(error, 'Erro ao gerar imagem');
    } finally {
      setIsGenerating(false);
    }
  };

  const openGenerationModal = (mode: 'low' | 'high2k' | 'ultra4k', initialPrompt?: string, initialPhotos?: string[]) => {
    setGenerationMode(mode);
    setIsGenerationModalOpen(true);
    setChatHistory([]);
    setGeneratorPhotos(initialPhotos || []);
    setCustomPrompt(initialPrompt || '');
    setGeneratedImage(null);
  };

  const closeGenerationModal = () => {
    setIsGenerationModalOpen(false);
    setIsResultModalOpen(false);
    setGeneratorPhotos([]);
    setCustomPrompt('');
    setGeneratedImage(null);
    setChatHistory([]);
  };

  const handleDownloadGenerated = () => {
    if (!generatedImage) return;
    
    // Find the photo code from chat history
    const lastMsg = chatHistory.filter(m => m.generatedImage === generatedImage).pop();
    const code = lastMsg?.photoCode || Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `ED - Foto ${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Handlers: Prompt Generator ---

  const handlePromptGenUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const base64Promises = files.map(f => db.fileToBase64(f));
      const base64s = await Promise.all(base64Promises);
      setPromptGenPhotos(prev => {
        const combined = [...prev, ...base64s];
        return combined.slice(0, 17);
      });
    }
  };

  const handleGenerateMasterPrompt = async () => {
    if (promptGenPhotos.length === 0 && !promptGenRequest.trim()) {
      addToast('Adicione uma foto ou digite um pedido', 'error');
      return;
    }

    const currentRequest = promptGenRequest;
    const currentPhotos = [...promptGenPhotos];

    // Add user message to history
    setPromptChatHistory(prev => [...prev, {
      role: 'user',
      text: currentRequest,
      images: currentPhotos
    }]);

    setIsGeneratingPrompt(true);
    setPromptGenRequest('');
    setPromptGenPhotos([]);

    try {
      // Use the first photo as reference if available
      const referenceImage = currentPhotos.length > 0 ? currentPhotos[0] : '';
      const result = await generateMasterPrompt(referenceImage, currentRequest);
      
      setGeneratedMasterPrompt(result.text);
      setPromptChatHistory(prev => [...prev, {
        role: 'assistant',
        text: 'Prompt Mestre gerado com sucesso!',
        generatedPrompt: result.text,
        images: result.image ? [result.image] : undefined
      }]);
      addToast('Prompt Mestre gerado!', 'success');
    } catch (error) {
      handleAiError(error, 'Erro ao gerar prompt');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copiado para a área de transferência!', 'success');
  };

    const handleEnhanceImage = async () => {
      if (!correctorImage) {
        addToast('Adicione uma foto para corrigir', 'error');
        return;
      }

      const currentImage = correctorImage;
      const currentRequest = correctorRequest;

      setCorrectorHistory(prev => [...prev, {
        role: 'user',
        image: currentImage,
        text: currentRequest
      }]);

      setIsCorrecting(true);
      setCorrectorImage(null);
      setCorrectorRequest('');

      try {
        const result = await enhanceImage(currentImage, currentRequest, correctorSize);
        const photoCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        setCorrectedImage(result);
        setCorrectorHistory(prev => [...prev, {
          role: 'assistant',
          correctedImage: result,
          text: 'Imagem aprimorada com sucesso!',
          photoCode
        }]);
        addToast('Imagem aprimorada!', 'success');
      } catch (error) {
        handleAiError(error, 'Erro ao aprimorar imagem');
      } finally {
        setIsCorrecting(false);
      }
    };

    const handleCorrectorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          const base64 = await db.fileToBase64(file);
          setCorrectorImage(base64);
        } catch (err) {
          addToast('Erro ao carregar imagem', 'error');
        }
      }
    };

  // --- Filtering Logic ---

  const filteredPhotos = useMemo(() => {
    let result = photos.filter(p => {
      // Search: Title OR Prompt OR Tags
      const searchLower = filters.search.toLowerCase();
      const matchSearch = filters.search === '' || 
        (p.title && p.title.toLowerCase().includes(searchLower)) ||
        (p.prompt && p.prompt.toLowerCase().includes(searchLower)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(searchLower)));

      // Filter: Person Type (OR logic within category)
      const matchPerson = filters.personType.length === 0 || filters.personType.includes(p.personType);
      
      // Filter: Style (OR logic within category, intersection check)
      const pStyles = Array.isArray(p.style) ? p.style : [p.style];
      const matchStyle = filters.style.length === 0 || filters.style.some(s => pStyles.includes(s));
      
      // Filter: Environment (OR logic within category, intersection check)
      const pEnvs = Array.isArray(p.environment) ? p.environment : [p.environment];
      const matchEnv = filters.environment.length === 0 || filters.environment.some(e => pEnvs.includes(e));
      
      return matchSearch && matchPerson && matchStyle && matchEnv;
    });

    // Sort based on current display mode to ensure UI consistency
    return result.sort((a, b) => {
      if (displayMode === 'date') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
      
      // Grouped mode: sort by group first, then displayOrder
      const personCompare = (a.personType || '').localeCompare(b.personType || '');
      if (personCompare !== 0) return personCompare;
      
      const envCompare = (a.environment || '').localeCompare(b.environment || '');
      if (envCompare !== 0) return envCompare;
      
      const orderA = a.displayOrder ?? 999999;
      const orderB = b.displayOrder ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [photos, filters, sortOrder, displayMode]);

  const groupedPhotos = useMemo(() => {
    if (displayMode !== 'grouped') return null;

    const groups: Record<string, Record<string, PhotoData[]>> = {};

    filteredPhotos.forEach(photo => {
      const person = photo.personType || 'Nenhum';
      let env = photo.environment || 'Nenhum';
      
      // Extra safety cleaning for the UI
      if (typeof env === 'string') {
        env = env.replace(/[\[\]"']/g, '').trim();
      }
      if (!env) env = 'Nenhum';

      // Group by Environment first, then Person
      if (!groups[env]) groups[env] = {};
      if (!groups[env][person]) groups[env][person] = [];
      
      groups[env][person].push(photo);
    });

    // Sort photos within each group by displayOrder primarily
    Object.keys(groups).forEach(env => {
      Object.keys(groups[env]).forEach(person => {
        groups[env][person].sort((a, b) => {
          // Primary sort by displayOrder
          const orderA = a.displayOrder ?? 999999;
          const orderB = b.displayOrder ?? 999999;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // Secondary sort by style if order is same
          const styleA = (Array.isArray(a.style) ? a.style[0] : a.style) || '';
          const styleB = (Array.isArray(b.style) ? b.style[0] : b.style) || '';
          const styleCompare = styleA.localeCompare(styleB);
          if (styleCompare !== 0) return styleCompare;
          
          // Final fallback to date
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });
    });

    // Create a new object with sorted keys based on ENVIRONMENTS array
    const sortedGroups: Record<string, Record<string, PhotoData[]>> = {};
    
    // Sort environments based on ENVIRONMENTS array
    const sortedEnvs = Object.keys(groups).sort((a, b) => {
      const idxA = ENVIRONMENTS.indexOf(a);
      const idxB = ENVIRONMENTS.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    sortedEnvs.forEach(env => {
      sortedGroups[env] = {};
      
      // Sort person types
      const sortedPersons = Object.keys(groups[env]).sort((a, b) => {
        const idxA = PERSON_TYPES.indexOf(a);
        const idxB = PERSON_TYPES.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      sortedPersons.forEach(person => {
        sortedGroups[env][person] = groups[env][person];
      });
    });

    return sortedGroups;
  }, [filteredPhotos, displayMode]);


  const handleCardGenerate = async (photo: PhotoData, mode: 'high2k' | 'ultra4k') => {
    const data = {
        mode: mode,
        prompt: photo.prompt,
        images: [] // User requested to send only prompt, not the image
    };
    await savePendingAction('pending_generation', data);
    window.open(window.location.origin + '?action=generate', '_blank');
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log('Drag started:', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('Drag ended:', { activeId: active.id, overId: over?.id });
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 1. Find the photo being dragged
    const activePhoto = photos.find(p => p.id === activeId);
    if (!activePhoto) {
      console.warn('Active photo not found in state:', activeId);
      return;
    }

    // 2. Determine target group
    let targetPersonType = activePhoto.personType;
    let targetEnvironment = activePhoto.environment;

    const overData = over.data.current;
    if (overData?.type === 'container') {
      targetPersonType = overData.personType;
      targetEnvironment = overData.environment;
      console.log('Dropped on container:', { targetPersonType, targetEnvironment });
    } else {
      const overPhoto = photos.find(p => p.id === overId);
      if (overPhoto) {
        targetPersonType = overPhoto.personType;
        targetEnvironment = overPhoto.environment;
        console.log('Dropped on photo:', { targetPersonType, targetEnvironment });
      }
    }

    const hasMetadataChanged = targetPersonType !== activePhoto.personType || targetEnvironment !== activePhoto.environment;

    // 3. Update state and DB
    if (activeId !== overId || hasMetadataChanged) {
      setPhotos(prev => {
        // Create a working copy
        const updated = [...prev];
        const activeIdx = updated.findIndex(p => p.id === activeId);
        if (activeIdx === -1) return prev;

        // Update metadata in our copy
        const updatedPhoto = { 
          ...updated[activeIdx], 
          personType: targetPersonType, 
          environment: targetEnvironment 
        };
        updated[activeIdx] = updatedPhoto;

        // 4. Identify the list where reordering happens
        let currentViewList: PhotoData[] = [];
        
        if (displayMode === 'date') {
          // In date mode, we reorder within the filtered list
          const searchLower = filters.search.toLowerCase();
          currentViewList = updated.filter(p => {
            const matchSearch = filters.search === '' || 
              (p.title && p.title.toLowerCase().includes(searchLower)) ||
              (p.prompt && p.prompt.toLowerCase().includes(searchLower)) ||
              (p.tags && p.tags.some(t => t.toLowerCase().includes(searchLower)));
            const matchPerson = filters.personType.length === 0 || filters.personType.includes(p.personType);
            const pStyles = Array.isArray(p.style) ? p.style : [p.style];
            const matchStyle = filters.style.length === 0 || filters.style.some(s => pStyles.includes(s));
            const pEnvs = Array.isArray(p.environment) ? p.environment : [p.environment];
            const matchEnv = filters.environment.length === 0 || filters.environment.some(e => pEnvs.includes(e));
            return matchSearch && matchPerson && matchStyle && matchEnv;
          });
          
          // Sort by date (as the UI does)
          currentViewList.sort((a, b) => {
             const dateA = new Date(a.createdAt).getTime();
             const dateB = new Date(b.createdAt).getTime();
             return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          });
        } else {
          // In grouped mode, we reorder within the target group
          currentViewList = updated.filter(p => p.personType === targetPersonType && p.environment === targetEnvironment);
          
          // Sort by displayOrder (as the UI does)
          currentViewList.sort((a, b) => {
            const orderA = a.displayOrder ?? 999999;
            const orderB = b.displayOrder ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            
            const styleA = (Array.isArray(a.style) ? a.style[0] : a.style) || '';
            const styleB = (Array.isArray(b.style) ? b.style[0] : b.style) || '';
            const styleCompare = styleA.localeCompare(styleB);
            if (styleCompare !== 0) return styleCompare;
            
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        // 5. Calculate new indices
        const oldIndex = currentViewList.findIndex(p => p.id === activeId);
        let newIndex = currentViewList.findIndex(p => p.id === overId);
        
        // If dropped on container, move to end
        if (newIndex === -1 && overData?.type === 'container') {
          newIndex = currentViewList.length - 1;
        }

        if (oldIndex !== -1 && newIndex !== -1) {
          const movedList = arrayMove(currentViewList, oldIndex, newIndex);
          const updates: any[] = [];
          
          movedList.forEach((p, i) => {
            const idx = updated.findIndex(item => item.id === p.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], displayOrder: i };
              updates.push({
                id: p.id,
                displayOrder: i,
                personType: updated[idx].personType,
                environment: updated[idx].environment
              });
            }
          });

          db.updatePhotosOrder(updates).catch(err => {
            console.error("Failed to save order:", err);
            addToast(`Erro ao salvar ordem: ${err.message}`, "error");
          });
        } else if (hasMetadataChanged) {
          // Just metadata changed, no specific position found
          db.updatePhotosOrder([{
            id: activeId,
            displayOrder: updated[activeIdx].displayOrder || 0,
            personType: targetPersonType,
            environment: targetEnvironment
          }]).catch(err => {
            console.error("Failed to save metadata change:", err);
            addToast(`Erro ao salvar alteração: ${err.message}`, "error");
          });
        }

        // Final sort for the state
        return [...updated].sort((a, b) => {
          if (displayMode === 'date') {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
          }
          const personCompare = (a.personType || '').localeCompare(b.personType || '');
          if (personCompare !== 0) return personCompare;
          const envCompare = (a.environment || '').localeCompare(b.environment || '');
          if (envCompare !== 0) return envCompare;
          return (a.displayOrder ?? 999999) - (b.displayOrder ?? 999999);
        });
      });
      
      if (hasMetadataChanged) {
         addToast(`Foto movida para ${targetPersonType} / ${targetEnvironment}`, 'success');
      }
    }
  };

  // Sortable Wrapper Component
  const SortablePhoto = ({ photo, ...props }: any) => {
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
      zIndex: isDragging ? 50 : undefined,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="relative group/sortable">
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute top-2 left-10 z-30 p-2 bg-primary/80 hover:bg-primary rounded-lg shadow-lg cursor-grab active:cursor-grabbing transition-all border border-white/20"
          title="Arraste para reordenar ou mudar de grupo"
        >
          <GripVertical size={18} className="text-black" />
        </div>
        <PhotoCard photo={photo} {...props} />
      </div>
    );
  };

  const handleOptimizeDatabase = async () => {
    if (!confirm('Isso irá processar TODAS as imagens do banco de dados para reduzir o tamanho (compressão). Isso pode levar alguns minutos. Deseja continuar?')) return;
    
    setOptimizationStatus({ isOptimizing: true, current: 0, total: 0, status: 'Iniciando...' });
    
    try {
      await db.optimizeDatabaseImages((current, total, status) => {
        setOptimizationStatus({ isOptimizing: true, current, total, status });
      });
      addToast('Otimização concluída com sucesso!', 'success');
      loadData(); // Refresh data
    } catch (e) {
      console.error(e);
      addToast('Erro durante a otimização.', 'error');
    } finally {
      setOptimizationStatus(prev => ({ ...prev, isOptimizing: false }));
    }
  };

  // --- Render ---

  return (
    <div className="min-h-screen flex flex-col font-sans bg-black text-zinc-100 relative overflow-hidden selection:bg-primary selection:text-black">
      {/* API Key Selection Overlay */}
      {!hasApiKey && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <Zap size={40} className="text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 font-mono uppercase tracking-tight">Chave de API Necessária</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Para utilizar os modelos de alta performance (Gemini 3.1 Flash Image), você precisa selecionar uma chave de API de um projeto Google Cloud com faturamento ativado.
            </p>
            <div className="space-y-4">
              <button
                onClick={handleOpenSelectKey}
                className="w-full py-4 bg-primary text-black rounded-2xl font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-[0_10px_20px_rgba(34,197,94,0.3)]"
              >
                Selecionar Chave de API
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-xs text-zinc-500 hover:text-primary transition-colors underline underline-offset-4"
              >
                Saiba mais sobre faturamento e cotas
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Futuristic Background */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/5 pointer-events-none z-0"></div>
      <div className="fixed inset-0 scanline opacity-10 pointer-events-none z-0"></div>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 backdrop-blur-md ${
            t.type === 'success' ? 'bg-green-900/80 border-green-500/50 text-green-100' : t.type === 'error' ? 'bg-red-900/80 border-red-500/50 text-red-100' : 'bg-zinc-900/80 border-zinc-700'
          }`}>
            {t.message}
          </div>
        ))}
      </div>

          {/* HEADER - Centered Layout with Neon Styling */}
      {currentTab !== 'home' && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 shadow-[0_0_20px_rgba(34,197,94,0.1)] pt-4 pb-4">
          <div className="flex flex-col items-center space-y-4">
            
            {/* Line 1: Centered Logo */}
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentTab('home')}>
              <div className="w-10 h-10 bg-primary/10 border border-primary/50 rounded-lg flex items-center justify-center text-primary shadow-[0_0_15px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-all duration-300">
                <Aperture size={24} />
              </div>
              <span className="text-xl font-bold tracking-widest uppercase text-white group-hover:text-primary transition-colors font-mono">
                Prompt<span className="text-primary">Gallery</span>
              </span>
            </div>

            {/* Line 2: Centered Menu Options */}
            <nav className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-white/10 rounded-full backdrop-blur-md">
              <button 
                onClick={() => setCurrentTab('home')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'home' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                MENU
              </button>
              <button 
                onClick={() => setCurrentTab('gallery')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'gallery' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                GALERIA
              </button>
              <button 
                onClick={handleSwitchToAdd}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 relative ${
                  currentTab === 'editor' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CADASTRAR
              </button>
              <button 
                onClick={() => setCurrentTab('photo-corrector')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'photo-corrector' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CORRETOR
              </button>
              <button 
                onClick={() => setCurrentTab('generator')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'generator' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                CRIAR IMAGEM
              </button>
              <button 
                onClick={() => setCurrentTab('prompt-generator')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'prompt-generator' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                PROMPT MESTRE
              </button>
              <button 
                onClick={() => setCurrentTab('database')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentTab === 'database' 
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                BANCO DE DADOS
              </button>
              <button 
                onClick={handleBackup}
                disabled={isBackingUp}
                className="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-all duration-300 flex items-center gap-2"
              >
                {isBackingUp ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                BACKUP
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 w-full mx-auto px-4 ${currentTab === 'home' ? 'pt-0' : 'pt-36'} pb-24 max-w-[1920px] z-10 relative`}>
        
        {/* VIEW: HOME SELECTION */}
        {currentTab === 'home' && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 border border-primary/50 rounded-2xl flex items-center justify-center text-primary shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                  <Aperture size={40} />
                </div>
                <h1 className="text-5xl font-black tracking-tighter uppercase text-white font-mono">
                  PROMPT<span className="text-primary">GALLERY</span>
                </h1>
              </div>
              <p className="text-zinc-500 text-lg max-w-2xl mx-auto font-medium uppercase tracking-[0.2em]">
                O ecossistema definitivo para engenharia de prompts e geração de imagens
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl px-4">
              {/* Option 1: Galeria */}
              <button 
                onClick={() => setCurrentTab('gallery')}
                className="group relative bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 text-left transition-all duration-500 hover:border-primary/40 hover:bg-zinc-900/60 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all duration-500 group-hover:rotate-6">
                  <LayoutGrid size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-mono uppercase tracking-tight">Galeria</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                  Explore a biblioteca de prompts, filtre por estilos e cadastre novas referências.
                </p>
                <div className="flex items-center gap-3 text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Acessar Galeria <ChevronDown size={16} className="-rotate-90 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              {/* Option 2: Cadastrar */}
              <button 
                onClick={handleSwitchToAdd}
                className="group relative bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 text-left transition-all duration-500 hover:border-primary/40 hover:bg-zinc-900/60 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all duration-500 group-hover:rotate-12">
                  <PlusCircle size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-mono uppercase tracking-tight">Cadastrar</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                  Adicione novas referências de imagens e prompts ao seu banco de dados pessoal.
                </p>
                <div className="flex items-center gap-3 text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Novo Registro <ChevronDown size={16} className="-rotate-90 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              {/* Option 3: Corretor de Fotos */}
              <button 
                onClick={() => setCurrentTab('photo-corrector')}
                className="group relative bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 text-left transition-all duration-500 hover:border-primary/40 hover:bg-zinc-900/60 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all duration-500 group-hover:scale-110">
                  <ImageIcon size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-mono uppercase tracking-tight">Corretor de Fotos</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                  Aprimore suas imagens com fidelidade absoluta e reconstrução de detalhes.
                </p>
                <div className="flex items-center gap-3 text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Aprimorar Foto <ChevronDown size={16} className="-rotate-90 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              {/* Option 4: Criar Imagem */}
              <button 
                onClick={() => setCurrentTab('generator')}
                className="group relative bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 text-left transition-all duration-500 hover:border-primary/40 hover:bg-zinc-900/60 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all duration-500 group-hover:-rotate-6">
                  <ImageIcon size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-mono uppercase tracking-tight">Criar Imagem</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                  Crie fotos realistas utilizando nossos agentes de IA em resoluções 2K ou 4K.
                </p>
                <div className="flex items-center gap-3 text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Iniciar Gerador <ChevronDown size={16} className="-rotate-90 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              {/* Option 5: Criar Prompt Imagem */}
              <button 
                onClick={() => setCurrentTab('prompt-generator')}
                className="group relative bg-zinc-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 text-left transition-all duration-500 hover:border-primary/40 hover:bg-zinc-900/60 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(34,197,94,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>
                <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-all duration-500 group-hover:rotate-12">
                  <Edit2 size={32} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-mono uppercase tracking-tight">Criar Prompt</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                  Transforme fotos de referência em prompts técnicos detalhados com IA.
                </p>
                <div className="flex items-center gap-3 text-primary text-xs font-bold tracking-[0.2em] uppercase">
                  Gerar Prompt <ChevronDown size={16} className="-rotate-90 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* VIEW: GALLERY */}
        {currentTab === 'gallery' && (
          <div className="space-y-8">

            {/* Filters - Fixed Grid Layout (No Scrollbars) */}
            <div className="flex flex-col items-center gap-4 w-full max-w-5xl mx-auto">
              <div className="flex items-center gap-4 w-full">
                {/* Search Bar */}
                <div className="relative flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                    <input 
                      type="text" 
                      placeholder="BUSCAR POR TÍTULO, PROMPT OU TAGS..." 
                      value={filters.search}
                      onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full bg-black/50 border border-zinc-800 rounded-full py-3 pl-12 pr-6 text-sm text-zinc-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono shadow-inner"
                    />
                  </div>
                  <button 
                    onClick={() => loadData()}
                    disabled={isLoading}
                    title="Sincronizar Banco de Dados"
                    className="p-3 bg-zinc-900/50 border border-white/5 rounded-full text-zinc-400 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                <button 
                  onClick={handleSwitchToAdd}
                  className="bg-primary/10 border border-primary/30 text-primary px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-primary/20 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] whitespace-nowrap"
                >
                  <PlusCircle size={20} />
                  CADASTRAR NOVO
                </button>
              </div>

              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                  <MultiSelect 
                    label="ENTIDADE"
                    value={filters.personType}
                    options={PERSON_TYPES}
                    onChange={v => setFilters(prev => ({ ...prev, personType: v }))}
                  />
                  <MultiSelect 
                    label="AMBIENTE"
                    value={filters.environment}
                    options={ENVIRONMENTS}
                    onChange={v => setFilters(prev => ({ ...prev, environment: v }))}
                  />
                  <MultiSelect 
                    label="ESTILO VISUAL"
                    value={filters.style}
                    options={STYLES}
                    onChange={v => setFilters(prev => ({ ...prev, style: v }))}
                  />
              </div>

              {/* Display Options */}
              <div className="flex items-center justify-between w-full border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Exibição:</span>
                  <button 
                    onClick={() => setDisplayMode('date')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${displayMode === 'date' ? 'bg-primary text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                  >
                    Por Data
                  </button>
                  <button 
                    onClick={() => setDisplayMode('grouped')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${displayMode === 'grouped' ? 'bg-primary text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                  >
                    Por Grupos
                  </button>
                </div>

                {displayMode === 'date' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Ordem:</span>
                    <button 
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
                    >
                      {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigas'}
                      <ChevronDown size={14} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 animate-pulse">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <div key={i} className="space-y-3">
                     <div className="bg-zinc-900/50 aspect-[4/5] rounded-lg border border-white/5"></div>
                     <div className="h-4 bg-zinc-900/50 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-zinc-900/50 rounded-full flex items-center justify-center text-zinc-700 mb-6 border border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <ImageIcon size={48} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 font-mono">SEM DADOS</h3>
                <p className="text-zinc-500 mb-8 max-w-md">Nenhuma imagem encontrada nos registros.</p>
                <Button variant="primary" onClick={handleSwitchToAdd} icon={<PlusCircle size={18}/>}>
                  INICIAR PROTOCOLO
                </Button>
              </div>
            ) : (
              <>
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCorners} 
                onDragStart={(e) => {
                  console.log('Drag started:', e.active.id);
                  handleDragStart(e);
                }}
                onDragEnd={handleDragEnd}
              >
                {displayMode === 'date' ? (
                  <SortableContext items={filteredPhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                      {filteredPhotos.map(photo => (
                        <SortablePhoto
                          key={photo.id}
                          photo={photo}
                          isSelected={selectedIds.has(photo.id)}
                          onToggleSelect={handleToggleSelect}
                          onEdit={handleEdit}
                          onDuplicate={handleDuplicate}
                          onGenerate={handleCardGenerate}
                        />
                      ))}
                    </div>
                  </SortableContext>
                ) : (
                  <div className="space-y-16">
                    {groupedPhotos && (Object.entries(groupedPhotos) as [string, Record<string, PhotoData[]>][]).map(([env, persons]) => (
                      <div key={env} className="space-y-8">
                        <div className="flex items-center gap-4">
                          <h2 className="text-3xl font-black text-white uppercase tracking-tighter font-mono border-l-4 border-primary pl-4">{env}</h2>
                          <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent"></div>
                        </div>
                        
                        <div className="space-y-12 pl-4">
                          {(Object.entries(persons) as [string, PhotoData[]][]).map(([person, groupPhotos]) => (
                            <DroppableContainer key={`${env}-${person}`} id={`${env}-${person}`} personType={person} environment={env}>
                              <div className="space-y-6">
                                <h3 className="text-xl font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                                  <User size={18} className="text-primary" />
                                  {person}
                                  <span className="ml-2 text-xs bg-zinc-900 px-2 py-0.5 rounded text-zinc-500 font-mono">{groupPhotos.length}</span>
                                </h3>
                                
                                <div className="pl-6 border-l border-zinc-800/50">
                                  <SortableContext items={groupPhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                      {groupPhotos.map(photo => (
                                        <SortablePhoto
                                          key={photo.id}
                                          photo={photo}
                                          isSelected={selectedIds.has(photo.id)}
                                          onToggleSelect={handleToggleSelect}
                                          onEdit={handleEdit}
                                          onDuplicate={handleDuplicate}
                                          onGenerate={handleCardGenerate}
                                        />
                                      ))}
                                    </div>
                                  </SortableContext>
                                </div>
                              </div>
                            </DroppableContainer>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              
              <DragOverlay adjustScale={true} modifiers={[restrictToWindowEdges]}>
                {activeId ? (
                  <div className="opacity-80 scale-105 shadow-2xl">
                    <PhotoCard 
                      photo={photos.find(p => p.id === activeId)!} 
                      isSelected={selectedIds.has(activeId)}
                      onToggleSelect={() => {}}
                      onEdit={() => {}}
                      onDuplicate={() => {}}
                      onGenerate={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
              </DndContext>
              
              {/* Infinite Scroll Target */}
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center mt-12 mb-8 py-4">
                  {isFetchingMore ? (
                    <div className="flex items-center gap-3 text-zinc-500 font-mono text-sm">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      CARREGANDO MAIS...
                    </div>
                  ) : (
                    <Button 
                      variant="secondary" 
                      onClick={loadMore} 
                      icon={<ChevronDown size={20} />}
                      className="px-12 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-mono tracking-widest text-xs"
                    >
                      CARREGAR MAIS
                    </Button>
                  )}
                </div>
              )}
              </>
            )}
          </div>
        )}

        {currentTab === 'database' && (
          <div className="max-w-full mx-auto py-6">
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
              <div className="border-b border-white/5 px-8 py-6 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-3 font-mono tracking-wide">
                  <LayoutGrid size={20} className="text-primary"/>
                  VISUALIZAÇÃO DO BANCO DE DADOS (SUPABASE)
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Banco de Dados</span>
                    <span className="text-xs text-zinc-400 font-mono uppercase">{totalPhotosCount} registros totais</span>
                  </div>
                  
                  <button 
                    onClick={handleOptimizeDatabase} 
                    disabled={optimizationStatus.isOptimizing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold uppercase tracking-wider border border-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Comprimir imagens antigas para reduzir tamanho"
                  >
                    <Zap size={14} className={optimizationStatus.isOptimizing ? 'animate-pulse' : ''} />
                    {optimizationStatus.isOptimizing ? 'Otimizando...' : 'Otimizar Banco'}
                  </button>

                  <button onClick={loadData} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-primary transition-all">
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              
              {/* Optimization Progress Bar */}
              {optimizationStatus.isOptimizing && (
                <div className="px-8 py-4 bg-primary/5 border-b border-primary/10">
                  <div className="flex justify-between text-xs font-mono text-primary mb-2 uppercase tracking-widest">
                    <span>{optimizationStatus.status}</span>
                    <span>{Math.round((optimizationStatus.current / (optimizationStatus.total || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${(optimizationStatus.current / (optimizationStatus.total || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Imagem</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Título</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Entidade</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ambiente</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ordem</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {photos.map(photo => (
                      <tr key={photo.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{photo.id.substring(0, 8)}...</td>
                        <td className="px-6 py-4">
                          <img src={photo.imageUrl} alt="" className="w-12 h-12 object-cover rounded border border-white/10" />
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-300">{photo.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-zinc-900 rounded text-[10px] font-bold text-primary uppercase">{photo.personType}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-zinc-900 rounded text-[10px] font-bold text-zinc-400 uppercase">{photo.environment}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-400">{photo.displayOrder ?? '-'}</td>
                        <td className="px-6 py-4 text-xs text-zinc-500">{new Date(photo.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Database View Pagination */}
              {hasMore && (
                <div className="flex justify-center py-6 border-t border-white/5 bg-white/5">
                  <Button 
                    variant="secondary" 
                    onClick={loadMore} 
                    isLoading={isFetchingMore}
                    icon={<ChevronDown size={16} />}
                    className="px-8 py-3 rounded-xl border border-white/10 bg-black/40 hover:bg-black/60 transition-all font-mono tracking-widest text-xs"
                  >
                    {isFetchingMore ? 'CARREGANDO...' : 'CARREGAR MAIS REGISTROS'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: EDITOR */}
        {currentTab === 'editor' && (
          // ... existing editor content ...
          <div className="max-w-4xl mx-auto py-6">
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden relative">
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-primary/30 rounded-tl-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-primary/30 rounded-br-2xl pointer-events-none"></div>

              <div className="border-b border-white/5 px-8 py-6 flex justify-between items-center bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-3 font-mono tracking-wide">
                  {isSaveSuccess ? <Check size={20} className="text-primary"/> : (editingPhoto.id ? <Edit2 size={20} className="text-primary"/> : <PlusCircle size={20} className="text-primary"/>)}
                  {isSaveSuccess ? 'CADASTRO CONCLUÍDO' : (editingPhoto.id ? 'EDITAR DADOS' : 'NOVA ENTRADA')}
                </h2>
                <button onClick={() => setCurrentTab('gallery')} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest">
                  Cancelar
                </button>
              </div>

              {isSaveSuccess ? (
                <div className="p-12 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border border-primary/50 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                    <Check size={48} className="text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white font-mono uppercase tracking-tight">Registro Salvo com Sucesso!</h3>
                    <p className="text-zinc-400 max-w-md mx-auto">
                      O registro foi armazenado no banco de dados e já está disponível na galeria.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button 
                      variant="secondary" 
                      onClick={() => setCurrentTab('gallery')}
                      icon={<LayoutGrid size={20} />}
                      className="px-8 py-4"
                    >
                      VER GALERIA
                    </Button>
                    <Button 
                      onClick={() => {
                        resetForm();
                        setIsSaveSuccess(false);
                      }}
                      icon={<PlusCircle size={20} />}
                      className="px-8 py-4"
                    >
                      CADASTRAR NOVO
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSave} className="p-8 space-y-8">
                {/* Image Upload Area */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">Arquivo de Imagem</label>
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = Array.from(e.dataTransfer.files) as File[];
                      const imageFile = files.find(f => f.type.startsWith('image/'));
                      if (imageFile) {
                        await processImageFile(imageFile);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 group ${editingPhoto.imageUrl ? 'border-zinc-700 bg-black/50' : 'border-zinc-800 hover:border-primary/50 hover:bg-primary/5'}`}
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    />
                    
                    {editingPhoto.imageUrl ? (
                      <div className="relative aspect-video max-h-[400px] mx-auto rounded-lg overflow-hidden shadow-2xl border border-white/10">
                        <img src={editingPhoto.imageUrl} alt="Preview" className="w-full h-full object-contain bg-black" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="text-white font-medium flex items-center gap-2 bg-black/80 px-4 py-2 rounded border border-primary/50 backdrop-blur-md text-sm uppercase tracking-wide">
                                <Upload size={16} /> Substituir
                            </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8">
                        <div className="w-16 h-16 bg-zinc-900/50 text-zinc-600 rounded-xl flex items-center justify-center mb-4 border border-zinc-800 group-hover:border-primary/50 group-hover:text-primary transition-all shadow-inner">
                          <Upload size={32} />
                        </div>
                        <p className="text-lg font-medium text-zinc-300">Arraste ou clique</p>
                        <p className="text-xs text-zinc-600 mt-2 uppercase tracking-widest">PNG, JPG • MAX 10MB</p>
                      </div>
                    )}
                    {isAnalyzingAI && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 rounded-xl border border-primary/20">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                          <RefreshCw size={40} className="animate-spin text-primary relative z-10" />
                        </div>
                        <p className="text-white text-lg font-medium mt-6 font-mono animate-pulse">PROCESSANDO DADOS...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title Text */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest">Título do Registro</label>
                  <input
                    required
                    type="text"
                    value={editingPhoto.title || ''}
                    onChange={e => setEditingPhoto(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-5 py-4 bg-black/50 border border-zinc-800 rounded-lg text-zinc-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono text-sm"
                    placeholder="IDENTIFICADOR..."
                  />
                </div>

                {/* Prompt Text */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest">Prompt de Comando</label>
                  <textarea
                    required
                    value={editingPhoto.prompt || ''}
                    onChange={e => setEditingPhoto(prev => ({ ...prev, prompt: e.target.value }))}
                    className="w-full h-40 px-5 py-4 bg-black/50 border border-zinc-800 rounded-lg text-zinc-300 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-none font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700"
                    placeholder="INSERIR DADOS DO PROMPT..."
                  />
                </div>

                {/* Classifications Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormSelect 
                    label="Tipo de Entidade"
                    value={editingPhoto.personType || PERSON_TYPES[0]}
                    options={PERSON_TYPES}
                    onChange={v => setEditingPhoto(prev => ({ ...prev, personType: v }))}
                  />
                  <FormSelect 
                    label="Ambiente"
                    value={editingPhoto.environment || ENVIRONMENTS[0]}
                    options={ENVIRONMENTS}
                    onChange={v => setEditingPhoto(prev => ({ ...prev, environment: v }))}
                  />
                  <MultiSelect 
                    label="Estilo Visual"
                    value={Array.isArray(editingPhoto.style) ? editingPhoto.style : [editingPhoto.style || 'Nenhum']}
                    options={STYLES}
                    onChange={v => setEditingPhoto(prev => ({ ...prev, style: v }))}
                  />
                </div>

                {/* Actions */}
                <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                   {editingPhoto.id && (
                     <button 
                        type="button" 
                        className="text-red-500 hover:text-red-400 text-xs uppercase tracking-widest hover:underline flex items-center gap-2 px-3 py-2 rounded hover:bg-red-950/30 transition-colors"
                        onClick={async () => {
                            if(window.confirm('CONFIRMAR EXCLUSÃO?')) {
                                await db.deletePhotos([editingPhoto.id!]);
                                setPhotos(prev => prev.filter(p => p.id !== editingPhoto.id));
                                setCurrentTab('gallery');
                                addToast('REGISTRO EXCLUÍDO', 'success');
                            }
                        }}
                     >
                        <Trash2 size={14} /> Excluir
                     </button>
                   )}
                   <div className="flex gap-4 ml-auto">
                     <Button type="button" variant="secondary" onClick={() => setCurrentTab('gallery')}>
                       CANCELAR
                     </Button>
                     <Button type="submit" isLoading={isSaving} icon={<Save size={18} />}>
                       SALVAR DADOS
                     </Button>
                   </div>
                </div>
              </form>
              )}
            </div>
          </div>
        )}

        {/* VIEW: GENERATOR */}
        {currentTab === 'generator' && (
          <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4 font-mono tracking-tight">ESCOLHA O MODO DE GERAÇÃO</h2>
              <p className="text-zinc-400">Selecione o agente ideal para sua necessidade atual</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card Low Quality */}
              <button 
                onClick={() => openGenerationModal('low')}
                className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 text-left transition-all duration-500 hover:border-primary/30 hover:bg-zinc-900 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,197,94,0.1)]"
              >
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <RefreshCw size={24} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-mono uppercase">Fotos Teste</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                  Ideal para testes rápidos de pose e enquadramento. Resolução média e processamento veloz.
                </p>
                <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase">
                  Selecionar <ChevronDown size={14} className="-rotate-90" />
                </div>
              </button>

              {/* Card High Quality 2K */}
              <button 
                onClick={() => openGenerationModal('high2k')}
                className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 text-left transition-all duration-500 hover:border-primary/30 hover:bg-zinc-900 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,197,94,0.1)]"
              >
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Aperture size={24} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-mono uppercase">Alta 2K</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                  Qualidade superior 2K. Equilíbrio perfeito entre detalhamento e performance.
                </p>
                <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase">
                  Selecionar <ChevronDown size={14} className="-rotate-90" />
                </div>
              </button>

              {/* Card Ultra Quality 4K */}
              <button 
                onClick={() => openGenerationModal('ultra4k')}
                className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 text-left transition-all duration-500 hover:border-primary/30 hover:bg-zinc-900 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(34,197,94,0.1)]"
              >
                <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Zap size={24} className="text-zinc-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-mono uppercase">Ultra 4K</h3>
                <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                  Qualidade máxima 4K. Reconstrução biométrica completa e fotorrealismo extremo.
                </p>
                <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase">
                  Selecionar <ChevronDown size={14} className="-rotate-90" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* GENERATION MODAL (Chat Style) */}
        {isGenerationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={closeGenerationModal} />
            <div 
              className="bg-zinc-950 border border-white/10 w-full max-w-3xl h-[70vh] rounded-3xl overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col animate-in fade-in zoom-in-95 duration-300"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'generator')}
            >
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 relative">
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center">
                            <ImageIcon size={14} className="text-primary" />
                        </div>
                        <h2 className="text-sm font-bold text-white font-mono uppercase tracking-tight">
                        {generationMode === 'ultra4k' ? (
                          <>GERADOR <span className="text-primary">ULTRA (4K)</span></>
                        ) : generationMode === 'high2k' ? (
                          <>GERADOR <span className="text-primary">ALTA (2K)</span></>
                        ) : (
                          <>GERADOR <span className="text-primary">TESTE (BAIXA)</span></>
                        )}
                        </h2>
                    </div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Chat de Engenharia Generativa</p>
                </div>

                <div className="ml-auto z-10 flex items-center gap-2">
                    <button onClick={() => { setChatHistory([]); setGeneratorPhotos([]); setCustomPrompt(''); setGeneratedImage(null); }} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors" title="Limpar Histórico">
                      <Trash2 size={18} />
                    </button>
                    <button onClick={closeGenerationModal} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors">
                    <X size={20} />
                    </button>
                </div>
              </div>

              {/* Chat Area */}
              <div 
                className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800"
              >
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <div className="w-16 h-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
                      <ImageIcon size={32} className="text-zinc-600" />
                    </div>
                    <div>
                      <p className="text-white font-mono text-sm">INICIE A SESSÃO</p>
                      <p className="text-zinc-500 text-xs">Faça upload das fotos e envie o Prompt Mestre</p>
                    </div>
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'user' && (
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 text-zinc-200 text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                          {msg.text}
                          {msg.images && msg.images.length > 0 && (
                            <div className={`grid gap-2 mt-4 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {msg.images.map((img, i) => (
                                <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg group">
                                  <img 
                                    src={img} 
                                    alt={`Ref ${i}`} 
                                    className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${msg.images && msg.images.length === 1 ? 'max-h-[300px]' : 'aspect-square'}`} 
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.generatedImage && (
                        <div className="space-y-3">
                          <div className="relative rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_30px_rgba(34,197,94,0.1)] group bg-black aspect-square max-w-[400px]">
                            <img 
                              src={msg.generatedImage} 
                              alt="Generated" 
                              className="w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-105" 
                              onClick={() => setExpandedImage({
                                url: msg.generatedImage!,
                                prompt: chatHistory[idx - 1]?.text || '',
                                code: msg.photoCode
                              })}
                            />
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 pointer-events-none">
                              <div className="pointer-events-auto flex flex-col gap-2">
                              <Button onClick={() => {
                                const link = document.createElement('a');
                                link.href = msg.generatedImage!;
                                link.download = `ED - Foto ${msg.photoCode || Math.random().toString(36).substring(2, 6).toUpperCase()}.png`;
                                link.click();
                              }} size="sm" icon={<Download size={16} />}>
                                BAIXAR
                              </Button>
                              <Button onClick={async () => {
                                const prompt = chatHistory[idx - 1]?.text || '';
                                const data = {
                                  imageUrl: msg.generatedImage,
                                  prompt: prompt,
                                  title: 'Nova Geração AI',
                                  code: msg.photoCode
                                };
                                await savePendingAction('pending_registration', data);
                                window.open(window.location.origin + '?action=register', '_blank');
                                addToast('Abrindo cadastro em nova aba...', 'success');
                              }} size="sm" variant="primary" icon={<PlusCircle size={16} />}>
                                CADASTRAR
                              </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isGenerating && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-4">
                      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="text-xs text-zinc-400 font-mono animate-pulse uppercase tracking-widest">Sintetizando Imagem...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-6 bg-zinc-900/30 border-t border-white/5 space-y-4">
                {/* Image Previews */}
                {generatorPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                    {generatorPhotos.map((photo, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0 group">
                        <img src={photo} alt="Upload" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setGeneratorPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-4 items-center w-full max-w-2xl mx-auto">
                  {/* Line 1: Text Area */}
                  <div className="relative w-full">
                    <textarea 
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'generator')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                          e.preventDefault();
                          handleGenerateImage();
                        }
                      }}
                      placeholder="Descreva a foto ou peça uma correção..."
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm max-h-32 min-h-[80px] text-center placeholder:text-center"
                      rows={3}
                    />
                    <div className="absolute right-3 bottom-3 flex items-center gap-2">
                      <div className="relative">
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          onChange={handleGeneratorUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <button className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-colors">
                          <Upload size={20} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Line 2: Aspect Ratio Selector */}
                  <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 pb-2">
                      {[
                        { ratio: '1:1', icon: <Square size={16} /> },
                        { ratio: '4:5', icon: <RectangleVertical size={16} className="scale-[0.9]" /> },
                        { ratio: '5:4', icon: <RectangleHorizontal size={16} className="scale-[0.9]" /> },
                        { ratio: '3:4', icon: <RectangleVertical size={16} /> },
                        { ratio: '4:3', icon: <RectangleHorizontal size={16} /> },
                        { ratio: '9:16', icon: <Smartphone size={16} /> },
                        { ratio: '16:9', icon: <Monitor size={16} /> }
                      ].map(({ ratio, icon }) => (
                          <button
                              key={ratio}
                              onClick={() => setAspectRatio(ratio)}
                              className={`px-3 py-2 text-xs font-mono rounded transition-colors flex items-center gap-2 whitespace-nowrap ${aspectRatio === ratio ? 'bg-primary text-black font-bold' : 'text-zinc-500 hover:text-white'}`}
                              title={ratio}
                          >
                              {icon}
                              <span>{ratio}</span>
                          </button>
                      ))}
                  </div>

                  {/* Line 3: Generate Button */}
                  <button 
                      onClick={handleGenerateImage}
                      disabled={isGenerating || (!customPrompt.trim() && generatorPhotos.length === 0)}
                      className="w-full max-w-sm px-6 py-3 bg-primary text-black rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-[0_10px_20px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                  >
                      {isGenerating ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                      Gerar Imagem
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULT MODAL (Floating Balloon) */}
        {isResultModalOpen && generatedImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsResultModalOpen(false)} />
            <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden relative shadow-[0_0_80px_rgba(0,0,0,1)] animate-in zoom-in-90 duration-300">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-800/50">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-widest">Resultado Final</h3>
                <button onClick={() => setIsResultModalOpen(false)} className="p-1.5 hover:bg-white/5 rounded-full text-zinc-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="relative rounded-2xl overflow-hidden border border-white/5 aspect-square bg-black">
                  <img src={generatedImage} alt="Generated Result" className="w-full h-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleDownloadGenerated} icon={<Download size={20} />} className="w-full">
                    BAIXAR
                  </Button>
                  <Button variant="secondary" onClick={() => setIsResultModalOpen(false)} className="w-full">
                    FECHAR
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: PROMPT GENERATOR */}
        {currentTab === 'prompt-generator' && (
          <div 
            className="max-w-3xl mx-auto h-[70vh] flex flex-col bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-700"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'prompt-generator')}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 relative">
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                  <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center">
                          <Edit2 size={14} className="text-primary" />
                      </div>
                      <h2 className="text-sm font-bold text-white font-mono uppercase tracking-tight">GERADOR DE PROMPT MESTRE</h2>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Engenharia Reversa de Imagem</p>
              </div>
              <div className="ml-auto z-10 flex items-center gap-2">
                  <button onClick={() => { setPromptChatHistory([]); setPromptGenPhotos([]); setPromptGenRequest(''); setGeneratedMasterPrompt(''); }} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors" title="Limpar Histórico">
                    <Trash2 size={18} />
                  </button>
              </div>
            </div>

            {/* Chat Area */}
            <div 
              className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800"
            >
              {promptChatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="w-16 h-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
                    <Upload size={32} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm uppercase">Arraste as fotos aqui</p>
                    <p className="text-zinc-500 text-xs">Ou use o botão de upload para iniciar a análise</p>
                  </div>
                </div>
              )}

              {promptChatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' && (
                      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 text-zinc-200 text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                        {msg.text}
                        {msg.images && msg.images.length > 0 && (
                          <div className={`grid gap-2 mt-4 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {msg.images.map((img, i) => (
                              <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg group">
                                <img 
                                  src={img} 
                                  alt={`Ref ${i}`} 
                                  className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${msg.images && msg.images.length === 1 ? 'max-h-[300px]' : 'aspect-square'}`} 
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.generatedPrompt && (
                      <div className="bg-zinc-800/50 border border-primary/20 rounded-2xl p-6 space-y-4 shadow-[0_0_30px_rgba(34,197,94,0.05)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Prompt Mestre Gerado</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleCopyToClipboard(msg.generatedPrompt!)}
                              className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-primary transition-colors"
                              title="Copiar Prompt"
                            >
                              <Copy size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setCustomPrompt(msg.generatedPrompt!);
                                setCurrentTab('generator');
                                addToast('Prompt enviado para o Gerador!', 'success');
                              }}
                              className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-primary transition-colors"
                              title="Usar no Gerador"
                            >
                              <Zap size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="text-zinc-300 text-xs font-mono leading-relaxed max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
                          {msg.generatedPrompt}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/5 h-8"
                                onClick={async () => {
                                    const data = {
                                        mode: 'low',
                                        prompt: msg.generatedPrompt,
                                        images: []
                                    };
                                    await savePendingAction('pending_generation', data);
                                    window.open(window.location.origin + '?action=generate', '_blank');
                                }}
                            >
                                Gerar Baixa
                            </Button>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/5 h-8"
                                onClick={async () => {
                                    const data = {
                                        mode: 'high2k',
                                        prompt: msg.generatedPrompt,
                                        images: []
                                    };
                                    await savePendingAction('pending_generation', data);
                                    window.open(window.location.origin + '?action=generate', '_blank');
                                }}
                            >
                                Gerar 2K
                            </Button>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/5 h-8"
                                onClick={async () => {
                                    const data = {
                                        mode: 'ultra4k',
                                        prompt: msg.generatedPrompt,
                                        images: []
                                    };
                                    await savePendingAction('pending_generation', data);
                                    window.open(window.location.origin + '?action=generate', '_blank');
                                }}
                            >
                                Gerar 4K
                            </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isGeneratingPrompt && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-4">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs text-zinc-400 font-mono animate-pulse uppercase tracking-widest">Analisando Engenharia Reversa...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-zinc-900/30 border-t border-white/5 space-y-4">
              {/* Image Previews */}
              {promptGenPhotos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                  {promptGenPhotos.map((photo, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0 group">
                      <img src={photo} alt="Upload" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setPromptGenPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-4 items-center w-full max-w-2xl mx-auto">
                <div className="relative w-full">
                  <textarea 
                    value={promptGenRequest}
                    onChange={(e) => setPromptGenRequest(e.target.value)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'prompt-generator')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isGeneratingPrompt) {
                        e.preventDefault();
                        handleGenerateMasterPrompt();
                      }
                    }}
                    placeholder="Arraste fotos ou digite um pedido adicional..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm max-h-32 min-h-[80px] text-center placeholder:text-center"
                    rows={3}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <div className="relative">
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handlePromptGenUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <button className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-colors">
                        <Upload size={20} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleGenerateMasterPrompt}
                  disabled={isGeneratingPrompt || (!promptGenRequest.trim() && promptGenPhotos.length === 0)}
                  className="w-full max-w-sm px-6 py-3 bg-primary text-black rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-[0_10px_20px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                >
                  {isGeneratingPrompt ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  Gerar Prompt Mestre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: PHOTO CORRECTOR */}
        {currentTab === 'photo-corrector' && (
          <div 
            className="max-w-3xl mx-auto h-[70vh] flex flex-col bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-700"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'photo-corrector')}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 relative">
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                  <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center">
                          <ImageIcon size={14} className="text-primary" />
                      </div>
                      <h2 className="text-sm font-bold text-white font-mono uppercase tracking-tight">CORRETOR DE FOTOS</h2>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Restauração com Fidelidade Absoluta</p>
              </div>
              <div className="ml-auto z-10 flex items-center gap-2">
                  <button onClick={() => { setCorrectorHistory([]); setCorrectorImage(null); setCorrectorRequest(''); setCorrectedImage(null); }} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors" title="Limpar Histórico">
                    <Trash2 size={18} />
                  </button>
              </div>
            </div>

            {/* Chat/Result Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800">
              {correctorHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="w-16 h-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center">
                    <RefreshCw size={32} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-white font-mono text-sm uppercase">Pronto para Aprimorar</p>
                    <p className="text-zinc-500 text-xs">Arraste uma imagem ou faça upload para restauração</p>
                  </div>
                </div>
              )}

              {correctorHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' && (
                      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 text-zinc-200 text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                        {msg.text}
                        {msg.image && (
                          <div className="mt-4 relative rounded-xl overflow-hidden border border-white/10 shadow-lg group">
                            <img 
                              src={msg.image} 
                              alt="Original" 
                              className="w-full object-cover transition-transform duration-500 group-hover:scale-105 max-h-[300px]" 
                            />
                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[8px] font-bold text-white/50 uppercase tracking-widest">ORIGINAL</div>
                          </div>
                        )}
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.correctedImage && (
                      <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_30px_rgba(34,197,94,0.1)] group bg-black aspect-square max-w-[400px]">
                          <img 
                            src={msg.correctedImage} 
                            alt="Corrected" 
                            className="w-full h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-105" 
                            onClick={() => setExpandedImage({
                              url: msg.correctedImage!,
                              prompt: correctorHistory[idx - 1]?.text || 'Imagem Aprimorada',
                              code: msg.photoCode
                            })}
                          />
                          <div className="absolute top-2 left-2 px-2 py-1 bg-primary/80 backdrop-blur-md rounded text-[8px] font-bold text-black uppercase tracking-widest">ENHANCED</div>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 pointer-events-none">
                            <div className="pointer-events-auto flex flex-col gap-2">
                              <Button onClick={() => {
                                const link = document.createElement('a');
                                link.href = msg.correctedImage!;
                                link.download = `ED - Foto ${msg.photoCode || Math.random().toString(36).substring(2, 6).toUpperCase()}.png`;
                                link.click();
                              }} size="sm" icon={<Download size={16} />}>
                                BAIXAR
                              </Button>
                              <Button onClick={async () => {
                                const prompt = correctorHistory[idx - 1]?.text || 'Imagem Aprimorada';
                                const data = {
                                  imageUrl: msg.correctedImage,
                                  prompt: prompt,
                                  title: 'Nova Geração AI',
                                  code: msg.photoCode
                                };
                                await savePendingAction('pending_registration', data);
                                window.open(window.location.origin + '?action=register', '_blank');
                                addToast('Abrindo cadastro em nova aba...', 'success');
                              }} size="sm" variant="primary" icon={<PlusCircle size={16} />}>
                                CADASTRAR
                              </Button>
                            </div>
                          </div>
                        </div>
                        {msg.text && <p className="text-zinc-400 text-xs font-mono px-2">{msg.text}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isCorrecting && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-4">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-xs text-zinc-400 font-mono animate-pulse uppercase tracking-widest">Aprimorando Imagem...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-zinc-900/30 border-t border-white/5 space-y-4">
              {correctorImage && (
                <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-800 flex-shrink-0 group">
                    <img src={correctorImage} alt="Upload" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setCorrectorImage(null)}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 items-center w-full max-w-2xl mx-auto">
                {/* Line 1: Text Area */}
                <div className="relative w-full">
                  <textarea 
                    value={correctorRequest}
                    onChange={(e) => setCorrectorRequest(e.target.value)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'photo-corrector')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isCorrecting) {
                        e.preventDefault();
                        handleEnhanceImage();
                      }
                    }}
                    placeholder="Descreva o que deseja aprimorar (opcional)..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm max-h-32 min-h-[80px] text-center placeholder:text-center"
                    rows={3}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleCorrectorUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <button className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-colors">
                        <Upload size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Line 2: Size Selector */}
                <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-white/10">
                    {(['1K', '2K', '4K'] as const).map(size => (
                        <button
                            key={size}
                            onClick={() => setCorrectorSize(size)}
                            className={`px-4 py-2 text-xs font-mono rounded transition-colors ${correctorSize === size ? 'bg-primary text-black font-bold' : 'text-zinc-500 hover:text-white'}`}
                        >
                            {size}
                        </button>
                    ))}
                </div>

                {/* Line 3: Enhance Button */}
                <button 
                    onClick={handleEnhanceImage}
                    disabled={isCorrecting || !correctorImage}
                    className="w-full max-w-sm px-6 py-3 bg-primary text-black rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-[0_10px_20px_rgba(34,197,94,0.2)] flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                >
                    {isCorrecting ? <RefreshCw size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                    Aprimorar Foto
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Bar */}
      <FloatingActions
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onDownload={handleDownloadTxt}
        onEmail={() => setIsEmailModalOpen(true)}
      />

      {/* Modals */}
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSend={handleSendEmail}
        count={selectedIds.size}
      />

      {/* Full Screen Image Modal */}
      {expandedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setExpandedImage(null)}>
            <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                <img src={expandedImage.url} alt="Expanded" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10" />
                <div className="flex gap-4">
                     <Button onClick={() => {
                        const link = document.createElement('a');
                        link.href = expandedImage.url;
                        link.download = `ED - Foto ${expandedImage.code || Math.random().toString(36).substring(2, 6).toUpperCase()}.png`;
                        link.click();
                      }} icon={<Download size={20} />}>
                        BAIXAR
                      </Button>
                      <Button onClick={async () => {
                        const data = {
                          imageUrl: expandedImage.url,
                          prompt: expandedImage.prompt,
                          title: 'Nova Geração AI',
                          code: expandedImage.code
                        };
                        await savePendingAction('pending_registration', data);
                        window.open(window.location.origin + '?action=register', '_blank');
                        addToast('Abrindo cadastro em nova aba...', 'success');
                      }} variant="primary" icon={<PlusCircle size={20} />}>
                        CADASTRAR
                      </Button>
                </div>
                <button onClick={() => setExpandedImage(null)} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors">
                    <X size={32} />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

// Sub-components for cleaner App.tsx
const DroppableContainer = ({ id, children, personType, environment }: any) => {
  const { setNodeRef } = useDroppable({
    id,
    data: { 
      type: 'container',
      personType, 
      environment 
    }
  });
  return <div ref={setNodeRef}>{children}</div>;
};

const FormSelect: React.FC<{
  label: string;
  value: string | string[];
  options: string[];
  onChange: (val: string) => void;
}> = ({ label, value, options, onChange }) => {
  const scalarValue = Array.isArray(value) ? value[0] : value;
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
          <select
          className="w-full appearance-none bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all cursor-pointer hover:border-zinc-600"
          value={scalarValue || ''}
          onChange={(e) => onChange(e.target.value)}
          >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
      </div>
    </div>
  );
};

export default App;