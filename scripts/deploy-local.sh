#!/usr/bin/env bash
# Publish site/ to https://azizulhaque.me/aspire/ from your own machine, using
# your normal GitHub credentials (no deploy key needed). Requires git + rsync.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# Use HTTPS with the GitHub CLI's stored login, ignoring any global git config
# that rewrites github.com URLs to SSH (this machine has such a rule).
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0
if command -v gh >/dev/null 2>&1; then export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0='!gh auth git-credential'; fi
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
git -c user.name="Azizul Haque" -c user.email="ahaque3@stevens.edu" commit -m "Update /aspire from aspire-website ($(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo local))"
git push
echo "Published. GitHub Pages usually refreshes within a minute or two: https://azizulhaque.me/aspire/"
