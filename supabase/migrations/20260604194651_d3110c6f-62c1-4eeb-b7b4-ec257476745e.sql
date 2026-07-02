
-- conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  detected_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations select own" ON public.conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conversations insert own" ON public.conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "conversations update own" ON public.conversations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "conversations delete own" ON public.conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX conversations_user_started_idx ON public.conversations (user_id, started_at DESC);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages select own" ON public.messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "messages insert own" ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages update own" ON public.messages FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages delete own" ON public.messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX messages_user_created_idx ON public.messages (user_id, created_at DESC);

-- corrections
CREATE TABLE public.corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('grammar','fluency','vocabulary')),
  original text NOT NULL,
  suggestion text NOT NULL,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrections TO authenticated;
GRANT ALL ON public.corrections TO service_role;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrections select own" ON public.corrections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "corrections insert own" ON public.corrections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "corrections update own" ON public.corrections FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "corrections delete own" ON public.corrections FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX corrections_message_idx ON public.corrections (message_id);

-- ai_usage_logs (metadata only; no transcript or reply text)
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('request','rate_limit_minute','rate_limit_day','malformed_response','timeout','gemini_error','validation_error')),
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_estimate_usd numeric(10,6),
  latency_ms integer,
  transcript_length integer,
  error_code text
);
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_logs select own" ON public.ai_usage_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX ai_usage_logs_user_created_idx ON public.ai_usage_logs (user_id, created_at DESC);
