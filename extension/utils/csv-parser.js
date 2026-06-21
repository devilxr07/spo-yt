/**
 * CSV Parser Utility
 * Handles parsing and generating CSV files with proper escaping
 */

/**
 * Parse CSV string into array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array<Object>} Array of row objects
 */
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return [];
  }
  
  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Create object from headers and values
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim().toLowerCase();
      row[header] = values[j] || '';
    }
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line handling quoted fields
 * @param {string} line
 * @returns {Array<string>}
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

/**
 * Validate CSV structure for playlist migration
 * @param {Array<Object>} rows - Parsed CSV rows
 * @returns {Object} Validation result
 */
export function validateCSV(rows) {
  const requiredColumns = ['song name', 'artist'];
  const validRows = [];
  const invalidRows = [];
  
  // Check if we have any data
  if (rows.length === 0) {
    return {
      isValid: false,
      error: 'CSV file is empty',
      validRows: [],
      invalidRows: [],
      totalRows: 0
    };
  }
  
  // Check for required columns in first row
  const firstRow = rows[0];
  const missingColumns = requiredColumns.filter(col => !(col in firstRow));
  
  if (missingColumns.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missingColumns.join(', ')}`,
      validRows: [],
      invalidRows: [],
      totalRows: rows.length
    };
  }
  
  // Validate each row
  rows.forEach((row, index) => {
    const songName = (row['song name'] || '').trim();
    const artist = (row.artist || '').trim();
    
    if (songName && artist) {
      validRows.push({
        ...row,
        _index: index,
        _status: 'valid'
      });
    } else {
      invalidRows.push({
        ...row,
        _index: index,
        _status: 'invalid',
        _error: songName ? 'Missing artist' : 'Missing song name'
      });
    }
  });
  
  return {
    isValid: validRows.length > 0,
    error: null,
    validRows,
    invalidRows,
    totalRows: rows.length
  };
}

/**
 * Generate CSV from array of song objects
 * @param {Array<Object>} songs - Array of song objects
 * @param {string} playlistName - Name of the playlist
 * @returns {string} CSV string
 */
export function generateCSV(songs, playlistName = 'playlist') {
  const headers = ['Song Name', 'Artist', 'Album', 'Duration'];
  
  const rows = songs.map(song => [
    escapeField(song.name || song.title || ''),
    escapeField(song.artist || ''),
    escapeField(song.album || ''),
    escapeField(song.duration || '')
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Escape a CSV field properly
 * @param {string} field
 * @returns {string}
 */
function escapeField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  
  const str = String(field);
  
  // If field contains special characters, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Read CSV file from File object
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Get column names from CSV
 * @param {string} csvText
 * @returns {Array<string>}
 */
export function getCSVColumns(csvText) {
  const firstLine = csvText.split(/\r?\n/)[0];
  return parseCSVLine(firstLine);
}

// Export functions
window.CSVParser = {
  parseCSV,
  validateCSV,
  generateCSV,
  downloadCSV,
  readCSVFile,
  getCSVColumns
};

// Export for module usage
export {
  parseCSV,
  validateCSV,
  generateCSV,
  downloadCSV,
  readCSVFile,
  getCSVColumns
};
