# Movie Night

Movie Night is a mobile-first personal utility for answering a single question quickly: **what from my trusted movie lists can I stream right now?**

## What it does

- lets you select the streaming services you actually subscribe to
- imports ranked or unranked movie lists from plain text or canonical JSON
- remembers your imported lists and the last list you used with `localStorage`
- looks up availability through a JustWatch-backed server route
- hides unavailable titles by default, with a `Show all` toggle for the full list
- caches availability for 24 hours in the browser

## Fastest way to test on a phone

If you are developing entirely in the cloud from a mobile phone, the easiest path is **GitHub + Vercel preview deployments**.

### Option A — Vercel preview deployment from your phone

1. Push the repo to GitHub.
2. Open the Vercel mobile site or app.
3. Import the GitHub repo as a new project.
4. Vercel should detect this as a Next.js app automatically.
5. After the first deploy finishes, open the preview URL directly on your phone.
6. First hit `https://<your-preview-url>/api/health` to confirm the deployment is live.
7. Then open the main app URL and test the import/filter flow.
8. Each new push can generate an updated preview deployment you can test immediately.

This repo includes a `vercel.json` file so Vercel uses `npm install` and `npm run build` explicitly. It also declares Node 22+ in `package.json` to match the local toolchain used here.

### Option B — cloud IDE + phone browser

If you prefer editing in a cloud IDE first, open the repo in a service like:

- GitHub Codespaces
- StackBlitz
- CodeSandbox
- Gitpod

Then run:

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Open the forwarded port URL on your phone and test there. You can also verify the server is responding by visiting `/api/health` on the forwarded URL.

## Quick mobile test checklist

After the site is live on your phone, verify:

1. `/api/health` returns JSON with `ok: true`.
2. The home screen loads without horizontal scrolling.
3. You can paste a plain-text list and save it.
4. You can paste canonical JSON and save it.
5. Toggling streaming services changes the visible results.
6. `Show all` reveals unavailable titles.
7. Refreshing the page keeps your selected services and imported lists.

## Local development

```bash
npm install
npm run dev
```

If you need the dev server reachable from a forwarded cloud port, use:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Testing

```bash
npm test
npm run build
```

## JSON import shape

```json
{
  "listName": "Rewatchables Core",
  "items": [
    { "rank": 1, "title": "The Social Network", "year": 2010 }
  ]
}
```
