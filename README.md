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
