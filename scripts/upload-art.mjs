#!/usr/bin/env node
/**
 * Upload photos of paintings as a GitHub Release — one release = one
 * collection, every image attached to it is one artwork on the gallery.
 *
 *   node scripts/token.mjs                    # once per machine
 *   node scripts/upload-art.mjs <tag> [folder]
 *   node scripts/upload-art.mjs studio-2026 ./photos
 *
 * - jpg/jpeg/png/webp/gif/avif files in the folder become release assets.
 *   HEIC/HEIF (iPhone) and TIFF are refused — browsers can't show them;
 *   convert to JPG first (e.g. `magick *.heic *.jpg`).
 * - captions.txt (optional), one per line:
 *       IMG_2041.jpg: Blue dusk — oil on canvas, 2024
 *   becomes the image's caption on the gallery page (stored as the
 *   asset's GitHub label, so it travels with the file).
 * - The tag names the collection: dashes/underscores → spaces,
 *   "studio-2026" → "studio 2026". Re-running with the same tag ADDS
 *   new photos instead of duplicating. scripts/replace.mjs swaps one.
 * - Uploads never touch git — the gallery page
 *   (jonnymexican.github.io/test/gallery/) lists everything automatically.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const REPO = 'jonnymexican/art';
const API = `https://api.github.com/repos/${REPO}`;
const UPLOADS = `https://uploads.github.com/repos/${REPO}/releases`;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const BROWSER_BROKEN = /\.(heic|heif|tiff?|bmp)$/i;
const TWO_GB = 2 * 1024 ** 3;

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function readToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();
  for (const p of [join(root, 'secrets.token'), join(root, '..', 'dj-mixes', 'secrets.token')]) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }
  console.error('No token found. Run:  node scripts/token.mjs   (or set GH_TOKEN)');
  process.exit(1);
}

const TOKEN = readToken();
const auth = {
  authorization: `token ${TOKEN}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'art-upload',
};

const [tag, folderArg] = process.argv.slice(2);
if (!tag || !/^[A-Za-z0-9._-]+$/.test(tag)) {
  console.error('Usage: node scripts/upload-art.mjs <tag> [folder]  — tag: letters, digits, dot, dash, underscore');
  process.exit(1);
}
const folder = resolve(folderArg || './photos');
if (!existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

const all = readdirSync(folder);
const files = all.filter((f) => IMAGE_EXT.test(f)).sort();
const broken = all.filter((f) => BROWSER_BROKEN.test(f));
for (const f of broken) {
  console.log(`SKIP ${f} — ${f.split('.').pop().toUpperCase()} won't render in browsers; convert to JPG first`);
}
if (files.length === 0) {
  console.error(`No uploadable images (jpg/jpeg/png/webp/gif/avif) in ${folder}`);
  process.exit(1);
}

// captions.txt: "IMG_2041.jpg: Blue dusk — oil on canvas, 2024"
const captions = {};
const capPath = join(folder, 'captions.txt');
if (existsSync(capPath)) {
  for (const line of readFileSync(capPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/);
    if (m && IMAGE_EXT.test(m[1])) captions[m[1].toLowerCase()] = m[2];
  }
}

const title = tag.replace(/[-_]+/g, ' ');
console.log(`${files.length} image(s) → collection "${title}" (${tag})`);

// Find or create the release for this tag.
let release;
const findRes = await fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: auth });
if (findRes.status === 200) {
  release = await findRes.json();
  console.log('Collection exists — adding to it.');
} else if (findRes.status === 404) {
  const createRes = await fetch(`${API}/releases`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ tag_name: tag, name: title, body: `Paintings — ${title}` }),
  });
  if (!createRes.ok) {
    console.error(`Could not create collection: ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }
  release = await createRes.json();
  console.log('Collection created.');
} else {
  console.error(`Collection lookup failed: ${findRes.status} ${await findRes.text()}`);
  process.exit(1);
}

const existing = new Set();
const listRes = await fetch(`${API}/releases/${release.id}/assets?per_page=100`, { headers: auth });
if (listRes.ok) {
  for (const a of await listRes.json()) existing.add(a.name);
}

let uploaded = 0;
for (const file of files) {
  const path = join(folder, file);
  const size = statSync(path).size;
  if (size > TWO_GB) {
    console.log(`SKIP ${file} — over GitHub's 2 GB asset limit`);
    continue;
  }
  if (existing.has(file)) {
    console.log(`SKIP ${file} — already attached (scripts/replace.mjs swaps it)`);
    continue;
  }
  const caption = captions[file.toLowerCase()];
  const labelParam = caption ? `&label=${encodeURIComponent(caption)}` : '';
  process.stdout.write(`↑ ${file} (${(size / 1e6).toFixed(1)} MB)${caption ? ' — captioned' : ''}… `);
  const res = await fetch(
    `${UPLOADS}/${release.id}/assets?name=${encodeURIComponent(file)}${labelParam}`,
    {
      method: 'POST',
      headers: {
        authorization: `token ${TOKEN}`,
        'content-type': 'application/octet-stream',
        'content-length': String(size),
        'user-agent': 'art-upload',
      },
      // Stream straight from disk — same as the DJ Vault uploader.
      body: Readable.toWeb(createReadStream(path)),
      duplex: 'half',
    }
  );
  if (res.status === 201) {
    uploaded += 1;
    console.log('done');
  } else {
    console.log(`FAILED (${res.status}) ${await res.text()}`);
  }
}

console.log(
  `\n${uploaded}/${files.length} uploaded. They appear at ` +
    'https://jonnymexican.github.io/test/gallery/ on the next page load.'
);
