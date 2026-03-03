-- Create a storage bucket named 'photos'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true);

-- Policy to allow public access to view files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
TO public 
USING ( bucket_id = 'photos' );

-- Policy to allow public access to upload files
-- WARNING: This allows anyone with your Anon Key to upload files.
CREATE POLICY "Public Upload" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK ( bucket_id = 'photos' );

-- Policy to allow public access to update files
CREATE POLICY "Public Update" 
ON storage.objects FOR UPDATE
TO public 
USING ( bucket_id = 'photos' );

-- Policy to allow public access to delete files
CREATE POLICY "Public Delete" 
ON storage.objects FOR DELETE
TO public 
USING ( bucket_id = 'photos' );
