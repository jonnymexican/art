# art — Jon's paintings

Photos of the paintings live here as **GitHub Release assets** — a release is a
"collection", each image attached to it hangs in the fleet gallery automatically:

**▶ Gallery: https://jonnymexican.github.io/test/gallery/**

## Uploading (one-time setup, then one command)

```bash
# once per machine: borrow your existing GitHub login into secrets.token (gitignored)
node scripts/token.mjs

# put photos in a folder, then:
node scripts/upload-art.mjs studio-2026 ./photos
```

- The tag names the collection: `studio-2026` → "studio 2026". Re-running with
  the same tag **adds** new photos instead of duplicating.
- jpg/jpeg/png/webp/gif/avif only — HEIC (iPhone) and TIFF won't render in
  browsers, so convert those to JPG first.
- **Captions:** drop a `captions.txt` next to the photos, one per line:

  ```
  IMG_2041.jpg: Blue dusk — oil on canvas, 2024
  IMG_2042.jpg: Study in ochre — acrylic on paper
  ```

  The caption shows under the painting in the gallery. Edit the file, then
  re-run `scripts/replace.mjs` for that photo to update its caption.

Re-took a photo? Swap it in one step (deletes the remote asset, re-uploads the
local one, re-applies the caption):

```bash
node scripts/replace.mjs studio-2026 ./photos/IMG_2041.jpg
```

Need a token by hand? Paste any repo-scoped token into `secrets.token`, or
export `GH_TOKEN` first. If the DJ Vault's `../dj-mixes/secrets.token` exists,
it's borrowed automatically.

## Notes

- Assets cap at **2 GB** each — phone photos are ~5 MB, so no worries.
- Uploads don't touch git (no LFS, no history growth) — the repo holds only
  these scripts.
- The repo is **public** because the gallery reads it anonymously.
- Gallery page source lives in the main fleet repo (`public/gallery/`).
