import { PhotoData } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import imageCompression from 'browser-image-compression';
import { getCachedPhotos, setCachedPhotos, clearPhotosCache } from './cacheService';

const LOCAL_STORAGE_KEY = 'local_photos_db';

// Helper to get local data
const getLocalPhotos = (): PhotoData[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

// Helper to save local data
const saveLocalPhotos = (photos: PhotoData[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(photos));
};

// Helper to convert DB row to PhotoData
const mapRowToPhoto = (row: any): PhotoData => {
  let env = row.environment;
  if (Array.isArray(env)) env = env[0] || 'Nenhum';
  if (typeof env === 'string') {
    env = env.trim().replace(/^["']|["']$/g, '');
    if (env.startsWith('[') && env.endsWith(']')) {
      try {
        const parsed = JSON.parse(env);
        if (Array.isArray(parsed)) env = parsed[0] || 'Nenhum';
      } catch (e) {
        env = env.replace(/[\[\]"']/g, '');
      }
    }
  }
  if (!env) env = 'Nenhum';

  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title || 'Sem título',
    prompt: row.prompt,
    personType: row.person_type || 'Nenhum',
    style: Array.isArray(row.style) ? row.style : (row.style ? [row.style] : []),
    environment: env,
    tags: row.tags || [],
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayOrder: row.display_order
  };
};

// Helper to convert PhotoData to DB row payload
const mapPhotoToRow = (photo: PhotoData) => {
  const style = Array.isArray(photo.style) ? photo.style : [photo.style || 'Nenhum'];
  const environment = Array.isArray(photo.environment) 
    ? (photo.environment[0] || 'Nenhum') 
    : (photo.environment || 'Nenhum');

  return {
    id: photo.id,
    image_url: photo.imageUrl,
    title: photo.title,
    prompt: photo.prompt,
    person_type: photo.personType,
    style: style,
    environment: environment,
    tags: Array.isArray(photo.tags) ? photo.tags : [],
    code: photo.code,
    display_order: photo.displayOrder,
    updated_at: new Date().toISOString()
  };
};

export const getPhotos = async (page: number = 0, pageSize: number = 30, forceRefresh: boolean = false): Promise<PhotoData[]> => {
  if (forceRefresh && page === 0) {
    await clearPhotosCache().catch(() => {});
  } else if (!forceRefresh) {
    try {
      const cached = await getCachedPhotos(page, pageSize);
      if (cached && cached.length > 0) return cached;
    } catch (e) {}
  }

  try {
    const response = await fetch(`/api/photos?page=${page}&pageSize=${pageSize}`);
    if (!response.ok) throw new Error('Falha ao buscar fotos no servidor');
    const data = await response.json();

    const result = data.map(mapRowToPhoto);
    if (result.length > 0) {
      await setCachedPhotos(page, pageSize, result).catch(() => {});
    }
    return result;
  } catch (error: any) {
    console.warn('Backend unavailable, switching to local storage:', error);
    // Fallback to local storage
    const localPhotos = getLocalPhotos();
    // Sort by createdAt desc (default)
    localPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const start = page * pageSize;
    const end = start + pageSize;
    return localPhotos.slice(start, end);
  }
};

export const getMaxDisplayOrder = async (environment: string, personType: string): Promise<number> => {
  try {
    const response = await fetch(`/api/photos/max-order?environment=${encodeURIComponent(environment)}&personType=${encodeURIComponent(personType)}`);
    if (!response.ok) throw new Error('Failed to fetch max order');
    const data = await response.json();
    return data.maxOrder;
  } catch (e) {
    // Fallback to local storage
    const localPhotos = getLocalPhotos();
    if (localPhotos.length === 0) return -1;
    return Math.max(...localPhotos.map(p => p.displayOrder || 0));
  }
};

export const savePhoto = async (photo: PhotoData): Promise<PhotoData> => {
  if (!photo.code) {
    photo.code = Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isNew = !photo.id || !uuidRegex.test(photo.id);

  if (isNew) {
    photo.id = crypto.randomUUID();
    
    // Get max order for new photo
    const env = Array.isArray(photo.environment) 
      ? (photo.environment[0] || 'Nenhum') 
      : (photo.environment || 'Nenhum');
    const person = photo.personType || 'Nenhum';
    
    const maxOrder = await getMaxDisplayOrder(env, person);
    photo.displayOrder = maxOrder + 1;
  }
  
  const payload = mapPhotoToRow(photo);
  
  try {
    const response = await fetch('/api/photos/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error('Falha ao salvar no servidor');
    const data = await response.json();
    
    await clearPhotosCache().catch(() => {});
    return mapRowToPhoto(data);
  } catch (error: any) {
    console.warn('Backend unavailable, saving to local storage:', error);
    
    const localPhotos = getLocalPhotos();
    const index = localPhotos.findIndex(p => p.id === photo.id);
    
    // Ensure displayOrder if new and not set
    if (!photo.displayOrder) {
       const maxOrder = localPhotos.reduce((max, p) => Math.max(max, p.displayOrder || 0), 0);
       photo.displayOrder = maxOrder + 1;
    }

    if (index >= 0) {
      localPhotos[index] = photo;
    } else {
      localPhotos.unshift(photo); // Add to beginning
    }
    saveLocalPhotos(localPhotos);
    return photo;
  }
};

export const deletePhotos = async (ids: string[]): Promise<void> => {
  try {
    const response = await fetch('/api/photos/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error('Falha ao deletar no servidor');
    await clearPhotosCache().catch(() => {});
  } catch (error: any) {
    console.warn('Backend unavailable, deleting from local storage:', error);
    const localPhotos = getLocalPhotos();
    const newPhotos = localPhotos.filter(p => !ids.includes(p.id));
    saveLocalPhotos(newPhotos);
  }
};

export const updatePhotosOrder = async (updates: { id: string, displayOrder: number, personType?: string, environment?: string }[]): Promise<void> => {
  const validUpdates = updates.filter(u => u.id && u.id.length > 10).map(u => {
    const payload: any = {
      id: u.id,
      display_order: u.displayOrder,
      updated_at: new Date().toISOString()
    };
    if (u.personType !== undefined) payload.person_type = u.personType;
    if (u.environment !== undefined) payload.environment = u.environment;
    return payload;
  });
  
  if (validUpdates.length === 0) return;

  try {
    const response = await fetch('/api/photos/update-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: validUpdates })
    });
    if (!response.ok) throw new Error('Falha ao atualizar ordem no servidor');
    await clearPhotosCache().catch(() => {});
  } catch (error: any) {
    console.warn('Backend unavailable, updating local storage:', error);
    
    const localPhotos = getLocalPhotos();
    let changed = false;
    
    updates.forEach(u => {
      const index = localPhotos.findIndex(p => p.id === u.id);
      if (index >= 0) {
        localPhotos[index].displayOrder = u.displayOrder;
        if (u.personType) localPhotos[index].personType = u.personType;
        if (u.environment) localPhotos[index].environment = u.environment;
        localPhotos[index].updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    
    if (changed) {
      saveLocalPhotos(localPhotos);
    }
  }
};

export const getTotalPhotosCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/photos/count');
    if (!response.ok) throw new Error('Failed to fetch count');
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.warn('Backend unavailable, counting local storage:', error);
    return getLocalPhotos().length;
  }
};

export const uploadImage = async (file: File): Promise<string> => {
  let fileToUpload = file;
  try {
    const options = {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/jpeg' as const,
      initialQuality: 0.6
    };
    fileToUpload = await imageCompression(file, options);
  } catch (error) {}

  const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

  // Convert to base64 for backend upload proxy
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(fileToUpload);
  });

  try {
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        base64Data,
        contentType: `image/${fileExt}`
      })
    });

    if (!response.ok) {
      console.log('Server upload failed (Offline Mode), falling back to Base64 storage');
      return `data:image/jpeg;base64,${base64Data}`;
    }
    
    const data = await response.json();
    return data.publicUrl;
  } catch (error: any) {
    console.log('Network error during upload (Offline Mode), falling back to Base64 storage');
    return `data:image/jpeg;base64,${base64Data}`;
  }
};

export const generateId = (): string => crypto.randomUUID();

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export const compressBase64Image = (base64Str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!base64Str.startsWith('data:')) img.crossOrigin = "anonymous";
    img.src = base64Str;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 700;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (e) { reject(e); }
    };
    img.onerror = (error) => reject(error);
  });
};

export const optimizeDatabaseImages = async (
  onProgress: (current: number, total: number, status: string) => void
): Promise<void> => {
  try {
    const response = await fetch('/api/photos/ids');
    if (!response.ok) throw new Error('Falha ao buscar IDs no servidor');
    const allIds = await response.json();

    if (!allIds || allIds.length === 0) return;

    const total = allIds.length;
    let processed = 0;

    for (const { id } of allIds) {
      processed++;
      try {
        onProgress(processed, total, `Carregando imagem ${processed}/${total}...`);
        const fetchRes = await fetch(`/api/photos/${id}`);
        if (!fetchRes.ok) continue;
        const photoData = await fetchRes.json();

        if (!photoData || !photoData.image_url) continue;

        const isBase64 = photoData.image_url.startsWith('data:');
        if (isBase64 && photoData.image_url.length < 150 * 1024) {
          onProgress(processed, total, `Pulando imagem ${processed}/${total} (já otimizada)...`);
          continue;
        }

        onProgress(processed, total, `Otimizando imagem ${processed}/${total}...`);
        await new Promise(r => setTimeout(r, 50));
        const compressed = await compressBase64Image(photoData.image_url);
        
        if (compressed.length < photoData.image_url.length * 0.9) {
          onProgress(processed, total, `Salvando imagem ${processed}/${total}...`);
          await fetch('/api/photos/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, image_url: compressed })
          });
        }
      } catch (err) {
        console.error(`Error processing photo ${id}:`, err);
      }
      onProgress(processed, total, `Concluído ${processed} de ${total}`);
    }
    await clearPhotosCache();
  } catch (error) {
    console.error('Optimization failed:', error);
    throw error;
  }
};

export const exportBackup = async (): Promise<void> => {
  const zip = new JSZip();
  const photos = await getPhotos();
  zip.file("metadata.json", JSON.stringify(photos, null, 2));
  const imgFolder = zip.folder("images");
  const promises = photos.map(async (photo) => {
    if (photo.imageUrl) {
      try {
        const response = await fetch(photo.imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          const fileName = photo.imageUrl.split('/').pop() || `image-${photo.id}.jpg`;
          imgFolder?.file(fileName, blob);
        }
      } catch (e) {}
    }
  });
  await Promise.all(promises);
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `backup-prompt-gallery-${new Date().toISOString().split('T')[0]}.zip`);
};

