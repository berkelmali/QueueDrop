// ============================================
// QueueDrop — Spotify API Client
// ============================================

const SpotifyAPI = (() => {
  const BASE_URL = 'https://api.spotify.com/v1';

  // Blacklist patterns for filtering out covers/karaoke
  const BLACKLIST_PATTERNS = /\b(karaoke|tribute|cover|instrumental|enstrümantal|8d audio|slowed|reverb|sped up|nightcore)\b/i;

  /**
   * Make an authenticated request to Spotify API.
   */
  async function apiRequest(endpoint, options = {}) {
    const token = await SpotifyAuth.getValidToken();
    if (!token) throw new Error('Giriş yapılmamış');

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
      await sleep(retryAfter * 1000);
      return apiRequest(endpoint, options);
    }

    if (response.status === 401) {
      // Token expired, try refresh
      await SpotifyAuth.refreshAccessToken();
      return apiRequest(endpoint, options);
    }

    if (response.status === 204) {
      return null; // No content (queue add success)
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData.error?.message || `API Hatası (${response.status})`;
      throw new Error(message);
    }

    return response.json();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current user profile.
   */
  async function getUserProfile() {
    const data = await apiRequest('/me');
    return {
      id: data.id,
      name: data.display_name,
      image: data.images?.[0]?.url || null,
      product: data.product, // 'premium' or 'free'
    };
  }

  /**
   * Get current playback state (active device info).
   */
  async function getPlaybackState() {
    try {
      const data = await apiRequest('/me/player');
      if (!data) return null;
      return {
        isPlaying: data.is_playing,
        device: data.device ? {
          id: data.device.id,
          name: data.device.name,
          type: data.device.type,
          isActive: data.device.is_active,
        } : null,
        currentTrack: data.item ? {
          name: data.item.name,
          artist: data.item.artists?.map(a => a.name).join(', '),
          album: data.item.album?.name,
          image: data.item.album?.images?.[0]?.url,
        } : null,
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Search for a track with smart matching.
   * Returns the best matching track and alternatives.
   *
   * @param {string} trackName
   * @param {string} artistName
   * @returns {Promise<{best: Object|null, alternatives: Array, confidence: string}>}
   */
  async function searchTrack(trackName, artistName) {
    // Build the search query with field filters
    let query;
    if (artistName) {
      query = `track:"${trackName}" artist:"${artistName}"`;
    } else {
      query = `track:"${trackName}"`;
    }

    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: '10',
      market: 'TR', // Turkey market for better Turkish music results
    });

    const data = await apiRequest(`/search?${params.toString()}`);
    const tracks = data?.tracks?.items || [];

    if (tracks.length === 0 && artistName) {
      // Fallback 1: Try without field filters (broader search)
      const fallbackParams = new URLSearchParams({
        q: `${trackName} ${artistName}`,
        type: 'track',
        limit: '10',
        market: 'TR',
      });
      const fallbackData = await apiRequest(`/search?${fallbackParams.toString()}`);
      const fallbackTracks = fallbackData?.tracks?.items || [];

      if (fallbackTracks.length === 0) {
        // Fallback 2: Try reversed (maybe user wrote Artist - Track)
        const reverseParams = new URLSearchParams({
          q: `track:"${artistName}" artist:"${trackName}"`,
          type: 'track',
          limit: '10',
          market: 'TR',
        });
        const reverseData = await apiRequest(`/search?${reverseParams.toString()}`);
        return scoreAndRank(reverseData?.tracks?.items || [], artistName, trackName);
      }

      return scoreAndRank(fallbackTracks, trackName, artistName);
    }

    return scoreAndRank(tracks, trackName, artistName);
  }

  /**
   * Score and rank search results to find the best match.
   */
  function scoreAndRank(tracks, trackName, artistName) {
    if (!tracks || tracks.length === 0) {
      return { best: null, alternatives: [], confidence: 'none' };
    }

    // Score each track
    const scored = tracks.map(track => {
      let score = 0;

      // 1. Artist match (most important)
      if (artistName) {
        const artistNames = track.artists.map(a => a.name);
        const bestArtistMatch = Math.max(
          ...artistNames.map(name => Parser.similarity(name, artistName))
        );
        score += bestArtistMatch * 40;
      }

      // 2. Track name match
      const titleSim = Parser.similarity(track.name, trackName);
      score += titleSim * 30;

      // 3. Popularity bonus (prefer popular = original)
      score += (track.popularity / 100) * 15;

      // 4. Penalty for karaoke/cover/tribute
      if (BLACKLIST_PATTERNS.test(track.name) || 
          track.artists.some(a => BLACKLIST_PATTERNS.test(a.name))) {
        score -= 30;
      }

      // 5. Penalty for remix (unless user specifically asked)
      const isRemix = /\b(remix|mix)\b/i.test(track.name);
      const userWantsRemix = /\b(remix|mix)\b/i.test(trackName);
      if (isRemix && !userWantsRemix) {
        score -= 10;
      }

      // 6. Bonus for exact title match
      if (Parser.fuzzyMatch(track.name, trackName)) {
        score += 10;
      }

      // 7. Album type bonus
      if (track.album?.album_type === 'album') score += 3;
      if (track.album?.album_type === 'single') score += 1;

      return {
        ...formatTrack(track),
        _score: score,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    const best = scored[0] || null;
    const alternatives = scored.slice(1, 5);

    // Determine confidence level
    let confidence = 'none';
    if (best) {
      if (best._score >= 70) confidence = 'high';
      else if (best._score >= 40) confidence = 'medium';
      else confidence = 'low';
    }

    return { best, alternatives, confidence };
  }

  /**
   * Format a Spotify track object into our simplified format.
   */
  function formatTrack(track) {
    return {
      uri: track.uri,
      id: track.id,
      name: track.name,
      artist: track.artists?.map(a => a.name).join(', ') || '',
      artistId: track.artists?.[0]?.id || '',
      album: track.album?.name || '',
      albumImage: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '',
      albumImageSmall: track.album?.images?.[2]?.url || track.album?.images?.[1]?.url || '',
      duration: track.duration_ms || 0,
      popularity: track.popularity || 0,
      previewUrl: track.preview_url || null,
      externalUrl: track.external_urls?.spotify || '',
    };
  }

  /**
   * Add a track to the user's playback queue.
   * @param {string} uri - Spotify track URI (e.g., "spotify:track:xxx")
   * @returns {Promise<boolean>}
   */
  async function addToQueue(uri) {
    const params = new URLSearchParams({ uri });
    await apiRequest(`/me/player/queue?${params.toString()}`, {
      method: 'POST',
    });
    return true;
  }

  /**
   * Add multiple tracks to queue sequentially with a small delay.
   * @param {Array<string>} uris - Array of Spotify track URIs
   * @param {Function} onProgress - Callback with (index, total, track)
   * @returns {Promise<{success: number, failed: number, errors: Array}>}
   */
  async function addMultipleToQueue(uris, onProgress) {
    let success = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < uris.length; i++) {
      try {
        await addToQueue(uris[i]);
        success++;
        if (onProgress) onProgress(i, uris.length, 'success');
      } catch (err) {
        failed++;
        errors.push({ index: i, uri: uris[i], error: err.message });
        if (onProgress) onProgress(i, uris.length, 'error');
      }

      // Small delay between requests to avoid rate limiting
      if (i < uris.length - 1) {
        await sleep(150);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Format milliseconds to mm:ss string.
   */
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format total duration to human-readable string.
   */
  function formatTotalDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes} dk`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} sa ${mins} dk`;
  }

  /**
   * Get the user's current playback queue.
   * Returns currently_playing track and queue array.
   */
  async function getQueue() {
    try {
      const data = await apiRequest('/me/player/queue');
      if (!data) return { currentlyPlaying: null, queue: [] };
      return {
        currentlyPlaying: data.currently_playing ? formatTrack(data.currently_playing) : null,
        queue: (data.queue || []).map(t => formatTrack(t)),
      };
    } catch (err) {
      console.error('getQueue error:', err);
      return { currentlyPlaying: null, queue: [] };
    }
  }

  /**
   * Get the currently playing track with progress info.
   */
  async function getCurrentlyPlaying() {
    try {
      const data = await apiRequest('/me/player/currently-playing');
      if (!data || !data.item) return null;
      return {
        track: formatTrack(data.item),
        isPlaying: data.is_playing,
        progressMs: data.progress_ms || 0,
        durationMs: data.item.duration_ms || 0,
        timestamp: data.timestamp,
      };
    } catch (err) {
      console.error('getCurrentlyPlaying error:', err);
      return null;
    }
  }

  /**
   * Toggle play/pause.
   */
  async function togglePlayPause(isCurrentlyPlaying) {
    if (isCurrentlyPlaying) {
      await apiRequest('/me/player/pause', { method: 'PUT' });
    } else {
      await apiRequest('/me/player/play', { method: 'PUT' });
    }
  }

  /**
   * Skip to the next track.
   */
  async function nextTrack() {
    await apiRequest('/me/player/next', { method: 'POST' });
  }

  /**
   * Skip to the previous track.
   */
  async function previousTrack() {
    await apiRequest('/me/player/previous', { method: 'POST' });
  }

  /**
   * Seek to a position in the current track.
   * @param {number} positionMs - Position in milliseconds
   */
  async function seekTo(positionMs) {
    const params = new URLSearchParams({ position_ms: Math.round(positionMs) });
    await apiRequest(`/me/player/seek?${params.toString()}`, { method: 'PUT' });
  }

  return {
    getUserProfile,
    getPlaybackState,
    searchTrack,
    addToQueue,
    addMultipleToQueue,
    formatDuration,
    formatTotalDuration,
    getQueue,
    getCurrentlyPlaying,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpotifyAPI;
}
