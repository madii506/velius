#!/bin/sh
# bundles the page scripts and stamps the shared header into every page; rings.js (Privacy Rings SDK) is its own lazy chunk
set -e
cd "$(dirname "$0")"
for p in home desk markets privacy vault docs status; do
  [ -f "src/$p.js" ] && npx esbuild "src/$p.js" --bundle --format=esm --minify --target=es2020 --outfile="assets/js/$p.js" --log-level=warning
done
[ -f assets/js/rings.js ] && [ "$1" != "--rings" ] || npx esbuild src/rings-entry.js --bundle --format=esm --platform=browser --minify --target=es2022 --outfile=assets/js/rings.js
node dev/html.cjs
true
