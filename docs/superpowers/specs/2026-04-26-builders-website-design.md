# Builders Website — Design Spec

**Date:** 2026-04-26
**Repo:** `shanli/builders`
**Status:** Approved

---

## Overview

A public Astro static website deployed on Vercel that displays a browsable historical archive of daily AI builders digests. Content is sourced from the public feed JSON files in `zarazhangrui/follow-builders`, fetched daily via GitHub Actions, and stored as dated snapshots in this repo.

---

## Architecture

```
shanli/builders/
├── history/                        # Daily feed snapshots
│   ├── 2026-04-26.json
│   └── ...
├── web/                            # Astro site
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro         # Archive list page
│   │   │   └── digest/
│   │   │       └── [date].astro    # Individual digest page
│   │   ├── layouts/
│   │   │   └── Layout.astro
│   │   └── components/
│   │       ├── DigestCard.astro    # Card on index page
│   │       ├── BuilderSection.astro
│   │       ├── PodcastSection.astro
│   │       └── BlogSection.astro
│   ├── astro.config.mjs
│   └── package.json
├── .github/
│   └── workflows/
│       └── fetch-and-snapshot.yml  # Daily feed fetch + snapshot
└── docs/
    └── superpowers/specs/
        └── 2026-04-26-builders-website-design.md
```

---

## Data Flow

1. **GitHub Actions** runs daily at 6am UTC
2. Fetches three public feed files from `zarazhangrui/follow-builders`:
   - `feed-x.json` — X/Twitter builder posts
   - `feed-podcasts.json` — Podcast episodes
   - `feed-blogs.json` — Blog posts
3. Merges into `history/YYYY-MM-DD.json` snapshot
4. Commits and pushes to `shanli/builders` main branch
5. **Vercel** detects the push, triggers Astro static build
6. New digest page is live within ~2 minutes

---

## Snapshot Format

`history/YYYY-MM-DD.json`:

```json
{
  "date": "2026-04-26",
  "x": [
    {
      "name": "Sam Altman",
      "handle": "sama",
      "bio": "...",
      "tweets": [
        {
          "id": "...",
          "text": "...",
          "url": "https://x.com/sama/status/...",
          "createdAt": "...",
          "likes": 0,
          "retweets": 0
        }
      ]
    }
  ],
  "podcasts": [
    {
      "name": "No Priors",
      "title": "Episode title",
      "url": "https://...",
      "publishedAt": "..."
    }
  ],
  "blogs": [
    {
      "name": "Anthropic Engineering",
      "title": "Article title",
      "url": "https://...",
      "content": "..."
    }
  ],
  "stats": {
    "xBuilders": 14,
    "podcastEpisodes": 1,
    "blogPosts": 1
  }
}
```

---

## Pages

### `/` — Archive List

- Title: "AI Builders Digest"
- Lists all dates in reverse chronological order
- Each entry shows: date, stats (N builders · N podcasts · N blogs)
- Clicking navigates to `/digest/YYYY-MM-DD`
- Reads all `history/*.json` files at build time via `Astro.glob()`

### `/digest/[date]` — Individual Digest

Sections in order:

1. **Header** — Date + stats summary
2. **X / Twitter** — Each builder who posted, with their tweets and URLs
3. **Official Blogs** — Blog post title, excerpt, link
4. **Podcasts** — Episode title, podcast name, link

Footer: previous / next digest navigation links.

---

## GitHub Actions Workflow

**File:** `.github/workflows/fetch-and-snapshot.yml`

**Trigger:** Daily at 6am UTC + manual `workflow_dispatch`

**Steps:**
1. Checkout repo
2. Fetch `feed-x.json`, `feed-podcasts.json`, `feed-blogs.json` from raw.githubusercontent.com/zarazhangrui/follow-builders/main/
3. Merge into `history/YYYY-MM-DD.json` using `scripts/create-snapshot.js`
4. `git add history/YYYY-MM-DD.json`
5. Commit with message `chore: add digest YYYY-MM-DD [skip ci]`
6. Push to main

**No secrets required** — all source files are public.

---

## Vercel Setup

- Connect `shanli/builders` GitHub repo to Vercel
- **Root directory:** `web/`
- **Build command:** `npm run build` (Astro default)
- **Output directory:** `dist/`
- Auto-deploy on every push to main branch

---

## Out of Scope

- Authentication / access control (site is fully public)
- LLM-generated summaries (raw feed data only)
- Search functionality
- RSS feed output
- Comments or social features
