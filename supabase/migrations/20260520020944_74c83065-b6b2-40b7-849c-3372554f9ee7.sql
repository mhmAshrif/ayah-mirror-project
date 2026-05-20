
-- reflections
CREATE TABLE public.reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  surah_id integer,
  ayah_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own reflections" ON public.reflections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "anyone can read public reflections" ON public.reflections FOR SELECT USING (is_public = true);
CREATE POLICY "users insert own reflections" ON public.reflections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own reflections" ON public.reflections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "users update own reflections" ON public.reflections FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_reflections_user_created ON public.reflections (user_id, created_at DESC);
CREATE INDEX idx_reflections_public_created ON public.reflections (created_at DESC) WHERE is_public = true;

-- bookmark collections
CREATE TABLE public.bookmark_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bookmark_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own collections" ON public.bookmark_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own collections" ON public.bookmark_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own collections" ON public.bookmark_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own collections" ON public.bookmark_collections FOR DELETE USING (auth.uid() = user_id);

-- extend bookmarks
ALTER TABLE public.spiritual_bookmarks
  ADD COLUMN collection_id uuid REFERENCES public.bookmark_collections(id) ON DELETE SET NULL,
  ADD COLUMN arabic text,
  ADD COLUMN translation text,
  ADD COLUMN translation_author text,
  ADD COLUMN surah_name text;
CREATE POLICY "users update own bookmarks" ON public.spiritual_bookmarks FOR UPDATE USING (auth.uid() = user_id);

-- user preferences
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  theme text NOT NULL DEFAULT 'oceanic',
  reciter_id integer NOT NULL DEFAULT 7,
  translation_id integer NOT NULL DEFAULT 131,
  life_stage text,
  default_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own prefs" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own prefs" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own prefs" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- milestones
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own milestones" ON public.milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own milestones" ON public.milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own milestones" ON public.milestones FOR DELETE USING (auth.uid() = user_id);
