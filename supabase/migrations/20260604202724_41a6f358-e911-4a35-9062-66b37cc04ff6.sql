ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'free_talk',
  ADD COLUMN IF NOT EXISTS scenario text;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_mode_check CHECK (mode IN ('free_talk', 'guided'));