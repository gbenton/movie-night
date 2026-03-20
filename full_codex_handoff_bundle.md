# Movie Availability Filter — Full Codex Handoff Bundle

This document is the single handoff file for a fresh Codex session.

It combines:
1. the product concept and decisions we made together
2. the builder-grade specification
3. the finalized import contract
4. the execution plan and task graph
5. a master implementation prompt

The goal is that a fresh coding agent can read this file and continue from exactly where we left off.

---

# 1. What This Product Is

Build a **personal, mobile-first web app** for a single user that answers one question extremely well:

> “What can I watch right now from lists I already trust?”

This product is inspired by the fact that there are many high-quality curated movie lists already in the world:
- The Rewatchables
- Big Picture / Letterboxd lists
- New York Times top movie lists
- director-specific or genre-specific favorites
- any other curated list the user trusts

The problem is not “finding lists.”  
The problem is not “finding movies in the abstract.”  
The problem is:

> taking trusted lists and filtering them by what is actually available to stream right now on the services the user subscribes to.

The product should eliminate endless scrolling across streaming services.

---

# 2. Product Philosophy

This section is important because it reflects the intentional product choices we made.

## Core framing
This is primarily:
- a **filter**
- then, later, maybe a lightweight **decision tool**

This is **not** primarily:
- a general recommendation engine
- a social app
- a Letterboxd replacement
- a watch-history app
- a discovery feed

## Mental model
The app sits **on top of trusted lists**.

The value is:
1. take a trusted source list
2. filter to titles the user can actually watch now
3. present those options quickly
4. let the user leave the app and start watching

## Key principles
- **Speed > richness**
- **Accuracy > cleverness**
- **Actionable by default**
- **No dead ends**
- **Minimal cognitive load**
- **Build for one user first**
- **Do not overbuild**

## Product hierarchy
1. **Filter** = v1 core
2. **Decision assist** = maybe later, but not now

That means the app should not try to be smart before it is useful.

---

# 3. Who It Is For

For now, this product is for **one person**: the user who asked for it.

That means:
- no auth required
- no multi-user edge cases
- no generalized onboarding complexity
- no cloud sync required for v1
- optimize for ease and speed of building and using the first version

This is effectively a **personal utility tool** that may become a broader product later.

---

# 4. Platform Decision

## Chosen platform
- **Mobile-first web app**
- **Next.js + React + TypeScript**

## Why
The dominant usage context is:
- on a phone
- on a couch
- wanting something to watch right now

Native mobile is not required for v1.  
Mobile web is sufficient.

The implementation should still feel:
- fast
- thumb-friendly
- uncluttered
- easy to use in under 10 seconds

## Important nuance
Even though the stack is Next.js, the product should be built with a **small tool mindset**, not a “startup platform” mindset.

That means:
- minimal routes
- minimal state complexity
- no database
- no auth
- no unnecessary abstractions

---

# 5. Core User Problem

The user already has access to good movie ideas from lists they trust.

The pain point is:
- they know there are movies they want to watch
- they know there are lists they trust
- but figuring out **what is actually streamable right now** is annoying
- so they end up scrolling through streaming services instead of deciding

The app solves that by compressing the decision into a quick flow:
- choose list
- see what’s available
- pick
- leave app

---

# 6. Core UX Goal

Success means:

> the user can open the app and pick a movie to watch in under 10 seconds.

This should be the benchmark for product and implementation decisions.

If a feature slows that loop down, it should probably be deferred.

---

# 7. Final v1 Scope

## In scope
- single-user personal tool
- mobile-first web app
- manual service selection
- manual list import
- plain text import
- JSON import
- ranked and unranked list support
- JustWatch-based availability lookup
- show only available titles by default
- “show all” toggle
- persist data in localStorage
- open to last-used list

## Explicitly out of scope
- auth
- database
- sync across devices
- ratings
- watched history
- likes / favorites
- recommendations
- social features
- sharing
- URL import in v1
- native mobile
- generalized multi-user infrastructure

---

# 8. Detailed Product Decisions We Landed On

This section captures the important decisions from the conversation.

## 8.1 Primary use case
The primary use case is:

> “I want to watch something now.”

Planning and collecting lists over time is allowed, but the main moment is a real-time decision moment.

## 8.2 Output shape
The user wants:

> “Show me every movie from my imported list(s) that is streamable on my services right now.”

Not:
- one recommendation
- top 3 only
- a shuffle button
- an LLM choosing for them

Those are all deferred.

## 8.3 List structure
The product should support **multiple lists**.

Examples:
- Rewatchables
- NYT top 100
- top Spielberg movies
- other personal or editorial lists

At decision time:
- both a unified cross-list view and single-list view are imaginable
- but **single-list view is the default**
- cross-list views are optional/later

## 8.4 Default experience
On app open, the default should be:

> immediately show “available now” titles from the **last-used list**

This avoids the extra navigation step of seeing a home dashboard first.

## 8.5 Movie card density
For v1, each movie row/card only really needs:
- **title**
- **streaming service badge**

Poster/artwork is a nice-to-have but not essential.

This product should feel like a **utility**, not a browsing magazine.

## 8.6 What happens on tap
Best case:
- deep link directly into the streaming provider or JustWatch

But if that is difficult:
- opening a JustWatch URL or equivalent is fine

The important thing is that the app remains fast and accurate.

## 8.7 Service selection
The user is fine with:
- **manual service selection only**

That means a simple checkbox or multi-select flow is enough.

No need to infer services automatically.

## 8.8 What to do with unavailable titles
Unavailable titles should be:
- **hidden by default**
- accessible via a **Show all** toggle

The app should not force empty dead-end experiences if availability is the primary lens.

## 8.9 Freshness expectations
Ideal freshness is:
- hybrid cache + refresh

But for MVP:
- daily-ish caching is acceptable

Consistency and usefulness are more important than perfect real-time freshness.

## 8.10 Statefulness
For v1:
- **no watched tracking**
- **no likes**
- **no history**
- **no ratings**

The product is a pure utility.

## 8.11 Data persistence
For v1, the easiest solution is best:
- **browser localStorage only**

No backend or DB needed.

## 8.12 Import philosophy
For v1:
- manual import is enough
- a clean contract for **LLM-generated imports** is important
- the user wants to be able to ask an LLM to parse a list into a format the app can ingest

## 8.13 Ranked vs unranked support
This was an explicit modification:
- some lists are ranked
- some are not
- ranking should be **optional**, not required

The product should preserve ranking when present and preserve source order when not.

## 8.14 JustWatch integration stance
The chosen stance for v1 is:

> “Hacky but fast.”

That means:
- unofficial API / scrape / lightweight integration is acceptable
- correctness and speed of building matter more than purity

---

# 9. Core User Flows

## Flow A — First-time use
1. User opens app.
2. User selects streaming services.
3. User imports a list via plain text or JSON.
4. App parses input and saves the list.
5. App resolves availability.
6. App shows only titles available on the selected services.

## Flow B — Repeat use
1. User opens app.
2. App loads last-used list.
3. App shows only available titles from that list.
4. User taps a title.
5. App opens JustWatch or provider URL.

## Flow C — Switch list
1. User switches to another imported list.
2. App sets that as current and last-used.
3. App filters by selected services.

## Flow D — Reveal unavailable titles
1. User turns on Show all.
2. App shows unavailable titles as well.
3. Unavailable titles are visually distinct.
4. Source ordering remains intact.

---

# 10. Stack and Architecture

## Stack
- Next.js
- React
- TypeScript

## Storage
- localStorage only

## Architecture principle
Even though this is a small tool, isolate key concerns:
- UI components
- storage repository
- import parsing
- filtering logic
- availability integration
- cache freshness

That way the app can evolve later without being messy.

---

# 11. Canonical Data Model

Use this as the baseline model.

```ts
export type StreamingService =
  | "Netflix"
  | "Hulu"
  | "Prime Video"
  | "Max"
  | "Disney+"
  | "Apple TV+"
  | "Peacock"
  | "Paramount+"
  | "Criterion Channel"
  | "MUBI"
  | "Other";

export interface MovieItem {
  id: string;
  title: string;
  year?: number;
  rank?: number;
  originalLine?: string;
}

export interface MovieList {
  id: string;
  name: string;
  ranked: boolean;
  createdAt: string;
  updatedAt: string;
  movies: MovieItem[];
}

export interface AvailabilityResult {
  movieId: string;
  title: string;
  year?: number;
  services: StreamingService[];
  providerLinks?: Record<string, string>;
  justWatchUrl?: string;
  posterUrl?: string;
  lastCheckedAt: string;
  status: "available" | "unavailable" | "unknown";
  matchConfidence?: "high" | "medium" | "low";
}

export interface AppState {
  selectedServices: StreamingService[];
  lists: MovieList[];
  lastUsedListId?: string;
  availabilityByMovieKey: Record<string, AvailabilityResult>;
}
```

## Recommended cache key
```ts
const movieCacheKey = `${normalizedTitle}__${year ?? "unknown"}`
```

Where `normalizedTitle`:
- lowercase
- trim
- collapse whitespace
- remove obvious punctuation noise

---

# 12. localStorage Schema

Use localStorage for:
- selected services
- imported lists
- last-used list id
- availability cache

Recommended repository API:

```ts
getSelectedServices(): StreamingService[]
setSelectedServices(services: StreamingService[]): void

getLists(): MovieList[]
setLists(lists: MovieList[]): void

getLastUsedListId(): string | undefined
setLastUsedListId(id: string): void

getAvailabilityCache(): Record<string, AvailabilityResult>
setAvailabilityCache(cache: Record<string, AvailabilityResult>): void
```

Important requirements:
- safe defaults if storage is empty
- safe fallback if storage is malformed
- do not crash if JSON parsing fails

---

# 13. Final Import Contract

This is one of the most important sections of the whole handoff.

The app should support **two import modes**.

## 13.1 Plain text import
This is the easiest fallback mode and should work well for manual paste.

### Example — unranked
```text
The Social Network
Zodiac
Michael Clayton
Heat
```

### Example — ranked
```text
1. The Social Network (2010)
2. Zodiac (2007)
3. Michael Clayton (2007)
4. Heat (1995)
```

## Rules for plain text import
- One movie per line
- Ranking is optional
- Year is optional
- Preserve input order
- If numbering exists, store rank
- If no numbering exists, do not invent rank
- Trim whitespace
- Ignore empty lines
- Extract year if present in `(YYYY)` form at end
- Keep the title clean after removing numbering and year

## Suggested parsing algorithm
1. Split by newline
2. Trim each line
3. Drop empty lines
4. Detect rank prefix
5. Detect `(YYYY)` suffix
6. Remove those artifacts from the title
7. Create normalized movie items
8. Preserve original order

## Helpful regex hints
- rank prefix: `^\s*(\d+)[\).\-\s]+`
- year suffix: `\((\d{4})\)\s*$`

---

## 13.2 JSON import
This is the preferred format for LLM-generated imports.

### Canonical JSON format
```json
{
  "listName": "Rewatchables Core",
  "items": [
    { "rank": 1, "title": "The Social Network", "year": 2010 },
    { "rank": 2, "title": "Zodiac", "year": 2007 },
    { "rank": 3, "title": "Michael Clayton", "year": 2007 }
  ]
}
```

### JSON rules
- `listName` recommended
- `items` required
- every item must have `title`
- `rank` optional
- `year` optional
- infer `ranked = true` if any item has `rank`
- preserve item order

---

# 14. LLM Prompt Template for Building Imports

Use this prompt when asking an LLM to convert an external source into importable JSON.

```text
Extract all movie titles from the following content and return valid JSON in exactly this format:

{
  "listName": "<name of the list>",
  "items": [
    { "rank": 1, "title": "Movie Title", "year": 2001 }
  ]
}

Rules:
- Include only films unless told otherwise
- Preserve ranking if present
- If no ranking exists, omit the "rank" field
- Include release year when known
- If unsure about year, omit it
- Remove commentary, numbering artifacts, and extra prose
- Output valid JSON only

Content:
<PASTE SOURCE HERE>
```

This prompt matters because the user explicitly wants to be able to use an LLM to transform external movie lists into a reliable import format.

---

# 15. Availability Strategy

## v1 strategy
Use a **hacky but fast JustWatch integration**.

That means:
- unofficial API is acceptable
- scraping or unofficial endpoints may be acceptable
- do not block the project on perfect API purity

## Matching priorities
Try:
1. title + year
2. title only

Use year when present to improve quality for duplicate titles.

## Desired availability output
For each movie, try to store:
- available services
- JustWatch URL
- provider links if possible
- poster URL if easy
- last checked timestamp
- simple match confidence or status

## Failure handling
If availability lookup fails:
- app should not crash
- mark the result as `unknown` or `unavailable`
- keep the rest of the UI usable

---

# 16. Cache Freshness Strategy

For v1, use a “fresh enough” caching policy.

## Recommended policy
- cache availability results in localStorage
- treat results as fresh for 24 hours
- reuse fresh cache when available
- if stale, refresh either:
  - on list view
  - or in the background

The point is to avoid re-fetching everything all the time while keeping the data reasonably current.

---

# 17. Filtering Logic

This is the heart of the product.

## Default behavior
Only show titles where:
- availability exists
- and the intersection of `movie.services` and `selectedServices` is non-empty

## Show all behavior
When Show all is enabled:
- reveal unavailable titles too
- visually distinguish them
- preserve source order
- do not reshuffle ranked order

## Important principle
Unavailable titles should be hidden by default because the core value is:

> show me what I can act on right now

---

# 18. UI and UX Requirements

## General
- mobile-first
- minimal
- fast
- uncluttered
- comfortable tap targets
- no unnecessary navigation

## Default screen
Open directly to:
- last-used list
- filtered available titles only

## Required UI elements
- service selector
- import panel
- list picker
- movie list
- show all toggle

## Movie row requirements
Primary:
- title
- service badge

Optional:
- poster/artwork
- JustWatch/provider link metadata

If the row is ranked:
- display rank subtly

If unranked:
- do not invent rank labels

## Tap behavior
Best case:
- direct provider link

Fallback:
- JustWatch URL

## App states to handle
- no services selected
- no lists imported
- importing
- loading availability
- parse error
- network error
- empty filtered result
- empty full list

For empty filtered result, the UX should guide the user toward “Show all” rather than feeling broken.

---

# 19. Suggested Module / File Layout

A reasonable file structure:

```text
app/
  layout.tsx
  page.tsx
  globals.css

components/
  AppShell.tsx
  ServiceSelector.tsx
  ImportPanel.tsx
  ListPicker.tsx
  MovieListView.tsx
  MovieRow.tsx
  ShowAllToggle.tsx

lib/
  types.ts
  constants.ts
  normalize.ts
  storage.ts
  parseTextImport.ts
  parseJsonImport.ts
  filterMovies.ts

lib/availability/
  cache.ts
  justWatch.ts
  types.ts
  stub.ts
```

This does not have to be exact, but similar boundaries are recommended.

---

# 20. Execution Strategy

Do not start with the JustWatch integration.

The best sequencing is:

1. scaffold app
2. define types and constants
3. build localStorage repository
4. add service selector
5. build text import parser
6. build JSON import parser
7. build import UI
8. build list rendering and switching
9. add stub availability layer
10. add filtering and Show all
11. prove the full loop works
12. add JustWatch integration
13. add cache freshness logic
14. polish mobile UX
15. add tests and cleanup

This minimizes risk and lets the core UX be proven before the hardest technical dependency.

---

# 21. Agent-Ready Task Graph

There are 14 concrete implementation tasks.

---

## Task 1 — Scaffold app and base UI shell

### Goal
Create the Next.js app structure and a minimal mobile-first shell that all other features will plug into.

### Deliverables
- Next.js app initialized
- TypeScript configured
- base page shell
- global styles
- mobile-friendly layout

### Suggested outputs
- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `components/AppShell.tsx`

### Acceptance criteria
- app runs locally
- mobile viewport has no horizontal scrolling
- layout has placeholders for core app sections

### Test cases
- app boots without error
- layout is readable on phone-sized viewport

### Dependencies
- none

---

## Task 2 — Define types, constants, and data contracts

### Goal
Create a stable shared schema for the app.

### Deliverables
- shared TS types
- supported service constants
- normalization helper
- cache key helper

### Suggested outputs
- `lib/types.ts`
- `lib/constants.ts`
- `lib/normalize.ts`

### Acceptance criteria
- types imported centrally
- normalization deterministic
- cache key stable

### Test cases
- title normalization produces stable output
- cache key includes year when present

### Dependencies
- Task 1

---

## Task 3 — Build localStorage repository

### Goal
Hide raw localStorage access behind a repository API.

### Deliverables
- getters/setters for:
  - services
  - lists
  - lastUsedListId
  - availability cache
- safe defaults
- malformed JSON fallback

### Suggested outputs
- `lib/storage.ts`

### Acceptance criteria
- empty storage does not crash app
- malformed storage does not crash app
- reads/writes are consistent

### Test cases
- save and reload returns same values
- bad JSON gracefully falls back

### Dependencies
- Task 2

---

## Task 4 — Add service selection feature

### Goal
Let the user manually choose which streaming services they have.

### Deliverables
- checkbox or toggle UI
- save to localStorage
- persist across refresh

### Suggested outputs
- `components/ServiceSelector.tsx`

### Acceptance criteria
- services can be selected/deselected
- selection persists
- accessible on mobile

### Test cases
- select Netflix and Max, refresh, selection remains

### Dependencies
- Task 3

---

## Task 5 — Build plain text import parser

### Goal
Parse line-based movie lists with optional rank and year.

### Supported examples
Unranked:
```text
The Social Network
Zodiac
Michael Clayton
Heat
```

Ranked:
```text
1. The Social Network (2010)
2. Zodiac (2007)
3. Michael Clayton (2007)
4. Heat (1995)
```

### Deliverables
- pure text parsing function

### Suggested outputs
- `lib/parseTextImport.ts`

### Acceptance criteria
- rank parsed when present
- year parsed when present
- ordering preserved
- empty lines ignored

### Test cases
- `1. The Social Network (2010)` → title + year + rank
- `Heat` → title only
- `12) Jaws (1975)` → rank=12, year=1975

### Dependencies
- Task 2

---

## Task 6 — Build JSON import parser

### Goal
Parse and validate the structured JSON import format.

### Canonical JSON
```json
{
  "listName": "NYT Top Movies of the 21st Century",
  "items": [
    { "rank": 1, "title": "Mulholland Drive", "year": 2001 },
    { "rank": 2, "title": "There Will Be Blood", "year": 2007 }
  ]
}
```

### Deliverables
- parser + validation
- user-readable errors

### Suggested outputs
- `lib/parseJsonImport.ts`

### Acceptance criteria
- valid JSON imports
- invalid JSON gets readable error
- ranked inferred if any item has rank

### Test cases
- missing `items` is an error
- missing item `title` is an error
- valid unranked JSON imports correctly

### Dependencies
- Task 2

---

## Task 7 — Build import UX

### Goal
Create a single import flow that accepts plain text or JSON.

### UX requirements
- single textarea is fine
- auto-detect JSON if trimmed input starts with `{`
- plain text imports should allow manual list name
- JSON imports should default to `listName`
- inline parse errors
- save successful list and make it current

### Deliverables
- import form
- list creation flow
- success/error handling

### Suggested outputs
- `components/ImportPanel.tsx`

### Acceptance criteria
- both formats work via one box
- import affects main view immediately
- importing multiple lists preserves prior lists

### Test cases
- plain text + manual name imports
- JSON + listName imports
- malformed JSON shows readable error

### Dependencies
- Task 3
- Task 5
- Task 6

---

## Task 8 — Build list rendering and navigation

### Goal
Render imported lists and let the user switch between them.

### Deliverables
- list picker
- current list renderer
- movie rows
- rank display logic
- last-used list persistence

### Suggested outputs
- `components/ListPicker.tsx`
- `components/MovieListView.tsx`
- `components/MovieRow.tsx`

### Acceptance criteria
- multiple lists supported
- last-used list persists
- ranked lists show rank
- unranked lists preserve order without fake rank

### Test cases
- switch lists and refresh; selected list persists

### Dependencies
- Task 7

---

## Task 9 — Add filtering logic and Show all toggle

### Goal
Implement the product’s main behavior: actionable titles only by default.

### Deliverables
- filter helper
- Show all toggle
- styling for unavailable rows

### Suggested outputs
- `lib/filterMovies.ts`
- toggle UI inside list view

### Acceptance criteria
- available-only default works
- Show all reveals unavailable titles
- ordering is preserved

### Test cases
- service intersection logic works
- deselecting service updates visible rows
- unavailable items appear only when toggle is on

### Dependencies
- Task 4
- Task 8
- Task 10 or Task 11

---

## Task 10 — Add stub availability layer

### Goal
Prove the UX end-to-end before doing the real JustWatch integration.

### Deliverables
- deterministic fake availability provider
- integration into filter/render flow

### Suggested outputs
- `lib/availability/stub.ts`

### Acceptance criteria
- app works end-to-end with fake data
- switching to real layer later is isolated

### Test cases
- known movie returns stubbed service
- unknown movie returns unavailable

### Dependencies
- Task 8

---

## Task 11 — Add JustWatch integration layer

### Goal
Implement the hacky-but-fast real availability source.

### Deliverables
- isolated JustWatch module
- normalized results
- safe network failure handling

### Suggested outputs
- `lib/availability/justWatch.ts`
- `lib/availability/types.ts`

### Acceptance criteria
- meaningful subset of movies resolve
- failures degrade safely
- title + year improves matching quality

### Test cases
- exact title + year resolves
- title-only fallback works
- network failure does not crash app

### Dependencies
- Task 10

---

## Task 12 — Add cache freshness rules

### Goal
Reuse availability results for 24 hours before refresh.

### Deliverables
- freshness helper
- cached read/write logic
- stale detection

### Suggested outputs
- `lib/availability/cache.ts`

### Acceptance criteria
- recent data reused
- stale data refresh path exists
- app avoids unnecessary repeated fetches

### Test cases
- 2-hour-old cache = fresh
- 30-hour-old cache = stale
- no cache = fetch

### Dependencies
- Task 3
- Task 11

---

## Task 13 — Improve mobile UX and app states

### Goal
Make the app pleasant enough to use casually on a phone.

### Deliverables
- polish layout
- loading/error/empty states
- clear tap targets
- simple hierarchy

### Acceptance criteria
- comfortable on phone
- filtered empty state suggests Show all
- loading/error states are understandable

### Test cases
- no lists state shows clear import path
- all unavailable state doesn’t feel broken
- loading is visible

### Dependencies
- Task 12

---

## Task 14 — Add test coverage and final cleanup

### Goal
Stabilize the codebase and make it easy for another agent to extend.

### Priority test areas
- plain text parsing
- JSON parsing
- normalization
- filtering
- storage fallbacks
- cache freshness

### Deliverables
- tests for core logic
- concise README
- naming cleanup
- dead code removal

### Acceptance criteria
- important helpers tested
- module boundaries clear
- README makes app understandable quickly

### Suggested outputs
- `README.md`
- test files alongside `lib/*`

### Dependencies
- Task 13

---

# 22. Global Acceptance Checklist

The app is “done enough” for v1 if all of the following are true:

- [ ] user can select streaming services and selection persists
- [ ] user can import a plain text list
- [ ] user can import a JSON list
- [ ] ranked lists preserve rank
- [ ] unranked lists preserve order
- [ ] user can switch among multiple lists
- [ ] app remembers the last-used list
- [ ] default view hides unavailable titles
- [ ] Show all reveals unavailable titles
- [ ] at least one real JustWatch-backed lookup path works
- [ ] app does not crash on malformed storage or malformed imports
- [ ] mobile UI is usable on a phone
- [ ] parser and filter logic are tested

---

# 23. Copy/Paste Master Prompt for a Fresh Codex Session

Use this if starting from scratch.

```text
You are implementing a personal movie availability web app.

Build a mobile-first Next.js + React + TypeScript app with these requirements:

- Single-user personal tool
- Browser localStorage only
- No auth, no backend, no database
- User manually selects streaming services
- User imports movie lists via either:
  1) plain text, one movie per line, optionally ranked and optionally including year
  2) JSON in this format:
     {
       "listName": "Example List",
       "items": [
         { "rank": 1, "title": "Movie Title", "year": 2001 }
       ]
     }
- Preserve ranking when present
- Preserve source order when unranked
- Default home screen should show the last-used list
- Show only movies available on the user's selected services by default
- Include a “Show all” toggle to reveal unavailable titles
- Use a stubbed availability layer first if useful, then wire in a JustWatch-based integration
- Cache availability for 24 hours
- Keep the UI minimal, fast, and mobile-friendly
- Optimize for the user picking a movie in under 10 seconds

Also:
- isolate storage logic
- isolate availability logic
- include tests for parsing and filtering
- keep module boundaries clean and easy to extend later
```

---

# 24. Final Guidance to the Builder

If there is a tradeoff, choose:
- simpler over more general
- deterministic over clever
- shipping the core loop over polishing side features

The app wins if it quickly answers:

> “What from my trusted lists can I actually watch right now?”
