# Spotify → YouTube Music Playlist Migrator

A production-grade Chrome Extension that allows users to export Spotify playlists to CSV and automatically import them into YouTube Music.

## Features

### Export (Spotify)
- **Automatic Playlist Detection**: Detects when you're on a Spotify playlist page
- **Lazy Loading Support**: Automatically scrolls through the entire playlist to load all songs
- **Duplicate Prevention**: Filters out duplicate tracks during extraction
- **CSV Export**: Downloads a properly formatted CSV file with:
  - Song Name
  - Artist
  - Album (optional)
  - Duration (optional)
- **Real-time Progress**: Shows extraction progress with song count

### Import (YouTube Music)
- **Drag & Drop CSV Upload**: Easy file upload with validation
- **CSV Preview**: See valid/invalid songs before importing
- **Smart Playlist Search**: Finds your target playlist on YouTube Music
- **Sequential Song Import**: Adds songs one-by-one with intelligent matching
- **Progress Tracking**: Real-time stats including:
  - Completed/Failed counts
  - ETA estimation
  - Current song being processed
- **Detailed Logs**: View success/failure for each song
- **Cancel Support**: Stop import at any time
- **Error Handling**: Graceful failure handling with notifications

## Installation

### Development Mode

1. **Clone or Download** this extension folder

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right

4. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Select the `extension` folder from this project

5. **Extension is Ready!**
   - You'll see the extension icon in your toolbar
   - Pin it for easy access

### Creating Icons (Optional)

The extension includes placeholder icons. For production use, create PNG icons:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

You can use tools like:
- [Figma](https://figma.com)
- [Canva](https://canva.com)
- [Photopea](https://photopea.com)

## Usage Guide

### Exporting from Spotify

1. **Navigate to a Spotify Playlist**
   ```
   https://open.spotify.com/playlist/[PLAYLIST_ID]
   ```

2. **Click the Extension Icon**
   - The Export tab will be active by default

3. **Click "Start Export"**
   - The extension will automatically scroll through the playlist
   - All songs will be extracted and deduplicated

4. **Download CSV**
   - Once complete, click "Download CSV"
   - File format: `spotify_playlist_[NAME].csv`

### Importing to YouTube Music

1. **Switch to Import Tab**
   - Click the "Import" tab in the extension popup

2. **Upload CSV File**
   - Drag & drop your CSV file, or click to browse
   - Review the preview table

3. **Enter Target Playlist Name**
   - Type the exact name of the playlist on YouTube Music
   - This playlist must already exist on YouTube Music

4. **Click "Start Importing"**
   - YouTube Music will open in a new tab
   - The extension will search for your playlist
   - Songs are imported one by one

5. **Monitor Progress**
   - Watch real-time progress in the popup
   - View detailed logs of each operation
   - Cancel anytime if needed

## Architecture

```
extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Main UI structure
├── popup.css             # Modern glassmorphism styles
├── popup.js              # Popup logic and event handlers
├── background.js         # Service worker for orchestration
│
├── utils/
│   ├── helpers.js        # Utility functions
│   └── csv-parser.js     # CSV parsing/generation
│
├── content/
│   ├── spotify.js        # Spotify extraction script
│   └── ytmusic.js        # YouTube Music automation
│
├── components/
│   └── toast.js          # Toast notification system
│
├── services/             # (For future expansion)
├── storage/              # (For future expansion)
├── assets/               # Extension icons
├── helpers/              # (For future expansion)
└── components/           # UI components
```

## Technical Details

### Permissions Required
- `tabs` - Manage browser tabs for automation
- `scripting` - Inject content scripts
- `activeTab` - Access current tab
- `storage` - Persist state between sessions
- `downloads` - Download CSV files

### Host Permissions
- `https://open.spotify.com/*` - Spotify web player
- `https://music.youtube.com/*` - YouTube Music

### Key Technologies
- **Manifest V3** - Latest Chrome extension platform
- **Service Workers** - Background processing
- **Content Scripts** - DOM manipulation
- **Chrome Storage API** - State persistence
- **MutationObserver** - Dynamic DOM detection
- **Async/Await** - Clean asynchronous code

## Troubleshooting

### Export Issues

**Problem**: No songs detected
- **Solution**: Make sure you're on a valid playlist URL
- Wait for the playlist to fully load before clicking export

**Problem**: Incomplete song list
- **Solution**: The extension auto-scrolls, but very large playlists may need manual scrolling first

### Import Issues

**Problem**: "Playlist not found"
- **Solution**: 
  - Ensure the playlist exists on YouTube Music
  - Check the spelling matches exactly
  - The playlist must be public or in your library

**Problem**: Songs not being added
- **Solution**:
  - Some songs may not exist on YouTube Music
  - Check the logs for specific failures
  - Try searching manually for failed songs

**Problem**: Import stops mid-way
- **Solution**:
  - Check for rate limiting (wait a few minutes)
  - Close other YouTube Music tabs
  - Restart the import process

### General Issues

**Problem**: Extension doesn't respond
- **Solution**:
  - Reload the extension in `chrome://extensions/`
  - Clear browser cache
  - Check console for errors (F12 → Console)

**Problem**: Toast notifications not showing
- **Solution**: Ensure popup is open during operations

## Debugging

### Enable Debug Logging

1. Open `chrome://extensions/`
2. Find "Playlist Migrator"
3. Click "Inspect views: background page"
4. Open Console tab to see logs

### Content Script Debugging

1. Navigate to Spotify or YouTube Music
2. Open DevTools (F12)
3. Go to Console tab
4. Look for `[Spotify Migrator]` or `[YTMusic Migrator]` logs

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Extraction already in progress" | Multiple export clicks | Wait for current export to finish |
| "Playlist not found" | Wrong playlist name | Verify exact playlist name on YTM |
| "Song not found" | Song unavailable on YTM | Manual search may help |
| "Timeout waiting for element" | Slow page load | Refresh and try again |

## Best Practices

1. **Before Exporting**
   - Let the Spotify playlist fully load
   - Scroll through once if it's very long

2. **Before Importing**
   - Create the target playlist on YouTube Music first
   - Note the exact playlist name

3. **During Import**
   - Keep the popup open for best experience
   - Don't close YouTube Music tabs manually
   - Allow 3-5 seconds per song

4. **Large Playlists**
   - Break into smaller chunks (50-100 songs)
   - Import in batches to avoid timeouts

## Limitations

- **Rate Limiting**: YouTube Music may limit rapid requests
- **Song Availability**: Not all Spotify songs exist on YouTube Music
- **Dynamic UI Changes**: Spotify/YTM UI updates may break selectors
- **Private Playlists**: Can only import to playlists you own/have access to

## Future Enhancements

- [ ] Pause/Resume import functionality
- [ ] Retry failed songs automatically
- [ ] Batch import optimization
- [ ] Custom song matching rules
- [ ] Import history tracking
- [ ] Playlist synchronization
- [ ] Support for albums/artists
- [ ] Dark/Light theme toggle

## Security Notes

- All processing happens locally in your browser
- No data is sent to external servers
- CSV files are generated client-side
- Extension only accesses Spotify and YouTube Music domains

## Support

For issues, questions, or contributions:
- Check the troubleshooting section above
- Review debug logs for error details
- Ensure you're using the latest version

## License

This extension is provided as-is for educational purposes.

---

**Version**: 1.0.0  
**Manifest Version**: 3  
**Minimum Chrome Version**: 88+
