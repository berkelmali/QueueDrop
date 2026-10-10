// ============================================
// QueueDrop — UI Helpers
// ============================================

const UI = (() => {

  /**
   * Show a specific screen and hide others.
   */
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      // Trigger entrance animation
      target.style.opacity = '0';
      requestAnimationFrame(() => {
        target.style.transition = 'opacity 0.3s ease';
        target.style.opacity = '1';
      });
    }
  }

  /**
   * Create a track card element.
   */
  function createTrackCard(track, index, options = {}) {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.dataset.index = index;

    let statusIcon = '✅';
    let statusClass = '';
    if (options.confidence === 'low') {
      statusIcon = '⚠️';
      statusClass = 'warning';
    } else if (options.confidence === 'none' || !track) {
      statusIcon = '❌';
      statusClass = 'error';
    }

    if (statusClass) card.classList.add(statusClass);

    if (!track) {
      card.innerHTML = `
        <div class="track-card-number">${index + 1}</div>
        <div class="track-card-art">
          <div class="art-placeholder">🎵</div>
        </div>
        <div class="track-card-info">
          <div class="track-card-title" style="color: var(--color-error)">Bulunamadı</div>
          <div class="track-card-artist">${options.raw || 'Bilinmeyen şarkı'}</div>
        </div>
        <div class="track-card-meta">
          <div class="track-card-status">${statusIcon}</div>
        </div>
      `;
      return card;
    }

    const duration = SpotifyAPI.formatDuration(track.duration);

    card.innerHTML = `
      <div class="track-card-number">${index + 1}</div>
      <div class="track-card-art">
        ${track.albumImageSmall 
          ? `<img src="${track.albumImageSmall}" alt="${track.album}" loading="lazy">`
          : '<div class="art-placeholder">🎵</div>'
        }
      </div>
      <div class="track-card-info">
        <div class="track-card-title">${escapeHtml(track.name)}</div>
        <div class="track-card-artist">${escapeHtml(track.artist)}</div>
        <div class="track-card-album">${escapeHtml(track.album)}</div>
      </div>
      <div class="track-card-meta">
        <div class="track-card-duration">${duration}</div>
        <div class="track-card-status">${statusIcon}</div>
        ${options.showChange && options.alternatives?.length > 0 
          ? '<button class="track-card-change" data-action="change">Değiştir</button>' 
          : ''
        }
      </div>
    `;

    // Handle "Change" button click
    const changeBtn = card.querySelector('[data-action="change"]');
    if (changeBtn && options.onChangeClick) {
      changeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onChangeClick(index, options.alternatives);
      });
    }

    return card;
  }

  /**
   * Update a track card to show success state during queue adding.
   */
  function markCardSuccess(index) {
    const card = document.querySelector(`.track-card[data-index="${index}"]`);
    if (card) {
      card.classList.remove('warning', 'error');
      card.classList.add('success');
      const status = card.querySelector('.track-card-status');
      if (status) status.textContent = '✅';
    }
  }

  function markCardError(index) {
    const card = document.querySelector(`.track-card[data-index="${index}"]`);
    if (card) {
      card.classList.add('error');
      const status = card.querySelector('.track-card-status');
      if (status) status.textContent = '❌';
    }
  }

  function markCardLoading(index) {
    const card = document.querySelector(`.track-card[data-index="${index}"]`);
    if (card) {
      const status = card.querySelector('.track-card-status');
      if (status) status.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    }
  }

  /**
   * Show a toast notification.
   */
  function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Show the alternative tracks modal (bottom sheet).
   */
  function showAlternativesModal(trackIndex, alternatives, onSelect) {
    // Remove existing modal
    closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';

    let listHtml = '';
    alternatives.forEach((alt, i) => {
      const duration = SpotifyAPI.formatDuration(alt.duration);
      listHtml += `
        <div class="modal-alt-item" data-alt-index="${i}">
          <div class="track-card-art" style="width:44px;height:44px;">
            ${alt.albumImageSmall 
              ? `<img src="${alt.albumImageSmall}" alt="${alt.album}" loading="lazy">`
              : '<div class="art-placeholder">🎵</div>'
            }
          </div>
          <div class="track-card-info">
            <div class="track-card-title">${escapeHtml(alt.name)}</div>
            <div class="track-card-artist">${escapeHtml(alt.artist)}</div>
            <div class="track-card-album">${escapeHtml(alt.album)}</div>
          </div>
          <div class="track-card-duration">${duration}</div>
        </div>
      `;
    });

    sheet.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Alternatif Sonuçlar</div>
      <div class="modal-alt-list">${listHtml}</div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Handle alternative selection
    sheet.querySelectorAll('.modal-alt-item').forEach(item => {
      item.addEventListener('click', () => {
        const altIndex = parseInt(item.dataset.altIndex);
        if (onSelect) onSelect(trackIndex, alternatives[altIndex]);
        closeModal();
      });
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  function closeModal() {
    const modal = document.getElementById('alternatives-modal');
    if (modal) {
      modal.classList.add('removing');
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * Create confetti celebration animation.
   */
  function confetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#1DB954', '#1ED760', '#FFFFFF', '#B3B3B3', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3'];
    const pieceCount = 60;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 1}s`;
      piece.style.animationDuration = `${2 + Math.random() * 2}s`;
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 4000);
  }

  /**
   * Show shimmer loading placeholders.
   */
  function showShimmerLoading(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const shimmer = document.createElement('div');
      shimmer.className = 'shimmer shimmer-card';
      shimmer.style.animationDelay = `${i * 0.15}s`;
      container.appendChild(shimmer);
    }
  }

  /**
   * Update the progress bar.
   */
  function updateProgress(current, total) {
    const bar = document.getElementById('queue-progress-bar');
    if (bar) {
      const percent = total > 0 ? (current / total) * 100 : 0;
      bar.style.width = `${percent}%`;
    }
  }

  /**
   * Escape HTML to prevent XSS.
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format number with locale.
   */
  function formatNumber(num) {
    return num.toLocaleString('tr-TR');
  }

  /**
   * Insert text at cursor position in a textarea.
   */
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  /**
   * Render the Now Playing card with track info.
   */
  function renderNowPlaying(data) {
    const emptyEl = document.getElementById('now-playing-empty');
    const cardEl = document.getElementById('now-playing-card');
    const miniPlayer = document.getElementById('mini-player');

    if (!data || !data.track) {
      // Show empty state
      if (emptyEl) emptyEl.style.display = 'flex';
      if (cardEl) cardEl.style.display = 'none';
      if (miniPlayer) miniPlayer.style.display = 'none';
      return;
    }

    const { track, isPlaying, progressMs, durationMs } = data;

    // Hide empty, show card
    if (emptyEl) emptyEl.style.display = 'none';
    if (cardEl) cardEl.style.display = 'block';

    // Album art
    const artImg = document.getElementById('np-album-art');
    if (artImg && track.albumImage) artImg.src = track.albumImage;

    // Track info
    const titleEl = document.getElementById('np-title');
    const artistEl = document.getElementById('np-artist');
    const albumEl = document.getElementById('np-album');
    if (titleEl) titleEl.textContent = track.name;
    if (artistEl) artistEl.textContent = track.artist;
    if (albumEl) albumEl.textContent = track.album;

    // Equalizer
    const eq = document.getElementById('np-equalizer');
    if (eq) {
      if (isPlaying) {
        eq.classList.remove('paused');
      } else {
        eq.classList.add('paused');
      }
    }

    // Progress
    updatePlaybackProgress(progressMs, durationMs);

    // Play/pause icon
    updatePlayPauseIcons(isPlaying);

    // Mini player
    if (miniPlayer) {
      miniPlayer.style.display = 'flex';
      const miniArt = document.getElementById('mini-player-art-img');
      const miniTitle = document.getElementById('mini-player-title');
      const miniArtist = document.getElementById('mini-player-artist');
      if (miniArt && track.albumImageSmall) miniArt.src = track.albumImageSmall || track.albumImage;
      if (miniTitle) miniTitle.textContent = track.name;
      if (miniArtist) miniArtist.textContent = track.artist;

      // Mini progress
      const miniFill = document.getElementById('mini-player-progress-fill');
      if (miniFill && durationMs > 0) {
        miniFill.style.width = `${(progressMs / durationMs) * 100}%`;
      }
    }
  }

  /**
   * Update playback progress bar.
   */
  function updatePlaybackProgress(currentMs, durationMs) {
    const fill = document.getElementById('np-progress-fill');
    const thumb = document.getElementById('np-progress-thumb');
    const timeCurrent = document.getElementById('np-time-current');
    const timeTotal = document.getElementById('np-time-total');

    if (durationMs <= 0) return;

    const percent = Math.min((currentMs / durationMs) * 100, 100);

    if (fill) fill.style.width = `${percent}%`;
    if (thumb) thumb.style.left = `${percent}%`;
    if (timeCurrent) timeCurrent.textContent = SpotifyAPI.formatDuration(currentMs);
    if (timeTotal) timeTotal.textContent = SpotifyAPI.formatDuration(durationMs);

    // Also update mini player progress
    const miniFill = document.getElementById('mini-player-progress-fill');
    if (miniFill) miniFill.style.width = `${percent}%`;
  }

  /**
   * Update play/pause icons across all players.
   */
  function updatePlayPauseIcons(isPlaying) {
    const playPath = 'M8 5v14l11-7z';
    const pausePath = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';

    // Main player icon
    const mainIcon = document.getElementById('icon-play');
    if (mainIcon) {
      mainIcon.querySelector('path').setAttribute('d', isPlaying ? pausePath : playPath);
    }

    // Mini player icon
    const miniIcon = document.getElementById('mini-icon-play');
    if (miniIcon) {
      miniIcon.querySelector('path').setAttribute('d', isPlaying ? pausePath : playPath);
    }
  }

  /**
   * Render the live queue list.
   */
  function renderLiveQueue(queueItems) {
    const container = document.getElementById('queue-items');
    const emptyEl = document.getElementById('queue-empty');
    const badge = document.getElementById('queue-count-badge');
    const durationEl = document.getElementById('queue-total-duration');

    if (!container) return;

    if (!queueItems || queueItems.length === 0) {
      container.innerHTML = '';
      if (emptyEl) {
        container.appendChild(emptyEl);
        emptyEl.style.display = 'flex';
      }
      if (badge) badge.textContent = '0';
      if (durationEl) durationEl.textContent = '—';
      return;
    }

    container.innerHTML = '';
    let totalDuration = 0;

    queueItems.forEach((track, index) => {
      totalDuration += track.duration || 0;

      const item = document.createElement('div');
      item.className = 'queue-item';
      item.innerHTML = `
        <div class="queue-item-number">${index + 1}</div>
        <div class="queue-item-art">
          ${track.albumImageSmall
            ? `<img src="${track.albumImageSmall}" alt="${escapeHtml(track.album)}" loading="lazy">`
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;">🎵</div>'
          }
        </div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.name)}</div>
          <div class="queue-item-artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="queue-item-duration">${SpotifyAPI.formatDuration(track.duration)}</div>
      `;
      container.appendChild(item);
    });

    if (badge) badge.textContent = queueItems.length;
    if (durationEl) durationEl.textContent = SpotifyAPI.formatTotalDuration(totalDuration);
  }

  return {
    showScreen,
    createTrackCard,
    markCardSuccess,
    markCardError,
    markCardLoading,
    showToast,
    showAlternativesModal,
    closeModal,
    confetti,
    showShimmerLoading,
    updateProgress,
    escapeHtml,
    formatNumber,
    insertAtCursor,
    renderNowPlaying,
    renderLiveQueue,
    updatePlaybackProgress,
    updatePlayPauseIcons,
  };
})();
