# Builders Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Astro static website on Vercel that archives daily AI builders digests, auto-populated by a GitHub Actions workflow that fetches public feed JSON from `zarazhangrui/follow-builders`.

**Architecture:** GitHub Actions fetches feed JSONs daily → saves `history/YYYY-MM-DD.json` → commits → Vercel detects push and rebuilds the Astro static site. All git operations are in `shanli/builders` at `/Users/dashan/Documents/daily/builders`.

**Tech Stack:** Astro (static), vanilla CSS, GitHub Actions, Vercel

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/create-snapshot.js` | Create | Fetches 3 feed JSONs, merges into dated snapshot |
| `history/2026-04-26.json` | Create | Seed snapshot from today's live data |
| `web/package.json` | Create | Astro project dependencies |
| `web/astro.config.mjs` | Create | Astro config (static output) |
| `web/src/layouts/Layout.astro` | Create | Base HTML wrapper |
| `web/src/components/DigestCard.astro` | Create | Date card on archive list |
| `web/src/components/BuilderSection.astro` | Create | X/Twitter builder + tweets |
| `web/src/components/PodcastSection.astro` | Create | Podcast episode entry |
| `web/src/components/BlogSection.astro` | Create | Blog post entry |
| `web/src/pages/index.astro` | Create | Archive list page |
| `web/src/pages/digest/[date].astro` | Create | Individual digest page |
| `.github/workflows/fetch-and-snapshot.yml` | Create | Daily CI workflow |

---

## Task 1: Snapshot Script + Seed Data

**Files:**
- Create: `scripts/create-snapshot.js`
- Create: `history/2026-04-26.json` (seeded by running the script)

- [ ] **Step 1: Create the snapshot script**

```js
// scripts/create-snapshot.js
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const date = process.env.SNAPSHOT_DATE || new Date().toISOString().split('T')[0];

  const [xData, podcastData, blogData] = await Promise.all([
    fetchJSON('feed-x.json'),
    fetchJSON('feed-podcasts.json'),
    fetchJSON('feed-blogs.json'),
  ]);

  // Filter to builders who have tweets; strip transcript (too large)
  const x = (xData.x ?? [])
    .filter(b => b.tweets?.length > 0)
    .map(({ source, name, handle, bio, tweets }) => ({ name, handle, bio, tweets }));

  // Strip full transcript from podcasts (not needed for web display)
  const podcasts = (podcastData.podcasts ?? []).map(
    ({ source, transcript, ...rest }) => rest
  );

  // Strip full content from blogs (link to original instead)
  const blogs = (blogData.blogs ?? []).map(
    ({ source, content, ...rest }) => rest
  );

  const snapshot = {
    date,
    x,
    podcasts,
    blogs,
    stats: {
      xBuilders: x.length,
      podcastEpisodes: podcasts.length,
      blogPosts: blogs.length,
    },
  };

  const outDir = join(__dirname, '..', 'history');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${date}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved history/${date}.json (${x.length} builders, ${podcasts.length} podcasts, ${blogs.length} blogs)`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: Run the script to seed today's snapshot**

```bash
cd /Users/dashan/Documents/daily/builders
node scripts/create-snapshot.js
```

Expected output:
```
Saved history/2026-04-26.json (14 builders, 1 podcasts, 1 blogs)
```

- [ ] **Step 3: Verify the snapshot file**

```bash
cat /Users/dashan/Documents/daily/builders/history/2026-04-26.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('date:', d['date'])
print('stats:', d['stats'])
print('first builder:', d['x'][0]['name'], '-', len(d['x'][0]['tweets']), 'tweets')
"
```

Expected output:
```
date: 2026-04-26
stats: {'xBuilders': 14, 'podcastEpisodes': 1, 'blogPosts': 1}
first builder: Swyx - 3 tweets
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dashan/Documents/daily/builders
git add scripts/create-snapshot.js history/2026-04-26.json
git commit -m "feat: add snapshot script and seed today's digest"
```

---

## Task 2: Astro Project Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/astro.config.mjs`
- Create: `web/src/layouts/Layout.astro`

- [ ] **Step 1: Create `web/package.json`**

```bash
mkdir -p /Users/dashan/Documents/daily/builders/web/src/layouts
mkdir -p /Users/dashan/Documents/daily/builders/web/src/components
mkdir -p /Users/dashan/Documents/daily/builders/web/src/pages/digest
```

```json
// web/package.json
{
  "name": "builders-web",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.16.0"
  }
}
```

- [ ] **Step 2: Create `web/astro.config.mjs`**

```js
// web/astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
});
```

- [ ] **Step 3: Create `web/src/layouts/Layout.astro`**

```astro
---
// web/src/layouts/Layout.astro
const { title = 'AI Builders Digest' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        max-width: 780px;
        margin: 0 auto;
        padding: 2rem 1.5rem;
        color: #1a1a1a;
        background: #fafafa;
        line-height: 1.6;
      }
      a { color: #0070f3; text-decoration: none; }
      a:hover { text-decoration: underline; }
      header { margin-bottom: 2.5rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
      header h1 { margin: 0; font-size: 1.5rem; }
      header p { margin: 0.25rem 0 0; color: #666; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <header>
      <h1><a href="/">AI Builders Digest</a></h1>
      <p>Daily updates from the top builders in AI</p>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 4: Install dependencies and verify Astro works**

```bash
cd /Users/dashan/Documents/daily/builders/web
npm install
npx astro --version
```

Expected: prints Astro version (4.x.x)

- [ ] **Step 5: Commit**

```bash
cd /Users/dashan/Documents/daily/builders
git add web/
git commit -m "feat: scaffold Astro project with base layout"
```

---

## Task 3: Archive List Page

**Files:**
- Create: `web/src/components/DigestCard.astro`
- Create: `web/src/pages/index.astro`

- [ ] **Step 1: Create `web/src/components/DigestCard.astro`**

```astro
---
// web/src/components/DigestCard.astro
const { date, stats } = Astro.props;

const formatted = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
---
<a href={`/digest/${date}`} class="card">
  <div class="date">{formatted}</div>
  <div class="stats">
    {stats.xBuilders} builders
    {stats.podcastEpisodes > 0 && ` · ${stats.podcastEpisodes} podcast`}
    {stats.blogPosts > 0 && ` · ${stats.blogPosts} blog`}
  </div>
</a>

<style>
  .card {
    display: block;
    padding: 1rem 1.25rem;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    background: white;
    transition: border-color 0.15s;
    text-decoration: none;
    color: inherit;
  }
  .card:hover { border-color: #0070f3; text-decoration: none; }
  .date { font-weight: 600; font-size: 1rem; }
  .stats { color: #666; font-size: 0.875rem; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 2: Create `web/src/pages/index.astro`**

```astro
---
// web/src/pages/index.astro
import Layout from '../layouts/Layout.astro';
import DigestCard from '../components/DigestCard.astro';

const snapshots = await Astro.glob('../../history/*.json');
const digests = snapshots
  .map(s => ({ date: s.date, stats: s.stats }))
  .sort((a, b) => b.date.localeCompare(a.date));
---
<Layout>
  <h2 style="margin-top:0">Archive</h2>
  {digests.length === 0 && <p>No digests yet.</p>}
  {digests.map(d => <DigestCard date={d.date} stats={d.stats} />)}
</Layout>
```

- [ ] **Step 3: Start dev server and verify the index page renders**

```bash
cd /Users/dashan/Documents/daily/builders/web
npm run dev
```

Open `http://localhost:4321` — should show one card for 2026-04-26 with "14 builders · 1 podcast · 1 blog".

Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /Users/dashan/Documents/daily/builders
git add web/src/
git commit -m "feat: add archive list page with DigestCard component"
```

---

## Task 4: Digest Detail Page

**Files:**
- Create: `web/src/components/BuilderSection.astro`
- Create: `web/src/components/PodcastSection.astro`
- Create: `web/src/components/BlogSection.astro`
- Create: `web/src/pages/digest/[date].astro`

- [ ] **Step 1: Create `web/src/components/BuilderSection.astro`**

```astro
---
// web/src/components/BuilderSection.astro
const { builder } = Astro.props;
// builder: { name, handle, bio, tweets: [{ text, url, likes, retweets }] }
---
<div class="builder">
  <div class="builder-header">
    <span class="name">{builder.name}</span>
    <a class="handle" href={`https://x.com/${builder.handle}`} target="_blank">@{builder.handle}</a>
  </div>
  {builder.bio && <p class="bio">{builder.bio.split('\n')[0]}</p>}
  <ul class="tweets">
    {builder.tweets.map(tweet => (
      <li class="tweet">
        <p class="tweet-text">{tweet.text}</p>
        <div class="tweet-meta">
          <a href={tweet.url} target="_blank">View on X ↗</a>
          <span class="engagement">♥ {tweet.likes} &nbsp; ↺ {tweet.retweets}</span>
        </div>
      </li>
    ))}
  </ul>
</div>

<style>
  .builder { margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid #eee; }
  .builder:last-child { border-bottom: none; }
  .builder-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
  .name { font-weight: 700; font-size: 1rem; }
  .handle { color: #666; font-size: 0.875rem; }
  .bio { color: #555; font-size: 0.875rem; margin: 0.25rem 0 0.75rem; }
  .tweets { list-style: none; padding: 0; margin: 0; }
  .tweet { background: #f5f5f5; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; }
  .tweet-text { margin: 0 0 0.5rem; white-space: pre-wrap; font-size: 0.9rem; }
  .tweet-meta { display: flex; justify-content: space-between; font-size: 0.8rem; }
  .engagement { color: #888; }
</style>
```

- [ ] **Step 2: Create `web/src/components/PodcastSection.astro`**

```astro
---
// web/src/components/PodcastSection.astro
const { podcast } = Astro.props;
// podcast: { name, title, url, publishedAt }
const pubDate = podcast.publishedAt
  ? new Date(podcast.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : null;
---
<div class="podcast">
  <div class="podcast-source">{podcast.name}</div>
  <a class="podcast-title" href={podcast.url} target="_blank">{podcast.title} ↗</a>
  {pubDate && <div class="podcast-date">{pubDate}</div>}
</div>

<style>
  .podcast { padding: 1rem; background: #f0f7ff; border-radius: 6px; margin-bottom: 1rem; }
  .podcast-source { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #0070f3; font-weight: 600; margin-bottom: 0.25rem; }
  .podcast-title { font-weight: 600; font-size: 0.95rem; display: block; margin-bottom: 0.25rem; }
  .podcast-date { color: #666; font-size: 0.8rem; }
</style>
```

- [ ] **Step 3: Create `web/src/components/BlogSection.astro`**

```astro
---
// web/src/components/BlogSection.astro
const { post } = Astro.props;
// post: { name, title, url, publishedAt, author, description }
---
<div class="blog">
  <div class="blog-source">{post.name}</div>
  <a class="blog-title" href={post.url} target="_blank">{post.title} ↗</a>
  {post.description && <p class="blog-desc">{post.description}</p>}
</div>

<style>
  .blog { padding: 1rem; background: #f5fff5; border-radius: 6px; margin-bottom: 1rem; }
  .blog-source { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #059669; font-weight: 600; margin-bottom: 0.25rem; }
  .blog-title { font-weight: 600; font-size: 0.95rem; display: block; margin-bottom: 0.25rem; }
  .blog-desc { color: #555; font-size: 0.875rem; margin: 0.25rem 0 0; }
</style>
```

- [ ] **Step 4: Create `web/src/pages/digest/[date].astro`**

```astro
---
// web/src/pages/digest/[date].astro
import Layout from '../../layouts/Layout.astro';
import BuilderSection from '../../components/BuilderSection.astro';
import PodcastSection from '../../components/PodcastSection.astro';
import BlogSection from '../../components/BlogSection.astro';

export async function getStaticPaths() {
  const snapshots = await Astro.glob('../../../history/*.json');
  const sorted = snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((snapshot, i) => ({
    params: { date: snapshot.date },
    props: {
      snapshot,
      prevDate: i > 0 ? sorted[i - 1].date : null,
      nextDate: i < sorted.length - 1 ? sorted[i + 1].date : null,
    },
  }));
}

const { snapshot, prevDate, nextDate } = Astro.props;
const { date, x, podcasts, blogs, stats } = snapshot;

const formatted = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
---
<Layout title={`AI Builders Digest — ${date}`}>
  <div class="digest-header">
    <h2>{formatted}</h2>
    <p class="summary">
      {stats.xBuilders} builders with new posts
      {stats.podcastEpisodes > 0 && ` · ${stats.podcastEpisodes} podcast episode`}
      {stats.blogPosts > 0 && ` · ${stats.blogPosts} blog post`}
    </p>
  </div>

  {x.length > 0 && (
    <section>
      <h3 class="section-title">X / Twitter</h3>
      {x.map(builder => <BuilderSection builder={builder} />)}
    </section>
  )}

  {blogs.length > 0 && (
    <section>
      <h3 class="section-title">Official Blogs</h3>
      {blogs.map(post => <BlogSection post={post} />)}
    </section>
  )}

  {podcasts.length > 0 && (
    <section>
      <h3 class="section-title">Podcasts</h3>
      {podcasts.map(podcast => <PodcastSection podcast={podcast} />)}
    </section>
  )}

  <nav class="pagination">
    {prevDate
      ? <a href={`/digest/${prevDate}`}>← {prevDate}</a>
      : <span></span>
    }
    <a href="/">All digests</a>
    {nextDate
      ? <a href={`/digest/${nextDate}`}>{nextDate} →</a>
      : <span></span>
    }
  </nav>
</Layout>

<style>
  .digest-header { margin-bottom: 2rem; }
  .digest-header h2 { margin: 0 0 0.25rem; }
  .summary { color: #666; margin: 0; font-size: 0.9rem; }
  .section-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #888; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin: 2rem 0 1.25rem; }
  .pagination { display: flex; justify-content: space-between; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #eee; font-size: 0.875rem; }
</style>
```

- [ ] **Step 5: Start dev server and verify detail page renders**

```bash
cd /Users/dashan/Documents/daily/builders/web
npm run dev
```

Open `http://localhost:4321/digest/2026-04-26` — should show the full digest with X, Blogs, and Podcasts sections. Check pagination shows "All digests" link.

Stop the server with Ctrl+C.

- [ ] **Step 6: Run production build to verify no errors**

```bash
cd /Users/dashan/Documents/daily/builders/web
npm run build
```

Expected: `dist/` folder created, no errors, output shows routes for `/` and `/digest/2026-04-26`.

- [ ] **Step 7: Commit**

```bash
cd /Users/dashan/Documents/daily/builders
git add web/src/
git commit -m "feat: add digest detail page with builder, podcast, and blog sections"
```

---

## Task 5: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/fetch-and-snapshot.yml`

- [ ] **Step 1: Create the workflow file**

```bash
mkdir -p /Users/dashan/Documents/daily/builders/.github/workflows
```

```yaml
# .github/workflows/fetch-and-snapshot.yml
name: Fetch and Snapshot Daily Feeds

on:
  schedule:
    # Run daily at 6:30am UTC (30 min after follow-builders CI updates feeds)
    - cron: '30 6 * * *'
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Create today's snapshot
        run: node scripts/create-snapshot.js

      - name: Commit and push snapshot
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          DATE=$(node -e "console.log(new Date().toISOString().split('T')[0])")
          git add history/${DATE}.json
          git diff --cached --quiet || git commit -m "chore: add digest ${DATE} [skip ci]"
          git push
```

- [ ] **Step 2: Commit the workflow**

```bash
cd /Users/dashan/Documents/daily/builders
git add .github/workflows/fetch-and-snapshot.yml
git commit -m "feat: add daily snapshot GitHub Actions workflow"
```

- [ ] **Step 3: Push all commits to remote**

```bash
cd /Users/dashan/Documents/daily/builders
git push origin main
```

- [ ] **Step 4: Verify workflow appears in GitHub**

Go to `https://github.com/shanli/builders/actions` — the "Fetch and Snapshot Daily Feeds" workflow should appear. Run it manually via "Run workflow" to verify it works end-to-end.

---

## Task 6: Vercel Setup (Manual)

This task is performed in the Vercel dashboard — no code changes needed.

- [ ] **Step 1: Connect repo to Vercel**

1. Go to vercel.com → New Project
2. Import `shanli/builders` from GitHub
3. Set **Root Directory** to `web`
4. **Build Command:** `npm run build` (Astro default, no override needed)
5. **Output Directory:** `dist`
6. Click Deploy

- [ ] **Step 2: Verify deployment**

After deploy completes, open the Vercel URL — should show the archive list with one entry for 2026-04-26.

- [ ] **Step 3: Verify auto-deploy works**

After the next GitHub Actions run (or trigger manually), confirm Vercel automatically picks up the new commit and deploys the updated site.

---

## Self-Review

**Spec coverage:**
- ✅ `shanli/builders` repo as target
- ✅ Astro static site
- ✅ `history/YYYY-MM-DD.json` snapshots
- ✅ Fetches from `zarazhangrui/follow-builders` public feeds
- ✅ `/` archive list page
- ✅ `/digest/[date]` detail page with X, Blogs, Podcasts sections
- ✅ Prev/next navigation
- ✅ GitHub Actions workflow at 6:30am UTC
- ✅ Vercel setup instructions

**No placeholders found.**

**Type consistency:** `builder.tweets`, `podcast.url`, `post.url` — all consistent between snapshot script output and component props.
