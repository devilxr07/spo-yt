/**
 * Popup Main Script
 * Handles UI interactions for Export and Import tabs
 */

// Import utilities
import { showToastNotification } from './components/toast.js';

// State management
const state = {
  currentTab: 'export',
  exportedSongs: [],
  playlistInfo: null,
  importedCSV: null,
  importQueue: [],
  isImporting: false
};

// DOM Elements
const elements = {};

/**
 * Initialize the popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  setupTabNavigation();
  loadSavedState();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
  // Tabs
  elements.tabBtns = document.querySelectorAll('.tab-btn');
  elements.exportTab = document.getElementById('export-tab');
  elements.importTab = document.getElementById('import-tab');
  
  // Export elements
  elements.spotifyStatus = document.getElementById('spotify-status');
  elements.playlistName = document.getElementById('playlist-name');
  elements.songsCount = document.getElementById('songs-count');
  elements.exportProgressContainer = document.getElementById('export-progress-container');
  elements.exportProgress = document.getElementById('export-progress');
  elements.exportProgressText = document.getElementById('export-progress-text');
  elements.startExportBtn = document.getElementById('start-export-btn');
  elements.downloadCsvBtn = document.getElementById('download-csv-btn');
  elements.songsPreview = document.getElementById('songs-preview');
  elements.songsList = document.getElementById('songs-list');
  
  // Import elements
  elements.uploadArea = document.getElementById('upload-area');
  elements.csvInput = document.getElementById('csv-input');
  elements.csvPreview = document.getElementById('csv-preview');
  elements.totalSongs = document.getElementById('total-songs');
  elements.validSongs = document.getElementById('valid-songs');
  elements.invalidSongs = document.getElementById('invalid-songs');
  elements.previewTableBody = document.getElementById('preview-table-body');
  elements.clearCsvBtn = document.getElementById('clear-csv-btn');
  elements.importConfig = document.getElementById('import-config');
  elements.playlistNameInput = document.getElementById('playlist-name-input');
  elements.startImportBtn = document.getElementById('start-import-btn');
  elements.importProgress = document.getElementById('import-progress');
  elements.importCompleted = document.getElementById('import-completed');
  elements.importFailed = document.getElementById('import-failed');
  elements.importRemaining = document.getElementById('import-remaining');
  elements.importEta = document.getElementById('import-eta');
  elements.importProgressBar = document.getElementById('import-progress-bar');
  elements.importPercentage = document.getElementById('import-percentage');
  elements.currentSongTitle = document.getElementById('current-song-title');
  elements.logsContent = document.getElementById('logs-content');
  elements.cancelImportBtn = document.getElementById('cancel-import-btn');
  elements.clearLogsBtn = document.getElementById('clear-logs-btn');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Export buttons
  elements.startExportBtn.addEventListener('click', handleStartExport);
  elements.downloadCsvBtn.addEventListener('click', handleDownloadCSV);
  
  // Import - File upload
  elements.uploadArea.addEventListener('click', () => elements.csvInput.click());
  elements.csvInput.addEventListener('change', handleFileSelect);
  
  // Drag and drop
  elements.uploadArea.addEventListener('dragover', handleDragOver);
  elements.uploadArea.addEventListener('dragleave', handleDragLeave);
  elements.uploadArea.addEventListener('drop', handleDrop);
  
  // Import buttons
  elements.clearCsvBtn.addEventListener('click', handleClearCSV);
  elements.startImportBtn.addEventListener('click', handleStartImport);
  elements.cancelImportBtn.addEventListener('click', handleCancelImport);
  elements.clearLogsBtn.addEventListener('click', handleClearLogs);
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

/**
 * Switch between tabs
 * @param {string} tabName 
 */
function switchTab(tabName) {
  state.currentTab = tabName;
  
  // Update button states
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content visibility
  elements.exportTab.classList.toggle('active', tabName === 'export');
  elements.importTab.classList.toggle('active', tabName === 'import');
  
  // Save current tab to storage
  chrome.storage.local.set({ currentTab: tabName });
}

/**
 * Load saved state from storage
 */
async function loadSavedState() {
  try {
    const result = await chrome.storage.local.get(['currentTab', 'exportedSongs', 'playlistInfo']);
    
    if (result.currentTab) {
      switchTab(result.currentTab);
    }
    
    if (result.exportedSongs && result.exportedSongs.length > 0) {
      state.exportedSongs = result.exportedSongs;
      state.playlistInfo = result.playlistInfo;
      updateExportUI(true);
    }
  } catch (error) {
    console.error('Error loading saved state:', error);
  }
}

/**
 * Handle start export button click
 */
async function handleStartExport() {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on a Spotify playlist page
    if (!tab.url || !tab.url.includes('open.spotify.com/playlist/')) {
      showErrorToast('Not on Spotify Playlist', 'Please open a Spotify playlist page first');
      
      // Open Spotify in new tab
      setTimeout(async () => {
        await chrome.tabs.create({ url: 'https://open.spotify.com' });
      }, 2000);
      
      return;
    }
    
    // Start export process
    setExportStatus('processing', 'Extracting...');
    elements.startExportBtn.disabled = true;
    elements.exportProgressContainer.style.display = 'block';
    
    // Send message to content script to start extraction
    chrome.tabs.sendMessage(tab.id, { action: 'extractPlaylist' });
    
  } catch (error) {
    console.error('Export error:', error);
    showErrorToast('Export Failed', error.message);
    resetExportUI();
  }
}

/**
 * Handle background script messages
 * @param {Object} message 
 */
function handleBackgroundMessage(message, sender, sendResponse) {
  console.log('Popup received message:', message);
  
  switch (message.action) {
    case 'exportProgress':
      updateExportProgress(message.progress, message.total, message.message);
      break;
      
    case 'exportComplete':
      handleExportComplete(message.songs, message.playlistInfo);
      break;
      
    case 'exportError':
      handleExportError(message.error);
      break;
      
    case 'importProgress':
      updateImportProgress(message);
      break;
      
    case 'importLog':
      addImportLog(message.type, message.message);
      break;
      
    case 'importComplete':
      handleImportComplete(message.stats);
      break;
      
    case 'importError':
      handleImportError(message.error);
      break;
      
    case 'playlistNotFound':
      handlePlaylistNotFound();
      break;
  }
  
  sendResponse({ received: true });
}

/**
 * Update export progress UI
 * @param {number} progress 
 * @param {number} total 
 * @param {string} message 
 */
function updateExportProgress(progress, total, message) {
  const percentage = total > 0 ? (progress / total) * 100 : 0;
  elements.exportProgress.style.width = `${percentage}%`;
  elements.exportProgressText.textContent = message || `Loading ${progress}/${total} songs...`;
}

/**
 * Handle export completion
 * @param {Array} songs 
 * @param {Object} playlistInfo 
 */
function handleExportComplete(songs, playlistInfo) {
  state.exportedSongs = songs;
  state.playlistInfo = playlistInfo;
  
  // Save to storage
  chrome.storage.local.set({
    exportedSongs: songs,
    playlistInfo: playlistInfo
  });
  
  updateExportUI(true);
  showSuccessToast('Export Complete', `${songs.length} songs exported successfully`);
}

/**
 * Handle export error
 * @param {string} error 
 */
function handleExportError(error) {
  showErrorToast('Export Failed', error || 'Unknown error occurred');
  resetExportUI();
}

/**
 * Update export UI after completion
 * @param {boolean} success 
 */
function updateExportUI(success = false) {
  elements.startExportBtn.disabled = false;
  elements.exportProgressContainer.style.display = 'none';
  
  if (success && state.exportedSongs.length > 0) {
    setExportStatus('success', 'Ready');
    elements.playlistName.textContent = state.playlistInfo?.name || 'Unknown Playlist';
    elements.songsCount.textContent = state.exportedSongs.length;
    elements.downloadCsvBtn.disabled = false;
    
    // Show songs preview
    renderSongsPreview();
  } else {
    setExportStatus('error', 'Failed');
  }
}

/**
 * Reset export UI to initial state
 */
function resetExportUI() {
  elements.startExportBtn.disabled = false;
  elements.exportProgressContainer.style.display = 'none';
  elements.exportProgress.style.width = '0%';
  setExportStatus('waiting', 'Waiting...');
  elements.playlistName.textContent = '-';
  elements.songsCount.textContent = '-';
  elements.downloadCsvBtn.disabled = true;
  elements.songsPreview.style.display = 'none';
}

/**
 * Set export status badge
 * @param {string} status 
 * @param {string} text 
 */
function setExportStatus(status, text) {
  elements.spotifyStatus.className = `status-badge ${status}`;
  elements.spotifyStatus.textContent = text;
}

/**
 * Render songs preview list
 */
function renderSongsPreview() {
  elements.songsList.innerHTML = '';
  const previewSongs = state.exportedSongs.slice(0, 50); // Show max 50 songs
  
  previewSongs.forEach((song, index) => {
    const songItem = document.createElement('div');
    songItem.className = 'song-item';
    songItem.innerHTML = `
      <div class="song-number">${index + 1}</div>
      <div class="song-details">
        <div class="song-title">${escapeHtml(song.name)}</div>
        <div class="song-artist">${escapeHtml(song.artist)}</div>
      </div>
    `;
    elements.songsList.appendChild(songItem);
  });
  
  elements.songsPreview.style.display = 'block';
}

/**
 * Handle CSV download
 */
function handleDownloadCSV() {
  if (state.exportedSongs.length === 0) return;
  
  const csvContent = window.CSVParser.generateCSV(
    state.exportedSongs,
    state.playlistInfo?.name
  );
  
  const filename = `spotify_playlist_${window.helpers.sanitizeFilename(state.playlistInfo?.name || 'unknown')}.csv`;
  window.CSVParser.downloadCSV(csvContent, filename);
  
  showSuccessToast('Download Started', filename);
}

/**
 * Handle file selection for import
 * @param {Event} event 
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    await processCSVFile(file);
  }
}

/**
 * Handle drag over
 * @param {Event} event 
 */
function handleDragOver(event) {
  event.preventDefault();
  elements.uploadArea.classList.add('drag-over');
}

/**
 * Handle drag leave
 * @param {Event} event 
 */
function handleDragLeave(event) {
  event.preventDefault();
  elements.uploadArea.classList.remove('drag-over');
}

/**
 * Handle drop
 * @param {Event} event 
 */
async function handleDrop(event) {
  event.preventDefault();
  elements.uploadArea.classList.remove('drag-over');
  
  const file = event.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    await processCSVFile(file);
  } else {
    showErrorToast('Invalid File', 'Please drop a CSV file');
  }
}

/**
 * Process uploaded CSV file
 * @param {File} file 
 */
async function processCSVFile(file) {
  try {
    const csvText = await window.CSVParser.readCSVFile(file);
    const parsedRows = window.CSVParser.parseCSV(csvText);
    const validation = window.CSVParser.validateCSV(parsedRows);
    
    if (!validation.isValid) {
      showErrorToast('Invalid CSV', validation.error);
      return;
    }
    
    state.importedCSV = validation;
    state.importQueue = [...validation.validRows];
    
    updateCSVPreview(validation);
    showSuccessToast('CSV Loaded', `${validation.validRows.length} valid songs found`);
    
  } catch (error) {
    console.error('CSV processing error:', error);
    showErrorToast('Error', 'Failed to process CSV file');
  }
}

/**
 * Update CSV preview UI
 * @param {Object} validation 
 */
function updateCSVPreview(validation) {
  elements.uploadArea.style.display = 'none';
  elements.csvPreview.style.display = 'block';
  elements.importConfig.style.display = 'block';
  
  elements.totalSongs.textContent = validation.totalRows;
  elements.validSongs.textContent = validation.validRows.length;
  elements.invalidSongs.textContent = validation.invalidRows.length;
  
  // Render preview table
  elements.previewTableBody.innerHTML = '';
  const previewRows = validation.validRows.slice(0, 20);
  
  previewRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row['song name'] || '-')}</td>
      <td>${escapeHtml(row.artist || '-')}</td>
      <td>${escapeHtml(row.album || '-')}</td>
      <td class="status-cell valid">✓</td>
    `;
    elements.previewTableBody.appendChild(tr);
  });
}

/**
 * Handle clear CSV
 */
function handleClearCSV() {
  state.importedCSV = null;
  state.importQueue = [];
  
  elements.uploadArea.style.display = 'block';
  elements.csvPreview.style.display = 'none';
  elements.importConfig.style.display = 'none';
  elements.importProgress.style.display = 'none';
  
  elements.csvInput.value = '';
}

/**
 * Handle start import
 */
async function handleStartImport() {
  const playlistName = elements.playlistNameInput.value.trim();
  
  if (!playlistName) {
    showErrorToast('Missing Playlist Name', 'Please enter the target playlist name');
    return;
  }
  
  if (state.importQueue.length === 0) {
    showErrorToast('No Songs', 'No songs to import');
    return;
  }
  
  // Start import process
  state.isImporting = true;
  elements.importConfig.style.display = 'none';
  elements.importProgress.style.display = 'block';
  elements.cancelImportBtn.disabled = false;
  
  // Reset stats
  updateImportStats(0, 0, state.importQueue.length, '--:--');
  elements.importProgressBar.style.width = '0%';
  elements.importPercentage.textContent = '0%';
  
  // Send message to background script to start import
  chrome.runtime.sendMessage({
    action: 'startImport',
    songs: state.importQueue,
    playlistName: playlistName
  });
  
  showInfoToast('Import Started', 'Opening YouTube Music...');
}

/**
 * Update import progress
 * @param {Object} data 
 */
function updateImportProgress(data) {
  const { completed, failed, remaining, total, currentSong, eta } = data;
  
  updateImportStats(completed, failed, remaining, eta);
  
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  elements.importProgressBar.style.width = `${percentage}%`;
  elements.importPercentage.textContent = `${percentage}%`;
  
  if (currentSong) {
    elements.currentSongTitle.textContent = `${currentSong.name} - ${currentSong.artist}`;
  }
}

/**
 * Update import stats
 * @param {number} completed 
 * @param {number} failed 
 * @param {number} remaining 
 * @param {string} eta 
 */
function updateImportStats(completed, failed, remaining, eta) {
  elements.importCompleted.textContent = completed;
  elements.importFailed.textContent = failed;
  elements.importRemaining.textContent = remaining;
  elements.importEta.textContent = eta;
}

/**
 * Add import log entry
 * @param {string} type 
 * @param {string} message 
 */
function addImportLog(type, message) {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '•';
  
  logEntry.innerHTML = `
    <span class="log-timestamp">${timestamp}</span>
    <span class="log-icon">${icon}</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;
  
  elements.logsContent.appendChild(logEntry);
  elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
}

/**
 * Handle import complete
 * @param {Object} stats 
 */
function handleImportComplete(stats) {
  state.isImporting = false;
  elements.cancelImportBtn.disabled = true;
  
  showSuccessToast(
    'Import Complete',
    `${stats.completed} songs imported, ${stats.failed} failed`
  );
}

/**
 * Handle import error
 * @param {string} error 
 */
function handleImportError(error) {
  state.isImporting = false;
  elements.cancelImportBtn.disabled = true;
  showErrorToast('Import Error', error);
}

/**
 * Handle playlist not found
 */
function handlePlaylistNotFound() {
  state.isImporting = false;
  elements.cancelImportBtn.disabled = true;
  elements.importProgress.style.display = 'none';
  elements.importConfig.style.display = 'block';
  
  showErrorToast(
    'Playlist Not Found',
    'The specified playlist was not found on YouTube Music. Import terminated.'
  );
}

/**
 * Handle cancel import
 */
function handleCancelImport() {
  if (!state.isImporting) return;
  
  chrome.runtime.sendMessage({ action: 'cancelImport' });
  showWarningToast('Import Cancelled', 'Stopping import process...');
}

/**
 * Handle clear logs
 */
function handleClearLogs() {
  elements.logsContent.innerHTML = '';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text 
 * @returns {string} 
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show error toast notification
 * @param {string} title 
 * @param {string} message 
 */
function showErrorToast(title, message) {
  showNotification('error', title, message);
}

/**
 * Show success toast notification
 * @param {string} title 
 * @param {string} message 
 */
function showSuccessToast(title, message) {
  showNotification('success', title, message);
}

/**
 * Show info toast notification
 * @param {string} title 
 * @param {string} message 
 */
function showInfoToast(title, message) {
  showNotification('info', title, message);
}

/**
 * Show warning toast notification
 * @param {string} title 
 * @param {string} message 
 */
function showWarningToast(title, message) {
  showNotification('warning', title, message);
}

/**
 * Show toast notification
 * @param {string} type - 'error', 'success', 'info', 'warning'
 * @param {string} title 
 * @param {string} message 
 */
function showNotification(type, title, message) {
  // Use the imported toast function if available
  if (typeof showToastNotification === 'function') {
    showToastNotification(type, title, message);
    return;
  }
  
  // Fallback: Create toast element if it doesn't exist
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  
  // Set toast content and style
  const iconMap = {
    error: '❌',
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  toast.className = `toast-notification ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${iconMap[type] || 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;
  
  // Show toast
  toast.classList.add('show');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}
