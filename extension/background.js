/**
 * Background Service Worker
 * Orchestrates export/import operations, manages tabs, and handles state persistence
 */

// Import state management
let importState = {
  isRunning: false,
  songs: [],
  currentIndex: 0,
  completed: 0,
  failed: 0,
  playlistName: null,
  startTime: null,
  cancelled: false
};

// Tab management
const managedTabs = new Set();

/**
 * Initialize the service worker
 */
self.addEventListener('install', () => {
  console.log('[Background] Service Worker installed');
  // Clean up any stale state
  chrome.storage.local.remove(['importState', 'exportState']);
});

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);

  switch (message.action) {
    case 'startImport':
      startImport(message.songs, message.playlistName)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'cancelImport':
      cancelImport();
      sendResponse({ cancelled: true });
      break;

    case 'getImportState':
      sendResponse({ state: importState });
      break;

    case 'exportProgress':
    case 'exportComplete':
    case 'exportError':
      // Forward to popup
      forwardToPopup(message);
      sendResponse({ received: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

/**
 * Start the import process
 * @param {Array} songs - Array of song objects
 * @param {string} playlistName - Target playlist name
 */
async function startImport(songs, playlistName) {
  if (importState.isRunning) {
    throw new Error('Import already in progress');
  }

  console.log('[Background] Starting import:', { 
    songCount: songs.length, 
    playlistName 
  });

  // Initialize state
  importState = {
    isRunning: true,
    songs: songs,
    currentIndex: 0,
    completed: 0,
    failed: 0,
    playlistName: playlistName,
    startTime: Date.now(),
    cancelled: false
  };

  // Save state to storage for persistence
  await saveImportState();

  // Send initial log
  sendLog('info', `Starting import of ${songs.length} songs to "${playlistName}"`);

  try {
    // Step 1: Open YouTube Music and search for playlist
    const ytmusicTab = await openYouTubeMusic();
    
    // Step 2: Search for the target playlist
    sendLog('info', `Searching for playlist: "${playlistName}"...`);
    
    const playlistFound = await searchForPlaylist(ytmusicTab.id, playlistName);
    
    if (!playlistFound) {
      // Playlist not found - terminate entire process
      sendLog('error', `Playlist "${playlistName}" not found. Import terminated.`);
      
      // Notify popup
      chrome.runtime.sendMessage({ 
        action: 'playlistNotFound',
        playlistName: playlistName
      }).catch(() => {}); // Ignore if popup is closed
      
      await closeManagedTabs();
      importState.isRunning = false;
      return;
    }

    sendLog('success', `Playlist "${playlistName}" found! Starting song import...`);

    // Step 3: Process each song sequentially
    await processSongs(ytmusicTab.id);

    // Step 4: Import complete
    await handleImportComplete();

  } catch (error) {
    console.error('[Background] Import error:', error);
    sendLog('error', `Import failed: ${error.message}`);
    
    chrome.runtime.sendMessage({ 
      action: 'importError', 
      error: error.message 
    }).catch(() => {});
    
    await closeManagedTabs();
    importState.isRunning = false;
  }
}

/**
 * Open YouTube Music in a new tab
 * @returns {Promise<Object>} Tab object
 */
async function openYouTubeMusic() {
  sendLog('info', 'Opening YouTube Music...');
  
  const tab = await chrome.tabs.create({ 
    url: 'https://music.youtube.com/',
    active: false
  });
  
  managedTabs.add(tab.id);
  
  // Wait for page to load
  await waitForTabLoad(tab.id);
  
  return tab;
}

/**
 * Wait for a tab to finish loading
 * @param {number} tabId 
 */
async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    // Timeout after 15 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

/**
 * Search for playlist on YouTube Music
 * @param {number} tabId 
 * @param {string} playlistName 
 * @returns {Promise<boolean>}
 */
async function searchForPlaylist(tabId, playlistName) {
  try {
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/ytmusic.js']
    });

    // Send search command
    const result = await chrome.tabs.sendMessage(tabId, {
      action: 'searchPlaylist',
      playlistName: playlistName
    });

    return result.success && result.found;

  } catch (error) {
    console.error('[Background] Search playlist error:', error);
    return false;
  }
}

/**
 * Process all songs sequentially
 * @param {number} tabId 
 */
async function processSongs(tabId) {
  const totalSongs = importState.songs.length;

  while (importState.currentIndex < totalSongs && !importState.cancelled) {
    const song = importState.songs[importState.currentIndex];
    
    sendLog('info', `Processing (${importState.currentIndex + 1}/${totalSongs}): ${song.name} - ${song.artist}`);
    
    // Update progress
    updateProgress();

    try {
      // Create new tab for each song search
      const songTab = await chrome.tabs.create({
        url: `https://music.youtube.com/search?q=${encodeURIComponent(song.name + ' ' + song.artist)}`,
        active: false
      });
      
      managedTabs.add(songTab.id);
      
      // Wait for page load
      await waitForTabLoad(songTab.id);
      await sleep(1500); // Extra wait for dynamic content

      // Inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: songTab.id },
          files: ['content/ytmusic.js']
        });
      } catch (e) {
        console.warn('[Background] Script injection failed:', e);
      }

      // Try to add song to playlist
      const added = await tryAddSong(songTab.id, song);
      
      if (added) {
        importState.completed++;
        sendLog('success', `Added: ${song.name} - ${song.artist}`);
      } else {
        importState.failed++;
        sendLog('warning', `Could not find: ${song.name} - ${song.artist}`);
      }

      // Close the song tab
      await safeCloseTab(songTab.id);
      managedTabs.delete(songTab.id);

    } catch (error) {
      console.error('[Background] Song processing error:', error);
      importState.failed++;
      sendLog('error', `Failed: ${song.name} - ${song.artist} (${error.message})`);
    }

    importState.currentIndex++;
    
    // Save state periodically
    if (importState.currentIndex % 5 === 0) {
      await saveImportState();
    }

    // Small delay between songs to avoid rate limiting
    await sleep(1000);
  }
}

/**
 * Try to add a song to the playlist
 * @param {number} tabId 
 * @param {Object} song 
 * @returns {Promise<boolean>}
 */
async function tryAddSong(tabId, song) {
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      action: 'addSongToPlaylist',
      song: song,
      playlistName: importState.playlistName
    });

    return result.success;

  } catch (error) {
    console.warn('[Background] Add song failed:', error);
    return false;
  }
}

/**
 * Handle import completion
 */
async function handleImportComplete() {
  importState.isRunning = false;
  
  const stats = {
    total: importState.songs.length,
    completed: importState.completed,
    failed: importState.failed,
    duration: Date.now() - importState.startTime
  };

  sendLog('success', `Import complete! ${stats.completed}/${stats.total} songs added successfully.`);

  // Notify popup
  chrome.runtime.sendMessage({ 
    action: 'importComplete', 
    stats: stats 
  }).catch(() => {});

  // Clean up
  await closeManagedTabs();
  await chrome.storage.local.remove(['importState']);
}

/**
 * Cancel the import process
 */
function cancelImport() {
  importState.cancelled = true;
  sendLog('warning', 'Cancelling import...');
}

/**
 * Update progress and notify popup
 */
function updateProgress() {
  const total = importState.songs.length;
  const remaining = total - importState.currentIndex;
  const elapsed = Date.now() - importState.startTime;
  
  const eta = calculateETA(importState.currentIndex, total, elapsed);
  
  const currentSong = importState.songs[importState.currentIndex];

  chrome.runtime.sendMessage({
    action: 'importProgress',
    completed: importState.completed,
    failed: importState.failed,
    remaining: remaining,
    total: total,
    currentSong: currentSong,
    eta: eta
  }).catch(() => {});
}

/**
 * Calculate ETA
 * @param {number} completed 
 * @param {number} total 
 * @param {number} elapsedMs 
 * @returns {string}
 */
function calculateETA(completed, total, elapsedMs) {
  if (completed === 0 || total === 0) return '--:--';
  
  const remaining = total - completed;
  const avgTimePerItem = elapsedMs / completed;
  const estimatedRemainingMs = remaining * avgTimePerItem;
  
  const minutes = Math.floor(estimatedRemainingMs / 60000);
  const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Send log message to popup
 * @param {string} type 
 * @param {string} message 
 */
function sendLog(type, message) {
  chrome.runtime.sendMessage({
    action: 'importLog',
    type: type,
    message: message
  }).catch(() => {});
}

/**
 * Forward message to popup
 * @param {Object} message 
 */
function forwardToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

/**
 * Save import state to storage
 */
async function saveImportState() {
  await chrome.storage.local.set({ importState });
}

/**
 * Close all managed tabs
 */
async function closeManagedTabs() {
  for (const tabId of managedTabs) {
    await safeCloseTab(tabId);
  }
  managedTabs.clear();
}

/**
 * Safely close a tab
 * @param {number} tabId 
 */
async function safeCloseTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    console.warn('[Background] Failed to close tab:', tabId, error);
  }
}

/**
 * Sleep utility
 * @param {number} ms 
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle tab removal cleanup
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  managedTabs.delete(tabId);
});

console.log('[Background] Service Worker initialized');
