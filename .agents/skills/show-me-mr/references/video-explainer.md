# Narrated explainer video (3Blue1Brown style)

Make a 60 to 180 second video that explains the change. It is for a reader who wants to watch before they review. Write all files to `.show-me/mr-{id}/video/`.

## 1. Check tools first

Run these checks and report what you find in one line:

```bash
command -v manim ffmpeg ffprobe
python3 -c "import manim" 2>/dev/null && echo manim-py-ok
[ -n "$ELEVENLABS_API_KEY" ] && echo elevenlabs-key-set
command -v say piper 2>/dev/null
```

- **Animation:** Manim Community Edition (`manim`). If it is missing, ask the user before you install it (`pipx install manim` or `uv tool install manim`; it also needs `ffmpeg`). Do not install packages without approval.
- **Narration:** Pick the first available option and tell the user which one you chose:
  1. ElevenLabs, only if `ELEVENLABS_API_KEY` is set **and** the user agrees, because it is a paid API that receives the script text.
  2. A local engine: `piper`, or `say` on macOS.
  3. No audio: burn the narration into the video as on-screen captions.
- If Manim cannot be used, fall back to an animated HTML slide deck at `.show-me/mr-{id}/video/index.html` that auto-advances, using the same script.

## 2. Write the script: `script.md`

Use 4 to 7 scenes. Each scene has one STE narration paragraph (2 to 4 sentences, see `ste-writing.md`) and one visual.

| # | Scene | Visual |
|---|---|---|
| 1 | The problem | the old behavior, animated |
| 2 | The idea | one sentence on screen plus a simple shape |
| 3 to 5 | How it works | the level 2 views turned into motion: boxes for modules, arrows for calls, a moving dot for data |
| 6 | What to check | the warnings and review order as a list that builds item by item |

Show the script to the user before you render. Rendering takes time, so fix the story first.

## 3. Make the audio, then fit the animation to it

Generate one audio file per scene, then measure it:

```bash
# ElevenLabs (only with consent)
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID:-21m00Tcm4TlvDq8ikWAM}" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$TEXT" '{text:$t, model_id:"eleven_multilingual_v2"}')" \
  -o audio/scene{n}.mp3

# macOS local
say -o audio/scene{n}.aiff "$TEXT"

# Duration in seconds
ffprobe -v error -show_entries format=duration -of csv=p=0 audio/scene{n}.*
```

Write `scenes.py` with one Manim `Scene` class per scene. Set each scene's total `run_time` plus `wait` to the measured duration of its audio.

## 4. Manim style

- Dark background (`#1e1e2e`), a 2 to 3 color palette, and `Text`/`Code` mobjects for identifiers.
- Build each idea with `Create`, `Write`, `Transform`, and `FadeIn`. Change one thing at a time so the eye can follow it.
- Use `Transform` to turn the "before" shape into the "after" shape. This is the 3b1b move, and it fits diffs well.
- Show at most ~12 words of on-screen text at a time. The narration carries the detail.
- Use real identifiers from the diff.

## 5. Render and join

```bash
manim -qm scenes.py Scene1 Scene2 ...            # draft quality; use -qh only if the user asks
# Combine each scene with its audio, then concatenate the scenes
ffmpeg -i media/videos/scenes/720p30/Scene{n}.mp4 -i audio/scene{n}.* -c:v copy -c:a aac -shortest part{n}.mp4
printf "file 'part%s.mp4'\n" 1 2 3 ... > parts.txt
ffmpeg -f concat -safe 0 -i parts.txt -c copy ../explainer.mp4
```

Then open `.show-me/mr-{id}/explainer.mp4`. If a render fails, fix the scene and re-render only that scene.
