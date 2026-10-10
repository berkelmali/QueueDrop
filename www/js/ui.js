// ============================================
// QueueDrop — UI Helpers
// Görünürlük tek bir yerden yönetilir: setHidden()
// hem `hidden` özniteliğini hem inline display'i tutarlı tutar.
// ============================================

const UI = (() => {

  /**
   * Bir öğeyi göster/gizle. `hidden` özniteliği ekran okuyucular için,
   * inline display eski çağrılarla uyum için.
   */
  function setHidden(el, isHidden, displayValue) {
    if (!el) return;
    if (isHidden) {
      el.hidden = true;
      el.style.display = 'none';
    } else {
      el.hidden = false;
      el.style.display = displayValue || '';
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  /**
   * Ekran okuyucuya kısa bir durum duyurusu geçir.
   */
  function announce(message) {
    const region = byId('live-region');
    if (!region) return;
    region.textContent = '';
    // Aynı metin tekrar duyurulabilsin diye bir kare bekle
    requestAnimationFrame(() => { region.textContent = message; });
  }

  /**
   * Belirli bir ekranı göster.
   */
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = byId(screenId);
    if (!target) return;
    target.classList.add('active');
    target.style.opacity = '0';
    requestAnimationFrame(() => {
      target.style.transition = 'opacity var(--dur-2) var(--ease)';
      target.style.opacity = '1';
    });
    // Odağı yeni ekranın başına al
    const heading = target.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ------------------------------------------
  // Durum etiketleri — renk tek başına anlam taşımaz
  // ------------------------------------------
  const STATUS = {
    ok:   { cls: 'is-ok',   icon: '✓', label: 'Eşleşti' },
    warn: { cls: 'is-warn', icon: '≈', label: 'Şüpheli' },
    err:  { cls: 'is-err',  icon: '✕', label: 'Yok', full: 'Bulunamadı' },
  };

  function statusChip(kind) {
    const s = STATUS[kind] || STATUS.ok;
    const aria = s.full ? ` aria-label="${s.full}"` : '';
    return `<span class="status-chip ${s.cls}"${aria}><span aria-hidden="true">${s.icon}</span>${s.label}</span>`;
  }

  /**
   * Parça kartı oluştur.
   */
  function createTrackCard(track, index, options = {}) {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.dataset.index = index;

    let kind = 'ok';
    if (options.confidence === 'low') kind = 'warn';
    if (options.confidence === 'none' || !track) kind = 'err';

    if (kind === 'warn') card.classList.add('warning');
    if (kind === 'err') card.classList.add('error');
    if (kind === 'ok') card.classList.add('success');

    if (!track) {
      card.innerHTML = `
        <div class="track-card-number">${index + 1}</div>
        <div class="track-card-art"><div class="art-placeholder" aria-hidden="true">♪</div></div>
        <div class="track-card-info">
          <div class="track-card-title">Bulunamadı</div>
          <div class="track-card-artist">${escapeHtml(options.raw || 'Bilinmeyen şarkı')}</div>
          <div class="track-card-album">Yazımı kontrol edip tekrar arayın</div>
        </div>
        <div class="track-card-meta">
          <div class="track-card-status">${statusChip('err')}</div>
        </div>
      `;
      return card;
    }

    const duration = SpotifyAPI.formatDuration(track.duration);

    card.innerHTML = `
      <div class="track-card-number">${index + 1}</div>
      <div class="track-card-art">
        ${track.albumImageSmall
          ? `<img src="${escapeHtml(track.albumImageSmall)}" alt="" loading="lazy" decoding="async">`
          : '<div class="art-placeholder" aria-hidden="true">♪</div>'
        }
      </div>
      <div class="track-card-info">
        <div class="track-card-title">${escapeHtml(track.name)}</div>
        <div class="track-card-artist">${escapeHtml(track.artist)}</div>
        <div class="track-card-album">${escapeHtml(track.album)}</div>
      </div>
      <div class="track-card-meta">
        <button class="track-card-preview-btn" type="button" data-action="preview" aria-label="${escapeHtml(track.name)} çal" title="Şimdi Çal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="track-card-duration">${duration}</div>
        <div class="track-card-status">${statusChip(kind)}</div>
        ${options.showChange && options.alternatives && options.alternatives.length > 0
          ? '<button class="track-card-change" type="button" data-action="change">Değiştir</button>'
          : ''
        }
      </div>
    `;

    const previewBtn = card.querySelector('[data-action="preview"]');
    if (previewBtn) {
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAudioPreview(track, previewBtn);
      });
    }

    const changeBtn = card.querySelector('[data-action="change"]');
    if (changeBtn && options.onChangeClick) {
      changeBtn.setAttribute(
        'aria-label',
        `${track.name} yerine başka bir sonuç seç`
      );
      changeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onChangeClick(index, options.alternatives);
      });
    }

    return card;
  }

  function cardAt(index) {
    return document.querySelector(`.track-card[data-index="${index}"]`);
  }

  function markCardSuccess(index) {
    const card = cardAt(index);
    if (!card) return;
    card.classList.remove('warning', 'error');
    card.classList.add('success');
    const status = card.querySelector('.track-card-status');
    if (status) status.innerHTML = statusChip('ok');
  }

  function markCardError(index) {
    const card = cardAt(index);
    if (!card) return;
    card.classList.remove('success', 'warning');
    card.classList.add('error');
    const status = card.querySelector('.track-card-status');
    if (status) status.innerHTML = statusChip('err');
  }

  function markCardLoading(index) {
    const card = cardAt(index);
    if (!card) return;
    const status = card.querySelector('.track-card-status');
    if (status) {
      status.innerHTML =
        '<span class="status-chip"><span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>Ekleniyor</span>';
    }
  }

  /**
   * Bildirim göster.
   */
  function showToast(message, type = 'info', duration = 3500) {
    let container = byId('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const icons = { info: 'ℹ', success: '✓', error: '✕', warning: '⚠' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  // ------------------------------------------
  // Alternatif sonuçlar — alt sayfa
  // ------------------------------------------
  let lastFocusedBeforeModal = null;

  function showAlternativesModal(trackIndex, alternatives, onSelect) {
    closeModal();
    lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'modal-title');

    let listHtml = '';
    alternatives.forEach((alt, i) => {
      const duration = SpotifyAPI.formatDuration(alt.duration);
      listHtml += `
        <button class="modal-alt-item" type="button" data-alt-index="${i}">
          <span class="track-card-art">
            ${alt.albumImageSmall
              ? `<img src="${escapeHtml(alt.albumImageSmall)}" alt="" loading="lazy" decoding="async">`
              : '<span class="art-placeholder" aria-hidden="true">♪</span>'
            }
          </span>
          <span class="track-card-info">
            <span class="track-card-title">${escapeHtml(alt.name)}</span>
            <span class="track-card-artist">${escapeHtml(alt.artist)}</span>
            <span class="track-card-album">${escapeHtml(alt.album)}</span>
          </span>
          <span class="track-card-duration">${duration}</span>
        </button>
      `;
    });

    sheet.innerHTML = `
      <div class="modal-handle" aria-hidden="true"></div>
      <h2 class="modal-title" id="modal-title">Alternatif sonuçlar</h2>
      <div class="modal-alt-list">${listHtml || '<p class="state-block-text">Başka sonuç bulunamadı.</p>'}</div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    sheet.querySelectorAll('.modal-alt-item').forEach(item => {
      item.addEventListener('click', () => {
        const altIndex = parseInt(item.dataset.altIndex, 10);
        if (onSelect) onSelect(trackIndex, alternatives[altIndex]);
        closeModal();
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', onModalKeydown);

    const first = sheet.querySelector('.modal-alt-item');
    if (first) first.focus({ preventScroll: true });
  }

  function onModalKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  function closeModal() {
    document.removeEventListener('keydown', onModalKeydown);
    const modal = byId('alternatives-modal');
    if (!modal) return;
    modal.classList.add('removing');
    setTimeout(() => modal.remove(), 220);
    if (lastFocusedBeforeModal && lastFocusedBeforeModal.focus) {
      lastFocusedBeforeModal.focus({ preventScroll: true });
    }
    lastFocusedBeforeModal = null;
  }

  /**
   * Cihaz seçici — alt sayfa. Modal stilleri alternatif sonuçlarla ortak.
   */
  function showDevicePicker(devices, onSelect) {
    closeModal();
    lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'modal-title');

    const simge = { computer: '🖥', smartphone: '📱', tablet: '📱', speaker: '🔊', tv: '📺' };

    let liste = '';
    devices.forEach((d, i) => {
      const kilitli = d.isRestricted;
      liste += `
        <button class="modal-alt-item device-item" type="button" data-i="${i}" ${kilitli ? 'disabled' : ''}>
          <span class="device-item-icon" aria-hidden="true">${simge[d.type ? d.type.toLowerCase() : ''] || '🎵'}</span>
          <span class="track-card-info">
            <span class="track-card-title">${escapeHtml(d.name)}</span>
            <span class="track-card-artist">${escapeHtml(d.type || '')}${kilitli ? ' · bu cihaz uzaktan kontrole kapalı' : ''}</span>
          </span>
          ${d.isActive
            ? '<span class="status-chip is-ok"><span aria-hidden="true">✓</span>Aktif</span>'
            : '<span class="track-card-duration">Seç</span>'}
        </button>`;
    });

    sheet.innerHTML = `
      <div class="modal-handle" aria-hidden="true"></div>
      <h2 class="modal-title" id="modal-title">Şarkılar hangi cihaza eklensin?</h2>
      <p class="state-block-text" style="max-width:none">Kuyruk, Spotify'ın aktif saydığı cihaza gider. Telefonunuzda dinlerken bilgisayardan ekliyorsanız buradan telefonu seçin.</p>
      <div class="modal-alt-list">${liste || '<p class="state-block-text">Hiç cihaz bulunamadı. Spotify\'ı bir cihazda açın.</p>'}</div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    sheet.querySelectorAll('.device-item').forEach((el) => {
      el.addEventListener('click', () => {
        const d = devices[parseInt(el.dataset.i, 10)];
        closeModal();
        if (onSelect && d) onSelect(d);
      });
    });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', onModalKeydown);
    const ilk = sheet.querySelector('.device-item:not([disabled])');
    if (ilk) ilk.focus({ preventScroll: true });
  }

  // ------------------------------------------
  // ------------------------------------------
  // Şarkı Çalma & Önizleme Kontrolü
  // ------------------------------------------
  let activePreviewAudio = null;
  let activePreviewBtn = null;
  let onPlayTrackHandler = null;

  function setOnPlayTrack(fn) {
    onPlayTrackHandler = fn;
  }

  function stopAudioPreview() {
    if (activePreviewAudio) {
      activePreviewAudio.pause();
      activePreviewAudio = null;
    }
    if (activePreviewBtn) {
      activePreviewBtn.classList.remove('playing');
      activePreviewBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      activePreviewBtn = null;
    }
  }

  function toggleAudioPreview(track, btn) {
    if (!track) return;

    // Gerçek oynatma işleyicisi (Spotify Web API / Demo) varsa öncelikli olarak kullan
    if (onPlayTrackHandler) {
      onPlayTrackHandler(track, btn);
      return;
    }

    // Yedek HTML Audio önizlemesi
    if (track.previewUrl) {
      if (activePreviewBtn === btn) {
        stopAudioPreview();
        return;
      }
      stopAudioPreview();

      activePreviewBtn = btn;
      btn.classList.add('playing');
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

      activePreviewAudio = new Audio(track.previewUrl);
      activePreviewAudio.volume = 0.85;
      activePreviewAudio.play().catch(() => {
        stopAudioPreview();
        showToast('Önizleme oynatılamadı.', 'warning', 2500);
      });
      activePreviewAudio.onended = () => {
        stopAudioPreview();
      };
    } else {
      showToast('Şarkıyı dinlemek için Spotify ile bağlanın.', 'info', 2500);
    }
  }

  // ------------------------------------------
  // Modal: Kuyruğu Çalma Listesi Yap (Save Playlist)
  // ------------------------------------------
  function showSavePlaylistModal(defaultName, trackCount, onSave) {
    closeModal();
    lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'modal-title');

    sheet.innerHTML = `
      <div class="modal-handle" aria-hidden="true"></div>
      <h2 class="modal-title" id="modal-title">💾 Kuyruğu Çalma Listesi Yap</h2>
      <p class="state-block-text" style="max-width:none">Mevcut kuyruğundaki ${trackCount} şarkı Spotify hesabında yeni bir çalma listesi olarak kaydedilecek.</p>
      
      <div class="field" style="margin-top: var(--space-4);">
        <label class="field-label" for="playlist-name-input">Çalma Listesi Adı</label>
        <input type="text" id="playlist-name-input" class="input" value="${escapeHtml(defaultName)}" spellcheck="false" autocomplete="off">
      </div>

      <div class="modal-action-row">
        <button type="button" class="btn btn-outline btn-block" id="modal-cancel-btn">Vazgeç</button>
        <button type="button" class="btn btn-primary btn-block" id="modal-save-playlist-confirm">Spotify'a Kaydet</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const input = sheet.querySelector('#playlist-name-input');
    const confirmBtn = sheet.querySelector('#modal-save-playlist-confirm');
    const cancelBtn = sheet.querySelector('#modal-cancel-btn');

    cancelBtn?.addEventListener('click', closeModal);
    confirmBtn?.addEventListener('click', () => {
      const name = input?.value?.trim() || defaultName;
      closeModal();
      if (onSave) onSave(name);
    });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', onModalKeydown);
    if (input) {
      input.focus();
      input.select();
    }
  }

  // ------------------------------------------
  // Modal: Akıllı Tamamlayıcı (Smart Flow with ML)
  // ------------------------------------------
  function showSmartFlowModal(queueAnalysis, onSelectVibe) {
    // Geriye dönük uyumluluk: tek parametre verilirse callback'tir
    let analysis = null;
    let callback = onSelectVibe;
    if (typeof queueAnalysis === 'function') {
      callback = queueAnalysis;
    } else if (queueAnalysis && typeof queueAnalysis === 'object') {
      analysis = queueAnalysis;
    }

    closeModal();
    lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'modal-title');

    let analysisHtml = '';
    if (analysis) {
      const energyPct = Math.round((analysis.avgEnergy || 0.75) * 100);
      const bpmDisplay = (analysis.isLiveBpmCalibrated && analysis.liveBpm)
        ? `<span class="stat-val" style="color:var(--accent-color, #1db954);font-weight:700">⚡ ${analysis.avgBpm} BPM <span style="font-size:0.75em;opacity:0.85;font-weight:400">(Canlı %${analysis.bpmConfidence || 90})</span></span>`
        : `<span class="stat-val">${analysis.avgBpm || 122} BPM</span>`;
      analysisHtml = `
        <div class="modal-ml-analysis">
          <div class="modal-ml-header">
            <span class="modal-ml-badge">🤖 ML KUYRUK ANALİZİ</span>
            <span class="modal-ml-count">${analysis.trackCount || 0} Parça İncelendi</span>
          </div>
          <div class="modal-ml-stats">
            <div class="modal-ml-stat">
              <span class="stat-label">Ortalama Ritim</span>
              ${bpmDisplay}
            </div>
            <div class="modal-ml-stat">
              <span class="stat-label">Enerji Seviyesi</span>
              <span class="stat-val">%${energyPct} (${analysis.energyLabel || 'Dengeli'})</span>
            </div>
            <div class="modal-ml-stat">
              <span class="stat-label">Tarz Profili</span>
              <span class="stat-val">${analysis.dominantGenre || 'Pop & Dans'}</span>
            </div>
          </div>
        </div>
      `;
    }

    sheet.innerHTML = `
      <div class="modal-handle" aria-hidden="true"></div>
      <h2 class="modal-title" id="modal-title">🪄 Akıllı ML Kuyruk Tamamlayıcı</h2>
      <p class="state-block-text" style="max-width:none">Kuyruğundaki şarkıların akustik vektörleri ve ritmik gidişatına göre ML tabanlı 5 yeni şarkı önerilsin.</p>
      
      ${analysisHtml}

      <div class="modal-preset-grid">
        <button class="modal-preset-btn" type="button" data-vibe="similar">
          <span class="preset-icon">✨</span>
          <div class="preset-text-wrap">
            <div class="preset-title">Benzer Akış (Flow)</div>
            <div class="preset-desc">Vektörel benzerlik &amp; yumuşak geçiş</div>
          </div>
        </button>
        <button class="modal-preset-btn" type="button" data-vibe="party">
          <span class="preset-icon">⚡</span>
          <div class="preset-text-wrap">
            <div class="preset-title">Enerjiyi Yükselt</div>
            <div class="preset-desc">+BPM, kulüp enerjisi &amp; parti drop</div>
          </div>
        </button>
        <button class="modal-preset-btn" type="button" data-vibe="chill">
          <span class="preset-icon">☕</span>
          <div class="preset-text-wrap">
            <div class="preset-title">Sakinleş &amp; Chill</div>
            <div class="preset-desc">Akustik, yumuşak tını &amp; -BPM</div>
          </div>
        </button>
        <button class="modal-preset-btn" type="button" data-vibe="discovery">
          <span class="preset-icon">🚀</span>
          <div class="preset-text-wrap">
            <div class="preset-title">Derin Keşif (MMR)</div>
            <div class="preset-desc">Maksimum çeşitlilik &amp; yeni tınılar</div>
          </div>
        </button>
      </div>

      <div class="modal-action-row">
        <button type="button" class="btn btn-ghost btn-block" id="modal-cancel-btn">Kapat</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    sheet.querySelectorAll('.modal-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const vibe = btn.dataset.vibe;
        closeModal();
        if (callback) callback(vibe);
      });
    });

    sheet.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', onModalKeydown);
  }

  // ------------------------------------------
  // Modal: Uyku Zamanlayıcısı (Sleep Timer)
  // ------------------------------------------
  function showSleepTimerModal(activeMinutes, onSelectTimer) {
    closeModal();
    lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'alternatives-modal';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'modal-title');

    sheet.innerHTML = `
      <div class="modal-handle" aria-hidden="true"></div>
      <h2 class="modal-title" id="modal-title">⏱️ Uyku Zamanlayıcısı</h2>
      <p class="state-block-text" style="max-width:none">Müzik belirlediğin süre sonunda otomatik olarak durdurulur.</p>
      
      <div class="modal-preset-grid">
        <button class="modal-preset-btn" type="button" data-minutes="15">
          <span class="preset-icon">🌙</span>
          <span>15 Dakika</span>
        </button>
        <button class="modal-preset-btn" type="button" data-minutes="30">
          <span class="preset-icon">💤</span>
          <span>30 Dakika</span>
        </button>
        <button class="modal-preset-btn" type="button" data-minutes="45">
          <span class="preset-icon">🛌</span>
          <span>45 Dakika</span>
        </button>
        <button class="modal-preset-btn" type="button" data-minutes="60">
          <span class="preset-icon">⏰</span>
          <span>1 Saat</span>
        </button>
      </div>

      <div class="modal-action-row">
        ${activeMinutes > 0
          ? '<button type="button" class="btn btn-outline btn-block" id="modal-timer-cancel-btn">Zamanlayıcıyı İptal Et</button>'
          : ''}
        <button type="button" class="btn btn-ghost btn-block" id="modal-close-btn">Kapat</button>
      </div>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    sheet.querySelectorAll('.modal-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes, 10);
        closeModal();
        if (onSelectTimer) onSelectTimer(mins);
      });
    });

    sheet.querySelector('#modal-timer-cancel-btn')?.addEventListener('click', () => {
      closeModal();
      if (onSelectTimer) onSelectTimer(0);
    });

    sheet.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', onModalKeydown);
  }

  /**
   * Kutlama. Hareket kısıtlaması açıksa hiç çalışmaz.
   */
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);

    const styles = getComputedStyle(document.documentElement);
    const colors = [
      styles.getPropertyValue('--color-primary').trim() || '#1ED760',
      styles.getPropertyValue('--color-accent').trim() || '#9B87FF',
      styles.getPropertyValue('--color-text').trim() || '#FFFFFF',
      styles.getPropertyValue('--color-warning').trim() || '#FFC24B',
    ];

    for (let i = 0; i < 48; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random()}s`;
      piece.style.animationDuration = `${2 + Math.random() * 1.6}s`;
      const size = 6 + Math.random() * 7;
      piece.style.width = `${size}px`;
      piece.style.height = `${size}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 4000);
  }

  /**
   * İskelet yükleme satırları.
   */
  function showShimmerLoading(containerId, count = 4) {
    const container = byId(containerId);
    if (!container) return;
    container.innerHTML = '';
    container.setAttribute('aria-busy', 'true');
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'skeleton-row';
      row.innerHTML = `
        <div class="skeleton skeleton-art"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line w-70"></div>
          <div class="skeleton skeleton-line w-45"></div>
        </div>
      `;
      container.appendChild(row);
    }
    announce('Şarkılar aranıyor');
  }

  function clearBusy(containerId) {
    const container = byId(containerId);
    if (container) container.removeAttribute('aria-busy');
  }

  function updateProgress(current, total) {
    const bar = byId('queue-progress-bar');
    if (!bar) return;
    const percent = total > 0 ? (current / total) * 100 : 0;
    bar.style.width = `${percent}%`;
    const wrap = byId('queue-progress');
    if (wrap) {
      wrap.setAttribute('role', 'progressbar');
      wrap.setAttribute('aria-valuemin', '0');
      wrap.setAttribute('aria-valuemax', String(total));
      wrap.setAttribute('aria-valuenow', String(current));
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatNumber(num) {
    return Number(num).toLocaleString('tr-TR');
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  // ------------------------------------------
  // Canlı kuyruk durumları
  // ------------------------------------------

  /**
   * Şu an çalıyor bölümünün durumunu ayarla.
   * state: 'loading' | 'empty' | 'error' | 'playing'
   */
  function setNowPlayingState(state, errorText) {
    const map = {
      loading: byId('now-playing-loading'),
      empty: byId('now-playing-empty'),
      error: byId('now-playing-error'),
      playing: byId('now-playing-card'),
    };
    Object.keys(map).forEach(key => {
      setHidden(map[key], key !== state, key === 'playing' ? 'block' : 'flex');
    });
    if (state === 'error' && errorText) {
      const el = byId('now-playing-error-text');
      if (el) el.textContent = errorText;
    }
  }

  function renderNowPlaying(data) {
    const miniPlayer = byId('mini-player');

    if (!data || !data.track) {
      // "Hiçbir şey çalmıyor" ile "Spotify'a ulaşılamadı" farklı durumlar.
      // Aynı sebeple global nesnede SpotifyAPI de yok — typeof ile kontrol.
      const apiErr = (typeof SpotifyAPI !== 'undefined' && SpotifyAPI.getLastPlaybackError)
        ? SpotifyAPI.getLastPlaybackError()
        : null;
      if (apiErr) {
        setNowPlayingState('error', apiErr.message);
      } else {
        setNowPlayingState('empty');
      }
      setHidden(miniPlayer, true);
      setAmbient(null);
      return;
    }

    const { track, isPlaying, progressMs, durationMs } = data;
    setNowPlayingState('playing');

    const artImg = byId('np-album-art');
    if (artImg && track.albumImage) {
      artImg.src = track.albumImage;
      artImg.alt = `${track.album || track.name} albüm kapağı`;
    }
    applyAmbientFrom(track.albumImageSmall || track.albumImage);

    const titleEl = byId('np-title');
    const artistEl = byId('np-artist');
    const albumEl = byId('np-album');
    if (titleEl) titleEl.textContent = track.name;
    if (artistEl) artistEl.textContent = track.artist;
    if (albumEl) albumEl.textContent = track.album;

    // ------------------------------------------
    // Çalan Şarkının BPM Değerini Hesapla & Göster
    // ------------------------------------------
    let calculatedBpm = 120;
    let isLiveAudio = false;

    // 1. Canlı ölçülmüş mikrofon/ses analizörü BPM'i aktifse
    if (typeof MLRecommender !== 'undefined' && typeof MLRecommender.getLiveBpm === 'function') {
      const live = MLRecommender.getLiveBpm();
      if (live && live.bpm && live.confidence >= 40) {
        calculatedBpm = live.bpm;
        isLiveAudio = true;
      }
    }

    // 2. Canlı ses aktif değilse parçanın stüdyo/MIR BPM'ini hesapla
    if (!isLiveAudio) {
      if (typeof track.bpm === 'number' && track.bpm > 40) {
        calculatedBpm = Math.round(track.bpm);
      } else if (track.audioFeatures && typeof track.audioFeatures.tempo === 'number' && track.audioFeatures.tempo > 40) {
        calculatedBpm = Math.round(track.audioFeatures.tempo);
      } else if (typeof RhythmEngine !== 'undefined' && typeof RhythmEngine.estimateBpm === 'function') {
        calculatedBpm = RhythmEngine.estimateBpm(track, track.audioFeatures);
      }
    }

    track.bpm = calculatedBpm;

    // Now Playing Kartı BPM Rozeti
    const npBpmBadge = byId('np-bpm-badge');
    const npBpmText = byId('np-bpm-text');
    const npBpmDot = byId('np-bpm-dot');

    if (npBpmText) {
      npBpmText.textContent = isLiveAudio 
        ? `🎤 ${calculatedBpm} BPM` 
        : `⚡ ${calculatedBpm} BPM`;
    }
    if (npBpmBadge) {
      npBpmBadge.title = isLiveAudio 
        ? `Canlı Ses ile Ölçülen Tempo: ${calculatedBpm} BPM`
        : `Şarkının Hesaplanmış Temposu: ${calculatedBpm} BPM (Ritim ekranı için tıkla)`;
      if (!npBpmBadge._hasClickListener) {
        npBpmBadge._hasClickListener = true;
        npBpmBadge.addEventListener('click', () => {
          openRhythmScreen();
        });
      }
    }
    if (npBpmDot) {
      const beatSec = (60 / Math.max(50, Math.min(220, calculatedBpm))).toFixed(3);
      npBpmDot.style.animationDuration = isPlaying ? `${beatSec}s` : '0s';
      npBpmDot.style.opacity = isPlaying ? '1' : '0.4';
    }

    const eq = byId('np-equalizer');
    if (eq) eq.classList.toggle('paused', !isPlaying);

    updatePlaybackProgress(progressMs, durationMs);
    updatePlayPauseIcons(isPlaying);

    if (miniPlayer) {
      const liveQueueTab = byId('live-queue-tab');
      const isLiveQueueActive = liveQueueTab && liveQueueTab.classList.contains('active');
      setHidden(miniPlayer, isLiveQueueActive, 'flex');

      const miniArt = byId('mini-player-art-img');
      const miniTitle = byId('mini-player-title');
      const miniArtist = byId('mini-player-artist');
      const miniBpmBadge = byId('mini-player-bpm-badge');

      if (miniArt) miniArt.src = track.albumImageSmall || track.albumImage || miniArt.src;
      if (miniTitle) miniTitle.textContent = track.name;
      if (miniArtist) miniArtist.textContent = track.artist;
      if (miniBpmBadge) {
        miniBpmBadge.textContent = isLiveAudio ? `🎤 ${calculatedBpm} BPM` : `⚡ ${calculatedBpm} BPM`;
      }

      const miniFill = byId('mini-player-progress-fill');
      if (miniFill && durationMs > 0) {
        miniFill.style.width = `${(progressMs / durationMs) * 100}%`;
      }
    }
  }

  function updatePlaybackProgress(currentMs, durationMs) {
    const fill = byId('np-progress-fill');
    const thumb = byId('np-progress-thumb');
    const timeCurrent = byId('np-time-current');
    const timeTotal = byId('np-time-total');
    const slider = byId('np-progress-container');

    if (!durationMs || durationMs <= 0) return;

    const percent = Math.min((currentMs / durationMs) * 100, 100);

    if (fill) fill.style.width = `${percent}%`;
    if (thumb) thumb.style.left = `${percent}%`;
    if (timeCurrent) timeCurrent.textContent = SpotifyAPI.formatDuration(currentMs);
    if (timeTotal) timeTotal.textContent = SpotifyAPI.formatDuration(durationMs);
    if (slider) {
      slider.setAttribute('aria-valuenow', String(Math.round(percent)));
      slider.setAttribute(
        'aria-valuetext',
        `${SpotifyAPI.formatDuration(currentMs)} / ${SpotifyAPI.formatDuration(durationMs)}`
      );
    }

    const miniFill = byId('mini-player-progress-fill');
    if (miniFill) miniFill.style.width = `${percent}%`;
  }

  function updatePlayPauseIcons(isPlaying) {
    const playPath = 'M8 5v14l11-7z';
    const pausePath = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const label = isPlaying ? 'Duraklat' : 'Çal';

    [['icon-play', 'ctrl-play-pause'], ['mini-icon-play', 'mini-play-pause']].forEach(([iconId, btnId]) => {
      const icon = byId(iconId);
      if (icon) {
        const path = icon.querySelector('path');
        if (path) path.setAttribute('d', isPlaying ? pausePath : playPath);
      }
      const btn = byId(btnId);
      if (btn) btn.setAttribute('aria-label', label);
    });

    const bpmPulseDot = byId('np-bpm-dot');
    if (bpmPulseDot) {
      bpmPulseDot.style.animationPlayState = isPlaying ? 'running' : 'paused';
      bpmPulseDot.style.opacity = isPlaying ? '1' : '0.4';
    }
  }

  /**
   * Sıradakiler listesi.
   */
  function renderLiveQueue(queueItems) {
    const container = byId('queue-items');
    const emptyEl = byId('queue-empty');
    const badge = byId('queue-count-badge');
    const durationEl = byId('queue-total-duration');

    if (!container) return;

    const etaEl = byId('queue-eta');

    if (!queueItems || queueItems.length === 0) {
      container.innerHTML = '';
      if (emptyEl) {
        container.appendChild(emptyEl);
        setHidden(emptyEl, false, 'flex');
      }
      if (badge) badge.textContent = '0';
      if (durationEl) durationEl.textContent = '—';
      if (etaEl) {
        etaEl.textContent = '—';
        etaEl.style.display = 'none';
      }
      return;
    }

    container.innerHTML = '';
    let totalDuration = 0;

    queueItems.forEach((track, index) => {
      totalDuration += track.duration || 0;

      let queueBpm = track.bpm;
      if (!queueBpm && typeof RhythmEngine !== 'undefined' && typeof RhythmEngine.estimateBpm === 'function') {
        queueBpm = RhythmEngine.estimateBpm(track, track.audioFeatures);
        track.bpm = queueBpm;
      }

      const item = document.createElement('div');
      item.className = 'queue-item';
      item.innerHTML = `
        <div class="queue-item-number">${index + 1}</div>
        <div class="queue-item-art">
          ${track.albumImageSmall
            ? `<img src="${escapeHtml(track.albumImageSmall)}" alt="" loading="lazy" decoding="async">`
            : '<div class="art-placeholder" aria-hidden="true">♪</div>'
          }
        </div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.name)}</div>
          <div class="queue-item-artist">
            ${escapeHtml(track.artist)}
            ${queueBpm ? `<span class="queue-item-bpm-badge">⚡ ${queueBpm} BPM</span>` : ''}
            ${track.mlTag ? `<span class="queue-item-ml-badge">${escapeHtml(track.mlTag)}</span>` : ''}
          </div>
        </div>
        <div class="queue-item-actions" style="display:flex; align-items:center; gap:8px;">
          <button class="track-card-preview-btn" type="button" data-action="preview" aria-label="${escapeHtml(track.name)} çal" title="Şimdi Çal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="queue-item-duration">${SpotifyAPI.formatDuration(track.duration)}</div>
        </div>
      `;

      const previewBtn = item.querySelector('[data-action="preview"]');
      if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleAudioPreview(track, previewBtn);
        });
      }

      // Tıklanabilir kuyruk kartı: Satıra tıklandığında parçayı doğrudan başlatır
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          toggleAudioPreview(track, previewBtn);
        }
      });

      container.appendChild(item);
    });

    if (badge) badge.textContent = queueItems.length;
    if (durationEl) durationEl.textContent = SpotifyAPI.formatTotalDuration(totalDuration);

    if (etaEl) {
      if (totalDuration > 0) {
        const etaDate = new Date(Date.now() + totalDuration);
        const hours = String(etaDate.getHours()).padStart(2, '0');
        const mins = String(etaDate.getMinutes()).padStart(2, '0');
        etaEl.textContent = `Bitiş ~${hours}:${mins}`;
        etaEl.style.display = 'inline-flex';
      } else {
        etaEl.textContent = '—';
        etaEl.style.display = 'none';
      }
    }
  }

  /**
   * Kuyruk listesi için iskelet.
   */
  function showQueueSkeleton(count = 3) {
    const container = byId('queue-items');
    if (!container) return;
    container.innerHTML = '';
    container.setAttribute('aria-busy', 'true');
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'skeleton-row';
      row.innerHTML = `
        <div class="skeleton skeleton-art"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line w-70"></div>
          <div class="skeleton skeleton-line w-45"></div>
        </div>
      `;
      container.appendChild(row);
    }
  }

  // ------------------------------------------
  // Tema
  // ------------------------------------------
  function currentTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('queuedrop_theme', theme); } catch (e) { /* yok sayılır */ }
    const btn = byId('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç');
    }
  }

  function initTheme() {
    applyTheme(currentTheme());
    const btn = byId('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
      });
    }
  }

  /**
   * Premium kısıtı şeridi. Toast 6 saniyede kaybolur; kısıt kaybolmaz.
   */
  function setPremiumWarning(show) {
    setHidden(byId('premium-warning'), !show, 'flex');
  }

  // ------------------------------------------
  // Senkronize Şarkı Sözleri (Lyrics UI)
  // ------------------------------------------
  let currentLyricsLines = [];
  let currentActiveLyricIndex = -1;
  let isLyricsUserScrolling = false;
  let lyricsScrollTimeout = null;
  let onLyricSeekCallback = null;

  function isLyricsOpen() {
    const panel = byId('lyrics-panel');
    return panel && panel.style.display !== 'none';
  }

  function updateLyricsTrack(track, lyricsData) {
    const panel = byId('lyrics-panel');
    if (!panel) return;

    const titleEl = byId('lyrics-title');
    const artistEl = byId('lyrics-artist');
    const badgeEl = byId('lyrics-sync-badge');
    const artImg = byId('lyrics-art-img');
    const backdropEl = panel.querySelector('.lyrics-backdrop');

    if (titleEl) titleEl.textContent = track?.name || '—';
    if (artistEl) artistEl.textContent = track?.artist || '—';
    const coverUrl = track?.albumImage || track?.albumImageSmall || track?.image || 'assets/logo.jpg';
    if (artImg) artImg.src = coverUrl;
    if (backdropEl && coverUrl && coverUrl !== 'assets/logo.jpg') {
      backdropEl.style.backgroundImage = `radial-gradient(circle at 50% 30%, rgba(12, 14, 18, 0.75) 0%, rgba(12, 14, 18, 0.95) 85%), url("${coverUrl}")`;
    }
    if (badgeEl) {
      const dot = '<span class="lyrics-live-dot" aria-hidden="true"></span>';
      if (!lyricsData) {
        badgeEl.innerHTML = `${dot}Sözler Aranıyor...`;
      } else {
        badgeEl.innerHTML = lyricsData.synced ? `${dot}Canlı Senkronize` : 'Düz Metin';
      }
    }

    renderLyricsContent(lyricsData);
  }

  function openLyrics(track, lyricsData, onSeek) {
    const panel = byId('lyrics-panel');
    if (!panel) return;

    onLyricSeekCallback = onSeek;
    panel.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    updateLyricsTrack(track, lyricsData);

    const closeBtn = byId('lyrics-close-btn');
    if (closeBtn) closeBtn.onclick = closeLyrics;

    const syncBtn = byId('lyrics-sync-btn');
    if (syncBtn) {
      syncBtn.onclick = () => {
        isLyricsUserScrolling = false;
        syncBtn.style.display = 'none';
        scrollToActiveLyric(true);
      };
    }

    const bodyEl = byId('lyrics-body');
    if (bodyEl) {
      bodyEl.onscroll = () => {
        if (!isLyricsUserScrolling) {
          isLyricsUserScrolling = true;
          if (syncBtn && lyricsData?.synced) syncBtn.style.display = 'inline-flex';
        }
        clearTimeout(lyricsScrollTimeout);
        lyricsScrollTimeout = setTimeout(() => {
          isLyricsUserScrolling = false;
          if (syncBtn) syncBtn.style.display = 'none';
        }, 4500);
      };
    }
  }

  function closeLyrics() {
    const panel = byId('lyrics-panel');
    if (!panel) return;
    panel.style.display = 'none';
    document.body.style.overflow = '';
    isLyricsUserScrolling = false;
  }

  // ==========================================
  // Ritim Ekranı & Lav Lambası (Rhythm Screen)
  // ==========================================

  let visualizerInstance = null;

  function isRhythmScreenOpen() {
    const screen = byId('rhythm-screen');
    return screen && screen.style.display !== 'none';
  }

  let rhythmCallbacks = null;

  function openRhythmScreen(track, nowPlayingData, callbacks = {}, audioFeatures = null, volumePercent = 70) {
    const screen = byId('rhythm-screen');
    if (!screen) return;

    rhythmCallbacks = callbacks;
    screen.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const canvas = byId('rhythm-canvas');
    if (canvas && typeof RhythmEngine !== 'undefined') {
      if (!visualizerInstance) {
        visualizerInstance = new RhythmEngine.LavaLampVisualizer(canvas);

        visualizerInstance.onBeat = (isDownbeat) => {
          const dot = byId('rhythm-beat-dot');
          if (dot) {
            dot.classList.add('pulsing');
            if (isDownbeat) dot.style.transform = 'scale(2.0)';
            setTimeout(() => {
              dot.classList.remove('pulsing');
              dot.style.transform = '';
            }, 100);
          }
        };

        // Canvas tıklama/dokunma ile lav dalgası oluşturma
        canvas.addEventListener('pointerdown', (e) => {
          const rect = canvas.getBoundingClientRect();
          visualizerInstance.addRipple(e.clientX - rect.left, e.clientY - rect.top, true);
        });

        // Mod seçim çipleri
        const moodChips = screen.querySelectorAll('.rhythm-mood-chip');
        moodChips.forEach(chip => {
          chip.onclick = () => {
            moodChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            visualizerInstance.setMood(chip.dataset.mood);
          };
        });

        // Canlı Mikrofon / Ses Algılama butonu
        const micBtn = byId('rhythm-mic-btn');
        if (micBtn) {
          micBtn.onclick = async () => {
            if (!visualizerInstance) return;
            if (visualizerInstance.isLiveAudioActive) {
              visualizerInstance.stopLiveAudio();
              micBtn.classList.remove('active');
              micBtn.title = 'Canlı Ses / Mikrofon ile Gerçek BPM Algıla';
              showToast('Canlı ses algılama durduruldu', 'info');
            } else {
              showToast('Mikrofon dinleniyor... Ritim algılanıyor', 'info');
              const success = await visualizerInstance.startLiveAudio();
              if (success) {
                micBtn.classList.add('active');
                micBtn.title = 'Canlı Ses Aktif (Durdurmak için tıkla)';
                showToast('🎙️ Canlı BPM ve Spektrum Aktif!', 'success');
              } else {
                micBtn.classList.remove('active');
                showToast('Mikrofona erişilemedi veya izin verilmedi', 'warning');
              }
            }
          };
        }

        // Tam ekran butonu
        const fsBtn = byId('rhythm-fullscreen-btn');
        if (fsBtn) {
          fsBtn.onclick = toggleRhythmFullscreen;
        }

        // Kapat butonu
        const closeBtn = byId('rhythm-close-btn');
        if (closeBtn) {
          closeBtn.onclick = closeRhythmScreen;
        }

        // HUD Oynatma Kontrolleri
        const hudPrev = byId('rhythm-hud-prev');
        if (hudPrev) {
          hudPrev.onclick = (e) => {
            e.stopPropagation();
            if (rhythmCallbacks?.onPrev) rhythmCallbacks.onPrev();
          };
        }

        const hudPlay = byId('rhythm-hud-play');
        if (hudPlay) {
          hudPlay.onclick = (e) => {
            e.stopPropagation();
            if (rhythmCallbacks?.onPlayPause) rhythmCallbacks.onPlayPause();
          };
        }

        const hudNext = byId('rhythm-hud-next');
        if (hudNext) {
          hudNext.onclick = (e) => {
            e.stopPropagation();
            if (rhythmCallbacks?.onNext) rhythmCallbacks.onNext();
          };
        }
      }

      // Canlı anlık dinamik BPM ve müzikal bölüm (Drop, Verse, vb.) güncellemesi
      visualizerInstance.onDynamicUpdate = (dyn) => {
        const bpmBadge = byId('rhythm-bpm-badge');
        const energyBadge = byId('rhythm-energy-badge');
        if (bpmBadge && dyn && dyn.instantBpm) {
          bpmBadge.textContent = `⚡ ${dyn.instantBpm} BPM`;
        }
        if (energyBadge && dyn && dyn.sectionName) {
          energyBadge.textContent = dyn.sectionName;
          if (dyn.energyMod >= 1.2) {
            energyBadge.style.color = '#ff4d6d';
            energyBadge.style.borderColor = 'rgba(255, 77, 109, 0.4)';
          } else if (dyn.energyMod >= 0.95) {
            energyBadge.style.color = '#ff9e00';
            energyBadge.style.borderColor = 'rgba(255, 158, 0, 0.4)';
          } else if (dyn.energyMod <= 0.7) {
            energyBadge.style.color = '#70d6ff';
            energyBadge.style.borderColor = 'rgba(112, 214, 255, 0.3)';
          } else {
            energyBadge.style.color = '#ffbe0b';
            energyBadge.style.borderColor = 'rgba(255, 190, 11, 0.3)';
          }
        }
      };

      if (audioFeatures) {
        visualizerInstance.setAudioFeatures(audioFeatures);
      }
      visualizerInstance.setVolumeLevel(volumePercent);
      visualizerInstance.setTrack(track);
      if (nowPlayingData) {
        visualizerInstance.setPlaybackState({
          isPlaying: nowPlayingData.isPlaying,
          progressMs: nowPlayingData.progressMs,
          durationMs: nowPlayingData.durationMs,
        });
      }
      visualizerInstance.start();
    }

    updateRhythmTrack(track, audioFeatures);
    if (nowPlayingData) {
      updateRhythmPlayback(nowPlayingData, volumePercent);
    }
  }

  function closeRhythmScreen() {
    const screen = byId('rhythm-screen');
    if (!screen) return;

    if (visualizerInstance) {
      if (visualizerInstance.isLiveAudioActive) {
        visualizerInstance.stopLiveAudio();
        const micBtn = byId('rhythm-mic-btn');
        if (micBtn) micBtn.classList.remove('active');
      }
      visualizerInstance.stop();
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    screen.style.display = 'none';
    document.body.style.overflow = '';
  }

  function updateRhythmTrack(track, audioFeatures = null) {
    const screen = byId('rhythm-screen');
    if (!screen || screen.style.display === 'none') return;

    const titleEl = byId('rhythm-hud-title');
    const artistEl = byId('rhythm-hud-artist');
    const artImg = byId('rhythm-hud-art');
    const bpmBadge = byId('rhythm-bpm-badge');
    const energyBadge = byId('rhythm-energy-badge');

    if (titleEl) titleEl.textContent = track?.name || '—';
    if (artistEl) artistEl.textContent = track?.artist || '—';
    const coverUrl = track?.albumImage || track?.albumImageSmall || track?.image || 'assets/logo.jpg';
    if (artImg) artImg.src = coverUrl;

    if (typeof RhythmEngine !== 'undefined') {
      // Audio Features varsa gerçek tempo ve enerji kullan
      let bpm, energy;
      if (audioFeatures && audioFeatures.tempo) {
        bpm = Math.round(audioFeatures.tempo);
        energy = audioFeatures.energy ?? 0.5;
      } else {
        bpm = RhythmEngine.estimateBpm(track);
        energy = 0.5;
      }

      if (bpmBadge) bpmBadge.textContent = `⚡ ${bpm} BPM`;

      // Enerji seviyesi rozeti
      if (energyBadge) {
        const pct = Math.round(energy * 100);
        let label, color;
        if (pct >= 75) { label = '🔥 Yüksek Enerji'; color = '#ff6b35'; }
        else if (pct >= 45) { label = '✨ Orta Enerji'; color = '#f0c040'; }
        else { label = '🌙 Düşük Enerji'; color = '#6bc5e8'; }
        energyBadge.textContent = label;
        energyBadge.style.color = color;
      }

      if (visualizerInstance) {
        if (audioFeatures) {
          visualizerInstance.setAudioFeatures(audioFeatures);
        }
        visualizerInstance.setTrack(track);
      }
    }
  }

  function updateRhythmPlayback(nowPlayingData, volumePercent) {
    const screen = byId('rhythm-screen');
    if (!screen || screen.style.display === 'none' || !nowPlayingData) return;

    if (visualizerInstance) {
      visualizerInstance.setPlaybackState({
        isPlaying: nowPlayingData.isPlaying,
        progressMs: nowPlayingData.progressMs,
        durationMs: nowPlayingData.durationMs,
      });
      if (typeof volumePercent === 'number') {
        visualizerInstance.setVolumeLevel(volumePercent);
      }
    }

    // Play/Pause ikonunu güncelle
    const playIcon = byId('rhythm-hud-icon-play');
    const pauseIcon = byId('rhythm-hud-icon-pause');
    if (playIcon && pauseIcon) {
      playIcon.style.display = nowPlayingData.isPlaying ? 'none' : 'block';
      pauseIcon.style.display = nowPlayingData.isPlaying ? 'block' : 'none';
    }

    // Durum rozeti (Çalıyor vs Duraklatıldı)
    const statusBadge = byId('rhythm-status-badge');
    if (statusBadge) {
      statusBadge.textContent = nowPlayingData.isPlaying ? '• Çalıyor' : '• Duraklatıldı';
      statusBadge.style.color = nowPlayingData.isPlaying ? 'var(--color-primary)' : 'var(--color-text-muted)';
    }

    // İlerleme çubuğunu güncelle
    const fill = byId('rhythm-hud-progress-fill');
    if (fill && nowPlayingData.durationMs) {
      const pct = Math.min(100, Math.max(0, (nowPlayingData.progressMs / nowPlayingData.durationMs) * 100));
      fill.style.width = `${pct}%`;
    }
  }

  function setRhythmAudioFeatures(features) {
    if (visualizerInstance && features) {
      visualizerInstance.setAudioFeatures(features);
    }
  }

  function setRhythmVolume(volumePercent) {
    if (visualizerInstance) {
      visualizerInstance.setVolumeLevel(volumePercent);
    }
  }

  function toggleRhythmFullscreen() {
    const screen = byId('rhythm-screen');
    if (!screen) return;

    const expandIcon = screen.querySelector('.icon-expand');
    const compressIcon = screen.querySelector('.icon-compress');

    if (!document.fullscreenElement) {
      screen.requestFullscreen().then(() => {
        if (expandIcon) expandIcon.style.display = 'none';
        if (compressIcon) compressIcon.style.display = 'block';
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        if (expandIcon) expandIcon.style.display = 'block';
        if (compressIcon) compressIcon.style.display = 'none';
      }).catch(() => {});
    }
  }

  function renderLyricsContent(lyricsData) {
    const loadingEl = byId('lyrics-loading');
    const emptyEl = byId('lyrics-empty');
    const linesEl = byId('lyrics-lines');
    const plainEl = byId('lyrics-plain');

    if (!lyricsData) {
      if (loadingEl) loadingEl.style.display = 'flex';
      if (emptyEl) emptyEl.style.display = 'none';
      if (linesEl) linesEl.style.display = 'none';
      if (plainEl) plainEl.style.display = 'none';
      return;
    }

    if (loadingEl) loadingEl.style.display = 'none';

    if (lyricsData.synced && lyricsData.lines && lyricsData.lines.length > 0) {
      currentLyricsLines = lyricsData.lines;
      if (emptyEl) emptyEl.style.display = 'none';
      if (plainEl) plainEl.style.display = 'none';
      if (linesEl) {
        linesEl.style.display = 'flex';
        linesEl.innerHTML = '';
        lyricsData.lines.forEach((line, index) => {
          const lineEl = document.createElement('div');
          lineEl.className = 'lyric-line';
          lineEl.dataset.index = index;
          lineEl.dataset.time = line.timeMs;
          lineEl.textContent = line.text;
          lineEl.addEventListener('click', () => {
            if (onLyricSeekCallback) {
              onLyricSeekCallback(line.timeMs);
            }
            isLyricsUserScrolling = false;
            updateActiveLyric(line.timeMs);
          });
          linesEl.appendChild(lineEl);
        });
      }
    } else if (lyricsData.plainLyrics && lyricsData.plainLyrics.trim()) {
      currentLyricsLines = [];
      if (emptyEl) emptyEl.style.display = 'none';
      if (linesEl) linesEl.style.display = 'none';
      if (plainEl) {
        plainEl.style.display = 'block';
        plainEl.textContent = lyricsData.plainLyrics;
      }
    } else {
      currentLyricsLines = [];
      if (linesEl) linesEl.style.display = 'none';
      if (plainEl) plainEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
    }
  }

  function updateActiveLyric(currentProgressMs) {
    if (!isLyricsOpen() || currentLyricsLines.length === 0) return;

    if (typeof LyricsEngine === 'undefined') return;
    const activeIndex = LyricsEngine.getActiveLineIndex(currentLyricsLines, currentProgressMs);
    if (activeIndex === currentActiveLyricIndex) return;

    currentActiveLyricIndex = activeIndex;

    const lineEls = document.querySelectorAll('.lyrics-lines .lyric-line');
    lineEls.forEach((el, idx) => {
      if (idx === activeIndex) {
        el.classList.add('is-active');
        el.classList.remove('is-past');
      } else if (idx < activeIndex) {
        el.classList.remove('is-active');
        el.classList.add('is-past');
      } else {
        el.classList.remove('is-active', 'is-past');
      }
    });

    if (!isLyricsUserScrolling) {
      scrollToActiveLyric(false);
    }
  }

  function scrollToActiveLyric(force = false) {
    const activeEl = document.querySelector('.lyrics-lines .lyric-line.is-active');
    if (!activeEl) return;
    activeEl.scrollIntoView({
      behavior: force ? 'auto' : 'smooth',
      block: 'center',
    });
  }

  // ------------------------------------------
  // Albüm kapağından ortam rengi
  // ------------------------------------------
  const ambientCache = new Map();

  function setAmbient(rgb) {
    document.documentElement.style.setProperty(
      '--np-ambient',
      rgb ? `rgba(${rgb}, 0.40)` : ''
    );
  }

  /**
   * Kapaktan baskın rengi çıkarıp arka plan parıltısına uygular.
   * CORS veya canvas engellenirse sessizce token rengine döner —
   * görsel bir süs, çalışmazsa hiçbir şey bozulmaz.
   */
  function applyAmbientFrom(url) {
    if (!url) { setAmbient(null); return; }
    if (ambientCache.has(url)) { setAmbient(ambientCache.get(url)); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => setAmbient(null);
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, n = 0;
        let vr = 0, vg = 0, vb = 0, bestChroma = -1;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
          r += pr; g += pg; b += pb; n++;
          const chroma = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
          const lum = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
          // Çok koyu veya çok açık pikseller ton taşımaz
          if (chroma > bestChroma && lum > 40 && lum < 215) {
            bestChroma = chroma; vr = pr; vg = pg; vb = pb;
          }
        }
        if (!n) { setAmbient(null); return; }

        // Ortalama ile en canlı pikseli harmanla: ne çamur ne neon
        const mix = (avg, vivid) => Math.round(bestChroma > 24 ? avg * 0.35 + vivid * 0.65 : avg);
        const rgb = [mix(r / n, vr), mix(g / n, vg), mix(b / n, vb)].join(', ');

        ambientCache.set(url, rgb);
        setAmbient(rgb);
      } catch (e) {
        setAmbient(null); // canvas kirlendi — sorun değil
      }
    };
    img.src = url;
  }

  // ------------------------------------------
  // Çevrimdışı durumu
  // ------------------------------------------
  function setOffline(isOffline) {
    const banner = byId('offline-banner');
    setHidden(banner, !isOffline, 'flex');
    const searchBtn = byId('search-btn');
    if (searchBtn) searchBtn.disabled = isOffline;
    if (isOffline) announce('İnternet bağlantısı kesildi');
  }

  function initOfflineWatch() {
    setOffline(!navigator.onLine);
    window.addEventListener('online', () => {
      setOffline(false);
      showToast('Bağlantı geri geldi', 'success', 2200);
    });
    window.addEventListener('offline', () => {
      setOffline(true);
      showToast('İnternet bağlantısı yok', 'error', 4000);
    });
  }

  return {
    setHidden,
    announce,
    showScreen,
    createTrackCard,
    markCardSuccess,
    markCardError,
    markCardLoading,
    showToast,
    showAlternativesModal,
    showDevicePicker,
    closeModal,
    confetti,
    showShimmerLoading,
    showQueueSkeleton,
    clearBusy,
    updateProgress,
    escapeHtml,
    formatNumber,
    insertAtCursor,
    renderNowPlaying,
    renderLiveQueue,
    setNowPlayingState,
    updatePlaybackProgress,
    updatePlayPauseIcons,
    initTheme,
    applyTheme,
    currentTheme,
    initOfflineWatch,
    setOffline,
    setPremiumWarning,
    applyAmbientFrom,
    setOnPlayTrack,
    toggleAudioPreview,
    stopAudioPreview,
    showSavePlaylistModal,
    showSmartFlowModal,
    showSleepTimerModal,
    openLyrics,
    closeLyrics,
    isLyricsOpen,
    updateLyricsTrack,
    updateActiveLyric,
    renderLyricsContent,
    openRhythmScreen,
    closeRhythmScreen,
    isRhythmScreenOpen,
    updateRhythmTrack,
    updateRhythmPlayback,
    setRhythmAudioFeatures,
    setRhythmVolume,
    getLiveRhythmState: () => {
      if (!visualizerInstance) return null;
      return {
        bpm: visualizerInstance.bpm,
        confidence: visualizerInstance.liveBpmConfidence || 0,
        isLiveActive: !!visualizerInstance.isLiveAudioActive,
      };
    },
  };
})();
