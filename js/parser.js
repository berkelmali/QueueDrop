// ============================================
// QueueDrop — Text Parser
// ============================================

const Parser = (() => {

  // Song-to-song separators (between queue items)
  const SONG_SEPARATORS = /\s*(?:→|➡️?|➜|➤|⟶|->|>>|;)\s*/;

  // Track-artist separator (within a single item)
  // Matches: " - ", " – ", " — ", " : " (with at least one space on each side to avoid splitting compound names)
  const TRACK_ARTIST_SEPARATOR = /\s+[-–—:]\s+/;

  /**
   * Normalize Turkish characters to ASCII equivalents for fuzzy matching.
   * @param {string} str
   * @returns {string}
   */
  function normalizeTurkish(str) {
    if (!str) return '';
    return str
      .replace(/ğ/gi, 'g')
      .replace(/ü/gi, 'u')
      .replace(/ş/gi, 's')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ö/gi, 'o')
      .replace(/ç/gi, 'c')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Parse a multi-song input string into individual track-artist pairs.
   * Supports multiple formats:
   *   - "Canın Sağolsun - Gülşen → Dan Dan - Gülşen"
   *   - One song per line
   *   - Mixed separators
   *
   * @param {string} input - Raw user input text
   * @returns {Array<{track: string, artist: string, raw: string, index: number}>}
   */
  function parse(input) {
    if (!input || !input.trim()) return [];

    const results = [];
    
    // First split by newlines, then by song separators
    const lines = input.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    let allItems = [];
    for (const line of lines) {
      // Split each line by song separators
      const parts = line.split(SONG_SEPARATORS).map(p => p.trim()).filter(p => p.length > 0);
      allItems.push(...parts);
    }

    // Parse each item into track + artist
    allItems.forEach((item, index) => {
      const parsed = parseTrackArtist(item);
      if (parsed) {
        results.push({
          ...parsed,
          raw: item,
          index: index,
        });
      }
    });

    return results;
  }

  /**
   * Parse a single "Track - Artist" or "Artist - Track" string.
   * @param {string} item
   * @returns {{track: string, artist: string} | null}
   */
  function parseTrackArtist(item) {
    if (!item || !item.trim()) return null;

    let clean = item.trim();

    // 0. Check for Spotify track URL or URI:
    // e.g. "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=..."
    // or "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
    const spotifyMatch = clean.match(/(?:https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([a-zA-Z0-9]{22})/i);
    if (spotifyMatch) {
      return {
        track: clean,
        artist: '',
        spotifyId: spotifyMatch[1]
      };
    }

    // 1. Remove leading list numbering (e.g. "1.", "1)", "1-", "[1]", "•")
    clean = clean.replace(/^\s*(?:\d+[\.\)\-:]\s*|\[\d+\]\s*|[•*]\s*)/, '');

    // 2. Try spaced separator first: "Track - Artist" or "Track – Artist" or "Track : Artist"
    const spacedMatch = clean.split(/\s+[-–—:]\s+/);
    if (spacedMatch.length >= 2) {
      const track = spacedMatch[0].trim();
      const artist = spacedMatch.slice(1).join(' - ').trim();
      if (track && artist) {
        return { track, artist };
      }
    }

    // 3. Try unspaced separator (e.g. "Canın Sağolsun-gülşen", "Dan Dan-gülşen")
    // Only attempt if the item has spaces (multi-word expression) and neither side is a single letter,
    // to avoid splitting single compound words or hyphenated names like "Spider-Man", "Jay-Z", "T-Pain".
    const dashIdx = clean.lastIndexOf('-');
    const enDashIdx = clean.lastIndexOf('–');
    const emDashIdx = clean.lastIndexOf('—');
    const colonIdx = clean.lastIndexOf(':');
    const sepIdx = Math.max(dashIdx, enDashIdx, emDashIdx, colonIdx);

    if (sepIdx > 0 && sepIdx < clean.length - 1) {
      const part1 = clean.substring(0, sepIdx).trim();
      const part2 = clean.substring(sepIdx + 1).trim();
      const hasSpaces = clean.includes(' ');
      const isSingleInitial = part1.length <= 1 || part2.length <= 1;

      if (part1 && part2 && hasSpaces && !isSingleInitial) {
        return { track: part1, artist: part2 };
      }
    }

    // 4. If no separator found, treat the whole thing as track name
    if (clean) {
      return { track: clean, artist: '' };
    }

    return null;
  }

  /**
   * Check if two strings are similar (fuzzy match) after Turkish normalization.
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  function fuzzyMatch(a, b) {
    const na = normalizeTurkish(a).toLowerCase().trim();
    const nb = normalizeTurkish(b).toLowerCase().trim();
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  /**
   * Calculate similarity score between two strings (0-1).
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function similarity(a, b) {
    const na = normalizeTurkish(a).toLowerCase().trim();
    const nb = normalizeTurkish(b).toLowerCase().trim();

    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.8;

    // Levenshtein-based similarity for close matches
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1;
    const dist = levenshtein(na, nb);
    return 1 - (dist / maxLen);
  }

  /**
   * Basic Levenshtein distance.
   */
  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Validate parsed items and return validation info.
   * @param {Array} items
   * @returns {{valid: Array, warnings: Array}}
   */
  function validate(items) {
    const valid = [];
    const warnings = [];

    items.forEach((item, i) => {
      if (!item.track) {
        warnings.push({ index: i, message: 'Şarkı adı bulunamadı', item });
      } else if (item.spotifyId) {
        valid.push(item);
      } else if (!item.artist) {
        warnings.push({ index: i, message: 'Sanatçı adı bulunamadı (yalnızca şarkı adıyla aranacak)', item });
        valid.push(item);
      } else {
        valid.push(item);
      }
    });

    return { valid, warnings };
  }

  return {
    parse,
    parseTrackArtist,
    normalizeTurkish,
    fuzzyMatch,
    similarity,
    validate,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parser;
}
