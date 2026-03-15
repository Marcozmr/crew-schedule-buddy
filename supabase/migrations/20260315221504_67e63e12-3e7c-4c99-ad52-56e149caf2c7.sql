-- Create table to store imported roster PDF metadata
CREATE TABLE IF NOT EXISTS public.imported_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL DEFAULT 'CrewRosterReport.pdf',
  source_message_id text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_message_id)
);

ALTER TABLE public.imported_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own imported rosters"
ON public.imported_rosters
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imported rosters"
ON public.imported_rosters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported rosters"
ON public.imported_rosters
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported rosters"
ON public.imported_rosters
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_imported_rosters_updated_at
BEFORE UPDATE ON public.imported_rosters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Private bucket for roster PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('crew-rosters', 'crew-rosters', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies scoped by user folder: {user_id}/CrewRosterReport.pdf
CREATE POLICY "Users can view their own roster files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'crew-rosters'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own roster files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'crew-rosters'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own roster files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'crew-rosters'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own roster files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'crew-rosters'
  AND auth.uid()::text = (storage.foldername(name))[1]
);