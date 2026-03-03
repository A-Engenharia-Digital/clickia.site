export type PhotoCategory = 'Person' | 'Landscape' | 'Object' | 'Abstract';
export type PhotoStyle = 'Realistic' | 'Anime' | '3D Render' | 'Oil Painting' | 'Sketch';
export type PhotoPurpose = 'Social Media' | 'Marketing' | 'Internal' | 'Reference';
export type PhotoEnvironment = 'Indoor' | 'Outdoor' | 'Studio' | 'Space' | 'Underwater';

export interface PhotoData {
  id: string;
  imageUrl: string;
  title: string;
  prompt: string;
  personType: string; // e.g., "Man", "Woman", "Robot", "None"
  style: string[];
  environment: string;
  tags: string[];
  code?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  displayOrder?: number;
}

export interface FilterState {
  search: string;
  personType: string[];
  style: string[];
  environment: string[];
}

export type TabView = 'home' | 'gallery' | 'editor' | 'generator' | 'prompt-generator' | 'database' | 'photo-corrector';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}