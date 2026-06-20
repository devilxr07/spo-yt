/**
 * YouTube Music Content Script
 * Handles search, playlist selection, and song addition automation
 */

(function() {
  'use strict';

  // State management
  let isProcessing = false;
  let currentTask = null;
  let targetPlaylistId = null;
  let targetPlaylistName = null;

  /**
   * Initialize the content script
   */
  function init() {
    console.log('[YTMusic Migrator] Content script initialized');
    
    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /**
   * Handle messages from extension
   * @param {Object} message 
   * @param {Object} sender 
   * @param {Function} sendResponse 
   */
  function handleMessage(message, sender, sendResponse) {
    console.log('[YTMusic Migrator] Received message:', message);

    switch (message.action) {
      case 'searchPlaylist':
        searchForPlaylist(message.playlistName)
          .then(result => sendResponse({ success: true, ...result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'addSongToPlaylist':
        addSongToPlaylist(message.song, message.playlistName)
          .then(result => sendResponse({ success: true, ...result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getProcessingStatus':
        sendResponse({ isProcessing, currentTask });
        return true;

      case 'cancelOperation':
        isProcessing = false;
        sendResponse({ cancelled: true });
        return true;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  /**
   * Search for a playlist by name
   * @param {string} playlistName 
   * @returns {Promise<Object>}
   */
  async function searchForPlaylist(playlistName) {
    if (isProcessing) {
      throw new Error('Already processing another task');
    }

    isProcessing = true;
    currentTask = { type: 'searchPlaylist', name: playlistName };

    try {
      // Navigate to search
      await navigateToSearch(playlistName);
      
      // Wait for results
      await sleep(2000);
      
      // Look for playlists in search results
      const playlist = await findPlaylistInResults(playlistName);
      
      if (!playlist) {
        throw new Error(`Playlist "${playlistName}" not found`);
      }

      targetPlaylistId = playlist.id;
      targetPlaylistName = playlist.name;

      return {
        found: true,
        playlistId: playlist.id,
        playlistName: playlist.name
      };

    } catch (error) {
      console.error('[YTMusic Migrator] Search error:', error);
      throw error;
    } finally {
      isProcessing = false;
      currentTask = null;
    }
  }

  /**
   * Navigate to search page with query
   * @param {string} query 
   */
  async function navigateToSearch(query) {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://music.youtube.com/search?q=${encodedQuery}`;
    
    // Check if we need to navigate
    if (!window.location.href.includes('/search')) {
      window.location.href = searchUrl;
      
      // Wait for navigation
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
    } else {
      // Update search query using input field
      const searchInput = document.querySelector('input#search-input') ||
                         document.querySelector('ytmusic-search-box input');
      
      if (searchInput) {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Trigger search
        const searchButton = document.querySelector('button#search-button') ||
                            document.querySelector('ytmusic-search-box button');
        if (searchButton) {
          searchButton.click();
        }
      }
    }
  }

  /**
   * Find playlist in search results
   * @param {string} playlistName 
   * @returns {Promise<Object|null>}
   */
  async function findPlaylistInResults(playlistName) {
    // Wait for results to load
    await waitForElement('ytmusic-grid-header-renderer, ytmusic-section-list-renderer', 10000);
    
    // Try to filter to playlists
    await filterToPlaylists();
    
    // Wait for filtered results
    await sleep(1000);
    
    // Look for playlist elements
    const playlistSelectors = [
      'ytmusic-responsive-list-item-renderer[playlist-id]',
      'ytmusic-grid-header-renderer + * ytmusic-responsive-list-item-renderer',
      '[flex-columns] ytmusic-navigation-button-renderer'
    ];
    
    let playlistElements = [];
    for (const selector of playlistSelectors) {
      playlistElements = document.querySelectorAll(selector);
      if (playlistElements.length > 0) break;
    }
    
    console.log('[YTMusic Migrator] Found playlist elements:', playlistElements.length);
    
    // Find best match
    const normalizedTarget = normalizeString(playlistName);
    let bestMatch = null;
    let bestScore = 0;
    
    for (const element of playlistElements) {
      const titleElement = element.querySelector('#titles a') ||
                          element.querySelector('.title a') ||
                          element.querySelector('ytmusic-navigation-button-renderer');
      
      if (!titleElement) continue;
      
      const titleText = titleElement.textContent?.trim() || '';
      const normalizedTitle = normalizeString(titleText);
      
      // Calculate similarity score
      const score = calculateSimilarity(normalizedTarget, normalizedTitle);
      
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = {
          id: element.getAttribute('playlist-id') || extractPlaylistId(element),
          name: titleText,
          element: element,
          score: score
        };
      }
    }
    
    if (bestMatch) {
      console.log('[YTMusic Migrator] Best match:', bestMatch.name, 'score:', bestMatch.score);
    }
    
    return bestMatch;
  }

  /**
   * Filter search results to show only playlists
   */
  async function filterToPlaylists() {
    // Look for filter chips
    const filterChips = document.querySelectorAll('ytmusic-chip-cloud-renderer chip-cloud-chip-renderer');
    
    for (const chip of filterChips) {
      const text = chip.textContent?.toLowerCase() || '';
      if (text.includes('playlist') || text.includes('playlists')) {
        chip.click();
        await sleep(500);
        return;
      }
    }
    
    // Alternative: look for filter button
    const filterButton = document.querySelector('button#filter-button') ||
                        document.querySelector('ytmusic-menu-renderer button');
    if (filterButton) {
      filterButton.click();
      await sleep(300);
      
      // Look for playlist option in menu
      const menuItems = document.querySelectorAll('ytmusic-menu-service-item-renderer');
      for (const item of menuItems) {
        const text = item.textContent?.toLowerCase() || '';
        if (text.includes('playlist')) {
          item.click();
          await sleep(500);
          return;
        }
      }
    }
  }

  /**
   * Add a song to the target playlist
   * @param {Object} song 
   * @param {string} playlistName 
   * @returns {Promise<Object>}
   */
  async function addSongToPlaylist(song, playlistName) {
    if (isProcessing) {
      throw new Error('Already processing another task');
    }

    isProcessing = true;
    currentTask = { type: 'addSong', song, playlistName };

    try {
      // Search for the song
      const searchResult = await searchForSong(song);
      
      if (!searchResult.found) {
        throw new Error(`Song "${song.name}" by ${song.artist} not found`);
      }
      
      // Open the three-dot menu
      await openSongMenu(searchResult.element);
      
      // Click "Add to playlist"
      await clickAddToPlaylist();
      
      // Select the target playlist
      await selectTargetPlaylist(playlistName);
      
      // Wait for confirmation
      await sleep(500);
      
      return {
        success: true,
        song: song.name,
        artist: song.artist
      };

    } catch (error) {
      console.error('[YTMusic Migrator] Add song error:', error);
      throw error;
    } finally {
      isProcessing = false;
      currentTask = null;
    }
  }

  /**
   * Search for a song on YouTube Music
   * @param {Object} song 
   * @returns {Promise<Object>}
   */
  async function searchForSong(song) {
    // Build search query
    const query = `${song.name} ${song.artist}`;
    const encodedQuery = encodeURIComponent(query);
    
    // Navigate to search
    window.location.href = `https://music.youtube.com/search?q=${encodedQuery}`;
    
    // Wait for page load
    await new Promise(resolve => {
      window.addEventListener('load', resolve, { once: true });
    });
    
    // Wait for results
    await sleep(2000);
    await waitForElement('ytmusic-grid-header-renderer, ytmusic-section-list-renderer', 10000);
    
    // Find best matching song
    const songElements = document.querySelectorAll('ytmusic-responsive-list-item-renderer, ytmusic-two-row-item-renderer');
    
    const normalizedTargetTitle = normalizeString(song.name);
    const normalizedTargetArtist = normalizeString(song.artist);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const element of songElements) {
      // Get title and artist from element
      const titleElement = element.querySelector('#titles a') ||
                          element.querySelector('.title a');
      const subtitleElement = element.querySelector('#subtitles') ||
                             element.querySelector('.subtitle');
      
      if (!titleElement) continue;
      
      const titleText = titleElement.textContent?.trim() || '';
      const subtitleText = subtitleElement?.textContent?.trim() || '';
      
      const normalizedTitle = normalizeString(titleText);
      const normalizedSubtitle = normalizeString(subtitleText);
      
      // Calculate combined score
      const titleScore = calculateSimilarity(normalizedTargetTitle, normalizedTitle);
      const artistScore = normalizedSubtitle.includes(normalizedTargetArtist) ? 0.8 : 0;
      
      const combinedScore = (titleScore * 0.7) + (artistScore * 0.3);
      
      if (combinedScore > bestScore && combinedScore >= 0.5) {
        bestScore = combinedScore;
        bestMatch = {
          found: true,
          title: titleText,
          artist: subtitleText,
          element: element,
          score: combinedScore
        };
      }
    }
    
    return bestMatch || { found: false };
  }

  /**
   * Open the three-dot menu for a song
   * @param {Element} songElement 
   */
  async function openSongMenu(songElement) {
    // Find the menu button
    const menuButton = songElement.querySelector('button#menu') ||
                      songElement.querySelector('ytmusic-menu-renderer button') ||
                      songElement.querySelector('[aria-label*="More"]');
    
    if (!menuButton) {
      throw new Error('Could not find menu button for song');
    }
    
    menuButton.click();
    await sleep(500);
  }

  /**
   * Click "Add to playlist" option in menu
   */
  async function clickAddToPlaylist() {
    // Wait for menu to appear
    await waitForElement('ytmusic-menu-popup-renderer', 3000);
    
    // Find "Add to playlist" option
    const menuItems = document.querySelectorAll('ytmusic-menu-service-item-renderer');
    
    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('add to playlist') || text.includes('add to')) {
        item.click();
        await sleep(500);
        return;
      }
    }
    
    throw new Error('Could not find "Add to playlist" option');
  }

  /**
   * Select target playlist from the list
   * @param {string} playlistName 
   */
  async function selectTargetPlaylist(playlistName) {
    // Wait for playlist selection dialog
    await waitForElement('ytmusic-playlist-add-edit-option-renderer, tp-yt-paper-dialog', 5000);
    
    // Look for the target playlist
    const playlistItems = document.querySelectorAll('ytmusic-playlist-add-edit-option-renderer, ytmusic-simple-menu-header-renderer + * ytmusic-compact-button-renderer');
    
    const normalizedTarget = normalizeString(playlistName);
    
    for (const item of playlistItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes(normalizedTarget)) {
        item.click();
        await sleep(500);
        return;
      }
    }
    
    // If playlist not found in quick list, might need to search or create
    console.log('[YTMusic Migrator] Playlist not in quick list, may need manual selection');
  }

  /**
   * Normalize string for comparison
   * @param {string} str 
   * @returns {string}
   */
  function normalizeString(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 
   * @param {string} str2 
   * @returns {number}
   */
  function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    // Simple word-based similarity
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    let matches = 0;
    for (const word of words1) {
      if (words2.some(w => w.includes(word) || word.includes(w))) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }

  /**
   * Extract playlist ID from element
   * @param {Element} element 
   * @returns {string|null}
   */
  function extractPlaylistId(element) {
    // Try various attributes
    const idAttrs = ['playlist-id', 'data-playlist-id', 'id'];
    for (const attr of idAttrs) {
      const value = element.getAttribute(attr);
      if (value && value.startsWith('VL') || value.match(/^[a-zA-Z0-9_-]+$/)) {
        return value;
      }
    }
    
    // Try to extract from href
    const link = element.querySelector('a[href*="playlist"]');
    if (link) {
      const match = link.href.match(/playlist\?id=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    
    return null;
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
