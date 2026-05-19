
CREATE TABLE public.emotion_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  emotion TEXT NOT NULL,
  user_raw_input TEXT,
  surah_id INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  context_message TEXT,
  prescription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emotion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own emotion logs" ON public.emotion_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own emotion logs" ON public.emotion_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own emotion logs" ON public.emotion_logs FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.spiritual_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  surah_id INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  context_message TEXT,
  prescription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, surah_id, ayah_number)
);
ALTER TABLE public.spiritual_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own bookmarks" ON public.spiritual_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own bookmarks" ON public.spiritual_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own bookmarks" ON public.spiritual_bookmarks FOR DELETE USING (auth.uid() = user_id);
