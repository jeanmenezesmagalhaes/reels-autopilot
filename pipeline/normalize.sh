#!/usr/bin/env bash
# Final export to Instagram Reels spec: 1080x1920, 30fps, H.264 + AAC,
# loudness -14 LUFS, faststart. Usage: normalize.sh input.mov output.mp4
set -euo pipefail

in="$1"
out="$2"

ffmpeg -hide_banner -loglevel error -y -i "$in" \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 19 -maxrate 12M -bufsize 24M \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 160k -ar 48000 \
  -movflags +faststart "$out"
