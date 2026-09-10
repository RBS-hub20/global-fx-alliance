#!/usr/bin/env bash
# Regenerates every app icon from one source file.
#
#   1. Save your 1024x1024 badge as  public/icon-source.png
#   2. bash scripts/make-icons.sh
#
# The source must already be square, and already on the dark ground (#070A12).
# Nothing here fills a background: sips cannot key out a colour, so a source with
# a white backdrop produces white icons — which is exactly what happened when
# these were first cut from logo.png.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="public/icon-source.png"

[ -f "$SRC" ] || { echo "missing $SRC — save your 1024px badge there first"; exit 1; }

# Full-bleed icons: the badge fills the tile.
for s in 192 512 1024; do
  sips -Z "$s" "$SRC" --out "public/icon-$s.png" >/dev/null
done

# iOS reads this one for the home screen and ignores the manifest.
sips -Z 180 "$SRC" --out "public/apple-touch-icon.png" >/dev/null

# Maskable variants.
#
# Android crops a maskable icon to a circle inscribed in the middle 80%, so art
# that reaches the edge loses its outer ring. These are inset to 78% and padded
# with the app background, which keeps the whole badge inside the safe zone.
# This is why the manifest declares "any" and "maskable" on separate files
# rather than "any maskable" on one: a full-bleed badge tagged maskable gets
# its ring sliced off on most Android launchers.
for s in 192 512; do
  inner=$(( s * 78 / 100 ))
  sips -Z "$inner" "$SRC" --out "/tmp/gfxa-mask-$s.png" >/dev/null
  sips -p "$s" "$s" --padColor 070A12 "/tmp/gfxa-mask-$s.png" --out "public/icon-maskable-$s.png" >/dev/null
  rm -f "/tmp/gfxa-mask-$s.png"
done

echo "written:"
for f in public/icon-192.png public/icon-512.png public/icon-1024.png \
         public/apple-touch-icon.png public/icon-maskable-192.png public/icon-maskable-512.png; do
  printf '  %-34s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
done
