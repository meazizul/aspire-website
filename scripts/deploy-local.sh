#!/usr/bin/env bash
# Publish site/ to https://azizulhaque.me/aspire/ from your own machine, using
# your normal GitHub credentials (no deploy key needed). Requires git + rsync.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 https://github.com/meazizul/meazizul.github.io.git "$TMP/target"
rsync -a --delete --exclude '.git' "$HERE/site/" "$TMP/target/aspire/"
cd "$TMP/target"
# make sure the site is listed in the personal site's sitemap
if [ -f sitemap.xml ] && ! grep -q 'azizulhaque.me/aspire/' sitemap.xml; then
  python3 - <<'PY'
import re,datetime
p='sitemap.xml'; s=open(p).read()
entry='  <url><loc>https://azizulhaque.me/aspire/</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n' % datetime.date.today()
s=s.replace('</urlset>', entry+'</urlset>'); open(p,'w').write(s)
PY
fi
git add -A aspire sitemap.xml
if git diff --cached --quiet; then echo "Nothing to publish: /aspire is already up to date."; exit 0; fi
git commit -m "Update /aspire from aspire-website ($(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo local))"
git push
echo "Published. GitHub Pages usually refreshes within a minute or two: https://azizulhaque.me/aspire/"
