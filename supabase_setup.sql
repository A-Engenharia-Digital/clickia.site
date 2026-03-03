-- 1. Create the photos table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT DEFAULT 'Sem título',
    image_url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    person_type TEXT,
    style TEXT[] DEFAULT '{}',
    environment TEXT DEFAULT 'Nenhum',
    tags TEXT[] DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for public access
DROP POLICY IF EXISTS "Public Select" ON public.photos;
CREATE POLICY "Public Select" ON public.photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert" ON public.photos;
CREATE POLICY "Public Insert" ON public.photos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update" ON public.photos;
CREATE POLICY "Public Update" ON public.photos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete" ON public.photos;
CREATE POLICY "Public Delete" ON public.photos FOR DELETE USING (true);

-- 4. Set up Storage for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Storage Select" ON storage.objects;
CREATE POLICY "Public Storage Select" ON storage.objects FOR SELECT USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Public Storage Insert" ON storage.objects;
CREATE POLICY "Public Storage Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');

DROP POLICY IF EXISTS "Public Storage Update" ON storage.objects;
CREATE POLICY "Public Storage Update" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Public Storage Delete" ON storage.objects;
CREATE POLICY "Public Storage Delete" ON storage.objects FOR DELETE USING (bucket_id = 'photos');
