# Double-Buffered Hero Video Switching

## Video Naming Convention

Your hero videos **must** use these exact file names in your hero video folder:

- **`hero_video_a.mp4`** - First video buffer
- **`hero_video_b.mp4`** - Second video buffer

## How It Works

The system implements double-buffering to eliminate black screens during video transitions:

1. **STARTING phase** → Plays `hero_video_a.mp4`
2. **MAPPICKING/BAN phases** → Switches to `hero_video_b.mp4` (while `a` preloads next video)
3. **PLAYING phase** → Switches back to `hero_video_a.mp4` (while `b` preloads)
4. **ENDMAP phase** → Switches to `hero_video_b.mp4`
5. **FINISHED phase** → Switches to `hero_video_a.mp4`

## OBS Setup Required

In OBS, you must create two media sources in your overlay scene:

### Source 1: HeroVideoA
- Type: Media Source
- Name: `HeroVideoA`
- File: `hero_video_a.mp4` (from your configured folder)
- **Visible** by default

### Source 2: HeroVideoB
- Type: Media Source
- Name: `HeroVideoB`
- File: `hero_video_b.mp4` (from your configured folder)
- **Hidden** by default

## Manager Dashboard Configuration

In the Manager Dashboard Settings (Stream Settings tab):
1. Set **Hero Video Folder Path** to the folder containing your videos
2. Set **OBS WebSocket URL** (e.g., `ws://localhost:4455`)
3. Set **OBS WebSocket Password**
4. Click "Test Connection" to verify

## Result

✅ No black screens on scene transitions
✅ Perfectly smooth video switching
✅ Zero frame drops
✅ Professional broadcast quality
