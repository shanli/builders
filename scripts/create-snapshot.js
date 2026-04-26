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

  // Filter to builders who have tweets; strip unnecessary fields
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
