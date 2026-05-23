# Deploying this app to Vercel

This project runs on **Lovable + Cloudflare Workers** inside the Lovable editor.
To make it deploy to **Vercel** from your GitHub fork without breaking the
Lovable preview, do NOT change the adapter inside Lovable. Instead, apply
the patch below **after** you've pushed to GitHub.

The patch swaps Lovable's Cloudflare-wrapped Vite config for a vanilla
TanStack Start + Vercel preset, and removes the Cloudflare-specific
`src/server.ts` SSR wrapper.

---

## 1. Push the project to GitHub

In Lovable, open **GitHub → Connect** and push to a new repo.

## 2. Clone locally and apply the patch

```bash
git clone <your-repo-url>
cd <your-repo>
git checkout -b vercel-deploy
```

### 2a. Replace `vite.config.ts`

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "vercel",
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  resolve: {
    alias: { "@": "/src" },
  },
});
```

### 2b. Update `package.json`

Remove these deps (Cloudflare-only):

```
"@cloudflare/vite-plugin"
"@lovable.dev/vite-tanstack-config"
```

Then:

```bash
npm install
```

### 2c. Delete Cloudflare-only files

```bash
rm wrangler.jsonc
rm src/server.ts
```

If your routes don't import `src/lib/error-page.ts` or `src/lib/error-capture.ts`
elsewhere, you can delete those too. (They were used only by `src/server.ts`.)

### 2d. Verify build locally

```bash
npm run build
```

You should see Vite emit `.vercel/output/` — that's the Vercel build output
the Vercel platform consumes natively.

## 3. Deploy to Vercel

1. Go to https://vercel.com/new and import your GitHub repo.
2. Framework preset: **Other** (Vercel auto-detects `.vercel/output`).
3. Build command: `npm run build`
4. Output directory: leave blank (Vercel reads `.vercel/output` automatically).
5. **Environment variables** — copy these from your Lovable `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (from Lovable → Cloud → Settings)
   - `LOVABLE_API_KEY` (from Lovable → Cloud → Settings) — needed by `/api/chat` and `/api/match-emotion`

6. Deploy.

All routes (`/explorer`, `/explorer/$surahId`, `/today`, `/login`, etc.) and
the API endpoints (`/api/chat`, `/api/match-emotion`) work out of the box —
TanStack Router's Vercel preset handles SSR + routing, so refreshes never
404.

---

## Why this isn't applied inside Lovable

Lovable's editor builds via `@lovable.dev/vite-tanstack-config` + the
Cloudflare plugin. Changing the adapter in-place breaks the live
`soul-verses.lovable.app` preview and the in-editor preview pane. Keeping
the swap on a `vercel-deploy` branch in your GitHub repo gives you both:

- Lovable preview keeps working (Cloudflare)
- Vercel deployment works for your hackathon submission

## Keeping it in sync

When you make changes in Lovable, they push to GitHub's `main` branch.
Rebase `vercel-deploy` on top of `main` periodically:

```bash
git checkout vercel-deploy
git rebase main
git push --force-with-lease
```

Vercel auto-redeploys on push.
