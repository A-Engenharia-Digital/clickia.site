-- Create the photos table
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    person_type TEXT,
    style TEXT,
    environment TEXT,
    tags TEXT[] DEFAULT '{}',
    code TEXT,
    display_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public access (since we don't have auth implemented yet)
-- WARNING: This allows anyone with your Anon Key to read/write. 
-- For production, you should implement authentication.

CREATE POLICY "Allow public read access"
ON public.photos
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public insert access"
ON public.photos
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON public.photos
FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Allow public delete access"
ON public.photos
FOR DELETE
TO anon
USING (true);
