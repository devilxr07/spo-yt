/**
 * Spotify Content Script
 * Handles playlist extraction from Spotify web player
 */

(function() {
  'use strict';

  // State for extraction process
  let isExtracting = false;
  let extractedSongs = [];
  let playlistInfo = null;
  let seenSongs = new Set();

  /**
   * Initialize the content script
   */
  function init() {
    console.log('[Spotify Migrator] Content script initialized');
    
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /**
   * Handle messages from extension
   * @param {Object} message 
   * @param {Object} sender 
   * @param {Function} sendResponse 
   */
  function handleMessage(message, sender, sendResponse) {
    console.log('[Spotify Migrator] Received message:', message);

    switch (message.action) {
      case 'extractPlaylist':
        extractPlaylist()
          .then(result => {
            sendResponse({ success: true, ...result });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async response

      case 'getExtractionStatus':
        sendResponse({ isExtracting, progress: extractedSongs.length });
        return true;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  /**
   * Extract playlist information and songs
   * @returns {Promise<Object>}
   */
  async function extractPlaylist() {
    if (isExtracting) {
      throw new Error('Extraction already in progress');
    }

    isExtracting = true;
    extractedSongs = [];
    seenSongs = new Set();

    try {
      // Get playlist info
      playlistInfo = await getPlaylistInfo();
      
      // Scroll to load all songs
      await scrollAndLoadAllSongs();
      
      // Extract all songs
      await extractAllSongs();
      
      // Send completion message
      chrome.runtime.sendMessage({
        action: 'exportComplete',
        songs: extractedSongs,
        playlistInfo: playlistInfo
      });

      return {
        songs: extractedSongs,
        playlistInfo: playlistInfo
      };

    } catch (error) {
      console.error('[Spotify Migrator] Extraction error:', error);
      chrome.runtime.sendMessage({
        action: 'exportError',
        error: error.message
      });
      throw error;
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Get playlist metadata
   * @returns {Promise<Object>}
   */
  async function getPlaylistInfo() {
    // Wait for page to load
    await waitForElement('[data-testid="playlist-play-button"]', 5000);

    const titleElement = document.querySelector('h1[data-testid="context-page-title"]');
    const descriptionElement = document.querySelector('[data-testid="context-page-description"]');
    const ownerElement = document.querySelector('[data-testid="context-page-info"]');

    return {
      name: titleElement?.textContent?.trim() || 'Unknown Playlist',
      description: descriptionElement?.textContent?.trim() || '',
      owner: ownerElement?.textContent?.trim() || '',
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Scroll through playlist to load all songs (handles lazy loading)
   */
  async function scrollAndLoadAllSongs() {
    const scrollContainer = document.querySelector('[role="main"]') || 
                            document.querySelector('.MainView-container') ||
                            document.body;

    let previousHeight = 0;
    let maxScrolls = 50; // Prevent infinite scrolling
    let scrolls = 0;
    let noChangeCount = 0;
    let lastSongCount = 0;
    let stableCount = 0;

    while (scrolls < maxScrolls && noChangeCount < 3) {
      const currentSongs = getAllSongElements().length;
      
      // Report progress only if count changed (reduces message overhead)
      if (currentSongs !== lastSongCount) {
        chrome.runtime.sendMessage({
          action: 'exportProgress',
          progress: currentSongs,
          total: currentSongs,
          message: `Loading songs... ${currentSongs} found`
        });
        lastSongCount = currentSongs;
        stableCount = 0;
      } else {
        stableCount++;
        // If count stable for 3 consecutive scrolls, we're done
        if (stableCount >= 3) break;
      }

      // Scroll down
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      const newHeight = scrollContainer.scrollHeight;

      // Check if more content loaded
      if (newHeight === previousHeight) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }
      
      previousHeight = newHeight;
      scrolls++;

      // Adaptive wait: shorter if still loading, longer if near end
      await sleep(currentSongs > 0 ? 300 : 500);
    }

    // Final scroll to top
    scrollContainer.scrollTop = 0;
    await sleep(200);
  }

  /**
   * Extract all songs from the playlist
   */
  async function extractAllSongs() {
    const songElements = getAllSongElements();
    const total = songElements.length;

    console.log(`[Spotify Migrator] Found ${total} song elements`);

    // Batch processing for better performance
    const batchSize = 50;
    for (let i = 0; i < songElements.length; i += batchSize) {
      const batch = songElements.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const songElement = batch[j];
        const songData = extractSongData(songElement, i + j);

        if (songData && !isDuplicate(songData)) {
          extractedSongs.push(songData);
          markAsSeen(songData);
        }
      }

      // Report progress after each batch
      chrome.runtime.sendMessage({
        action: 'exportProgress',
        progress: extractedSongs.length,
        total: total,
        message: `Extracted ${extractedSongs.length}/${total} songs`
      });
      
      // Small delay between batches to prevent UI blocking
      if (i + batchSize < songElements.length) {
        await sleep(10);
      }
    }

    console.log(`[Spotify Migrator] Extraction complete: ${extractedSongs.length} unique songs`);
  }

  /**
   * Get all song row elements
   * @returns {Array<Element>}
   */
  function getAllSongElements() {
    // Try multiple selectors for different Spotify layouts
    const selectors = [
      '[role="row"][data-track-id]',
      '.TrackListRow[data-track-id]',
      '[data-testid="tracklist-row"]',
      'li[data-context-id]'
    ];

    let elements = [];
    for (const selector of selectors) {
      elements = Array.from(document.querySelectorAll(selector));
      if (elements.length > 0) break;
    }

    return elements;
  }

  /**
   * Extract data from a single song element
   * @param {Element} element 
   * @param {number} index 
   * @returns {Object|null}
   */
  function extractSongData(element, index) {
    try {
      // Get track ID for better identification
      const trackId = element.getAttribute('data-track-id') || 
                     element.getAttribute('data-context-id');

      // Try different selectors for song title
      const titleSelectors = [
        '[data-testid="cell-title"] a',
        '.TrackListRow-title a',
        '[data-testid="tracklist-row-title"]',
        'a[href*="/track/"]'
      ];

      let titleElement = null;
      for (const selector of titleSelectors) {
        titleElement = element.querySelector(selector);
        if (titleElement) break;
      }

      // Try different selectors for artist
      const artistSelectors = [
        '[data-testid="cell-context"] a',
        '.TrackListRow-subTitle a',
        '[data-testid="tracklist-row-subtitle"] a',
        'span:has(a[href*="/artist/"])'
      ];

      let artistElement = null;
      for (const selector of artistSelectors) {
        artistElement = element.querySelector(selector);
        if (artistElement) break;
      }

      // If we couldn't find essential elements, try alternative approach
      if (!titleElement) {
        // Fallback: look for any text content that might be the title
        const textContent = element.textContent;
        if (!textContent || textContent.trim().length === 0) {
          return null;
        }
      }

      const name = titleElement?.textContent?.trim() || `Unknown Track ${index + 1}`;
      const artist = artistElement?.textContent?.trim() || 'Unknown Artist';

      // Skip if no valid data
      if (name === `Unknown Track ${index + 1}` && artist === 'Unknown Artist') {
        return null;
      }

      // Extract album (optional)
      const albumElement = element.querySelector('[data-testid="cell-context"]:nth-of-type(2)') ||
                          element.querySelector('.TrackListRow-album');
      const album = albumElement?.textContent?.trim() || '';

      // Extract duration (optional)
      const durationElement = element.querySelector('[data-testid="cell-duration"]') ||
                             element.querySelector('.TrackListRow-duration');
      const duration = durationElement?.textContent?.trim() || '';

      return {
        name,
        artist,
        album,
        duration,
        index: extractedSongs.length,
        trackId: trackId || undefined
      };

    } catch (error) {
      console.error('[Spotify Migrator] Error extracting song:', error);
      return null;
    }
  }

  /**
   * Check if song is a duplicate
   * @param {Object} song 
   * @returns {boolean}
   */
  function isDuplicate(song) {
    // Use trackId if available for more accurate duplicate detection
    if (song.trackId) {
      return seenSongs.has(song.trackId);
    }
    const key = `${song.name.toLowerCase()}|${song.artist.toLowerCase()}`;
    return seenSongs.has(key);
  }

  /**
   * Mark song as seen
   * @param {Object} song 
   */
  function markAsSeen(song) {
    // Use trackId if available for more accurate duplicate detection
    if (song.trackId) {
      seenSongs.add(song.trackId);
    } else {
      const key = `${song.name.toLowerCase()}|${song.artist.toLowerCase()}`;
      seenSongs.add(key);
    }
  }

  /**
   * Wait for an element to appear
   * @param {string} selector 
   * @param {number} timeout 
   * @returns {Promise<Element>}
   */
  async function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms 
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
