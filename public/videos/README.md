# Hero clip for /join

Drop a short, silent, looping MP4 here as `gfxa-promo.mp4` and it becomes the
hero background on /join automatically — no code change.

- 1080x1920 or 1280x720, H.264, under ~4 MB so it starts fast on mobile data
- No audio track: the video is muted and autoplaying, which browsers only allow
  for muted playback
- Until the file exists the page renders an animated fallback, so a missing clip
  never shows a black rectangle

To serve it from elsewhere (a CDN, for instance), set `NEXT_PUBLIC_JOIN_VIDEO_URL`
instead.
