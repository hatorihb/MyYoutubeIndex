-- Allow authenticated users to update videos (rating, category, etc.)
CREATE POLICY "Authenticated update videos" ON public.videos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
