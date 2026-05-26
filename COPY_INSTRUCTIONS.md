# Copy these files into your `site` repo (no git patch)

Use this if `git am` failed. Your `api/` folder may already exist — that is fine.

## 1. Clean up the failed patch

In Command Prompt:

```cmd
cd C:\Users\USER\site
git am --abort
```

## 2. Copy new folders from finance repo

After finance PR #1 is updated, download or copy from:

`posting/site-api-files/`

Into your local `C:\Users\USER\site\`:

| Copy from | Paste into |
|-----------|------------|
| `api/` | `C:\Users\USER\site\api\` (merge/overwrite) |
| `sql/marketing/24_...sql` | `C:\Users\USER\site\sql\marketing\` |
| `docs/MARKETPLACE_EXTENSION.md` | `C:\Users\USER\site\docs\` |
| `vercel.json` | Replace `C:\Users\USER\site\vercel.json` |

## 3. Install dependency

```cmd
cd C:\Users\USER\site
npm install --save-dev @vercel/node
```

## 4. Files you must edit by hand (see snippets in this folder)

- `.env.example` — add lines from `env-snippet.txt`
- `README.md` — add paragraph from `readme-snippet.txt`
- `src/data/inventory.ts` — replace with `src/data/inventory.ts` from this folder
- `src/pages/AdminInventoryPage.tsx` — replace with file from this folder
- `src/index.css` — append contents of `src/index.css.snippet`

## 5. Commit and push

```cmd
git add -A
git status
git commit -m "Add Marketplace Lister extension API"
git push -u origin cursor/site-extension-api-e890
```

Then open PR on https://github.com/pepit0/site
