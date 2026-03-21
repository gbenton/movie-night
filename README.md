# Movie Night

Movie Night is a mobile-first personal utility for answering a single question quickly: **what from my trusted movie lists can I stream right now?**

## What it does

- lets you select the streaming services you actually subscribe to
- imports ranked or unranked movie lists from plain text or canonical JSON
- remembers your imported lists and the last list you used with `localStorage`
- looks up availability through a JustWatch-backed server route
- hides unavailable titles by default, with a `Show all` toggle for the full list
- caches availability for 24 hours in the browser

## Local development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
npm run lint
npm run build
```

## Deployment

### Recommended: Vercel preview deployments

This app is a good fit for Vercel because it is a standard Next.js app and it depends on a server route for availability checks.

Recommended workflow:

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Let Vercel build the app with the default Next.js settings.
4. Use the unique preview deployment URL that Vercel creates for each push or pull request.

That gives a phone-friendly URL for testing without asking local collaborators to run development commands.

### Why not GitHub Pages?

GitHub Pages is intended for static site hosting, but this app currently relies on the server route in `app/api/availability/[movieId]/route.ts`.
Because the client fetches that route at runtime, the current architecture is not a good fit for a static-only host.

## JSON import shape

```json
{
  "listName": "Rewatchables Core",
  "items": [
    { "rank": 1, "title": "The Social Network", "year": 2010 }
  ]
}
```
