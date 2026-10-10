// ============================================
// QueueDrop — Tasarım katmanı bağları
// app.js'e dokunmadan yeni davranışları ekler:
// tema, çevrimdışı, durum ekranları, erişilebilirlik senkronu.
// ============================================

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------
  // 1 · `hidden` özniteliği ile inline display senkronu
  //
  // app.js bazı öğeleri hâlâ el.style.display ile açıp kapatıyor.
  // Bu iyi çalışıyor (inline stil, [hidden] UA kuralını yener) ama
  // ekran okuyucu için `hidden` yanlış kalıyor. Aşağıdaki gözlemci
  // ikisini tutarlı tutar; app.js'te tek satır değişmez.
  // --------------------------------------------------
  const SYNCED_IDS = [
    'redirect-uri-warning',
    'client-id-error',
    'device-warning',
    'premium-warning',
    'device-indicator',
    'mini-player',
    'queue-progress',
    'offline-banner',
    'step-spotify-login',
    'now-playing-card',
    'now-playing-error',
    'now-playing-loading',
  ];

  function watchVisibility() {
    // Stil her değiştiğinde `hidden` inline display'i birebir izler.
    // `display: ''` (boş) da görünür sayılır — app.js bazı öğeleri böyle açıyor
    // ve bu durumda `hidden` kalsaydı öğe hiç görünmezdi.
    const observer = new MutationObserver((records) => {
      records.forEach((r) => {
        const el = r.target;
        el.hidden = el.style.display === 'none';
      });
    });

    SYNCED_IDS.forEach((id) => {
      const el = $(id);
      if (!el) return;
      // Başlangıçta ikisini hizala: `hidden` ile açılan öğe inline olarak da
      // kapalı olsun ki sonraki her stil yazımı doğru yöne çevirsin.
      if (el.hidden) el.style.display = 'none';
      observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    });
  }

  // --------------------------------------------------
  // 2 · Sekmelerde aria-selected senkronu
  // --------------------------------------------------
  function watchTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    if (!tabs.length) return;

    const sync = () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false'));
    };
    sync();

    const observer = new MutationObserver(sync);
    tabs.forEach((t) => observer.observe(t, { attributes: true, attributeFilter: ['class'] }));

    // Ok tuşlarıyla sekme gezinmesi
    tabs.forEach((tab, i) => {
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = e.key === 'ArrowRight'
          ? tabs[(i + 1) % tabs.length]
          : tabs[(i - 1 + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });
  }

  // --------------------------------------------------
  // 3 · Client ID alanı — satır içi doğrulama
  // --------------------------------------------------
  function wireClientIdValidation() {
    const input = $('client-id-input');
    const error = $('client-id-error');
    const saveBtn = $('save-client-id');
    if (!input || !error) return;

    const looksValid = (v) => /^[a-zA-Z0-9]{20,}$/.test(v.trim());

    const setError = (show) => {
      error.hidden = !show;
      input.setAttribute('aria-invalid', show ? 'true' : 'false');
    };

    input.addEventListener('input', () => {
      if (!error.hidden && looksValid(input.value)) setError(false);
    });

    if (saveBtn) {
      // Yalnız uyarır; kaydetme akışını app.js yürütmeye devam eder.
      saveBtn.addEventListener('click', () => {
        const invalid = input.value.trim() !== '' && !looksValid(input.value);
        setError(invalid);
        if (invalid && typeof UI !== 'undefined') UI.announce('Client ID beklenen biçimde görünmüyor');
      });
    }
  }

  // --------------------------------------------------
  // 4 · Durum ekranlarındaki yeni eylemler
  // --------------------------------------------------
  function wireStateActions() {
    const refresh = $('queue-refresh-btn');

    const retry = () => {
      if (typeof UI !== 'undefined') UI.setNowPlayingState('loading');
      if (refresh) refresh.click();
    };

    ['np-retry-btn', 'np-error-retry-btn', 'recheck-device-btn'].forEach((id) => {
      const btn = $(id);
      if (btn) btn.addEventListener('click', retry);
    });

    const queueCta = $('queue-empty-cta');
    if (queueCta) {
      queueCta.addEventListener('click', () => {
        const builderTab = $('tab-builder');
        if (builderTab) builderTab.click();
        const input = $('song-input');
        if (input) input.focus();
      });
    }

    const openSpotify = $('open-spotify-btn');
    if (openSpotify) {
      openSpotify.addEventListener('click', () => {
        // Eskiden doğrudan `spotify:` açılıyordu. Masaüstü uygulaması kurulu
        // değilse Chrome hiçbir şey açmıyor ve konsola
        // "scheme does not have a registered handler" yazıyor — kullanıcı
        // düğmenin bozuk olduğunu sanıyor. Web oynatıcı her yerde çalışır;
        // masaüstü uygulaması kuruluysa onu açmayı Spotify'ın kendi sayfası
        // zaten teklif ediyor.
        window.open('https://open.spotify.com/', '_blank', 'noopener');
      });
    }

    // --- Cihaz seçici ---
    // Senaryo: uygulama bilgisayarda açık, müzik telefonda çalıyor (veya tersi).
    // Kuyruk her zaman AKTİF cihaza gider, o yüzden hedefi seçebilmek gerekiyor.
    const openDevicePicker = async () => {
      if (typeof SpotifyAPI === 'undefined' || !SpotifyAPI.getDevices) return;
      if (typeof UI !== 'undefined') UI.showToast('Cihazlar alınıyor…', 'info', 1500);

      const devices = await SpotifyAPI.getDevices();
      if (!devices.length) {
        if (typeof UI !== 'undefined') {
          UI.showToast('Hiç cihaz bulunamadı. Spotify\'ı telefonunuzda veya bilgisayarınızda açın.', 'warning', 5000);
        }
        return;
      }

      UI.showDevicePicker(devices, async (d) => {
        if (d.isActive) {
          UI.showToast(d.name + ' zaten aktif cihaz.', 'info', 2500);
          return;
        }
        try {
          await SpotifyAPI.transferPlayback(d.id, false);
          UI.showToast('Hedef cihaz: ' + d.name, 'success', 3000);
          UI.announce('Hedef cihaz ' + d.name + ' olarak ayarlandı');
          setTimeout(retry, 900); // cihaz durumunu tazele
        } catch (err) {
          UI.showToast(err.message || 'Cihaz değiştirilemedi.', 'error', 5000);
        }
      });
    };

    const devicesBtn = $('show-devices-btn');
    if (devicesBtn) devicesBtn.addEventListener('click', openDevicePicker);

    // Üst bardaki cihaz rozeti de seçiciyi açsın. Dinleyici EBEVEYNE bağlanıyor:
    // app.js rozetin innerHTML'ini yeniden yazıyor, doğrudan bağlanan bir
    // dinleyici o anda silinirdi.
    const topbarRight = document.querySelector('#builder-screen .topbar-right');
    if (topbarRight) {
      topbarRight.addEventListener('click', (ev) => {
        if (ev.target.closest('#device-indicator')) openDevicePicker();
      });
      const ind = $('device-indicator');
      if (ind) {
        ind.setAttribute('role', 'button');
        ind.setAttribute('tabindex', '0');
        ind.setAttribute('title', 'Hedef cihazı değiştir');
        ind.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDevicePicker(); }
        });
      }
    }

    // Örnek metni kutuya yapıştır (artık <button>, tıklama app.js'te de bağlı)
    const example = $('example-text-sample');
    if (example) example.setAttribute('type', 'button');
  }

  // --------------------------------------------------
  // 4b · Redirect URI denetimi
  //
  // Spotify'ın kuralı: redirect URI ya HTTPS olmalı ya da AÇIK loopback
  // adresi (http://127.0.0.1:PORT veya http://[::1]:PORT). `localhost`
  // kabul edilmiyor ve eşleşme birebir. Uyuşmazsa Spotify
  // "redirect_uri: Not matching configuration" der ve akış hiç başlamaz.
  // Bunu giriş yapmadan ÖNCE söylemek, oraya gidip hata almaktan iyidir.
  // --------------------------------------------------
  function checkRedirectUri() {
    const warn = $('redirect-uri-warning');
    const warnText = $('redirect-uri-warning-text');
    const code = $('redirect-uri-code');
    if (!warn || !warnText) return;

    const href = window.location.href;
    const proto = window.location.protocol;
    const host = window.location.hostname;
    let message = '';

    if (proto === 'file:') {
      message = 'Sayfayı dosyaya çift tıklayarak açtınız (file://). Spotify bu adresi '
              + 'kabul etmiyor. Klasördeki serve.bat dosyasını çalıştırın, sonra '
              + 'tarayıcıda http://127.0.0.1:5500/ adresini açın.';
    } else if (host === 'localhost') {
      const suggested = href.split('?')[0].split('#')[0].replace('//localhost', '//127.0.0.1');
      message = 'Spotify "localhost" adresini kabul etmiyor — açık loopback adresi gerekiyor. '
              + 'Adres çubuğunda localhost yerine 127.0.0.1 yazın: ' + suggested;
    } else if (proto !== 'https:' && host !== '127.0.0.1' && host !== '[::1]' && host !== '::1') {
      message = 'Spotify, HTTPS olmayan adreslerde yalnız 127.0.0.1 veya [::1] loopback adresine izin veriyor. '
              + 'Şu anki adres (' + host + ') kabul edilmeyecek.';
    }

    const loginBtn = $('spotify-login-btn');
    const saveBtn = $('save-client-id');

    if (message) {
      warnText.textContent = message;
      warn.hidden = false;
      if (code) code.setAttribute('aria-invalid', 'true');

      // Uyarmak yetmiyor: bu adreste giriş DENEMESİ kesin başarısız.
      // Kullanıcıyı Spotify'ın anlamsız hata sayfasına göndermek yerine
      // düğmeyi kapatıyoruz.
      [loginBtn, saveBtn].forEach((b) => {
        if (!b) return;
        b.disabled = true;
        b.setAttribute('aria-describedby', 'redirect-uri-warning-text');
      });
      if (typeof UI !== 'undefined') UI.announce(message);
    } else {
      warn.hidden = true;
      [loginBtn, saveBtn].forEach((b) => { if (b) b.disabled = false; });
    }
  }

  // --------------------------------------------------
  // 5 · Kayan sekme göstergesi
  // --------------------------------------------------
  function wireTabIndicator() {
    const bar = document.querySelector('.tab-bar');
    if (!bar) return;

    // offsetLeft'in referansı offsetParent'a göre değişir; rect farkı her
    // yerleşimde doğru sonucu verir.
    const move = () => {
      const active = bar.querySelector('.tab-btn.active');
      if (!active) return;
      const barRect = bar.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      if (rect.width === 0) return; // ekran henüz görünür değil
      bar.style.setProperty('--tab-w', `${rect.width}px`);
      bar.style.setProperty('--tab-x', `${rect.left - barRect.left}px`);
    };

    move();
    requestAnimationFrame(move); // yazı tipi yüklendikten sonra genişlik değişir
    window.addEventListener('resize', move);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(move);

    const observer = new MutationObserver(() => requestAnimationFrame(move));
    bar.querySelectorAll('.tab-btn').forEach((t) =>
      observer.observe(t, { attributes: true, attributeFilter: ['class'] })
    );

    // Oluşturucu ekranı gizliyken ölçüm 0 döner; ekran açılınca yeniden ölç.
    const screen = $('builder-screen');
    if (screen) {
      observer.observe(screen, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  // --------------------------------------------------
  // 6 · Eşleşme ölçeri — app.js'in yazdığı "x/y" metnini izler
  // --------------------------------------------------
  function wireMatchMeter() {
    const source = $('summary-found');
    const fill = $('match-meter-fill');
    const meter = $('match-meter');
    if (!source || !fill || !meter) return;

    const update = () => {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(source.textContent || '');
      if (!m) return;
      const found = Number(m[1]);
      const total = Number(m[2]);
      const pct = total > 0 ? Math.round((found / total) * 100) : 0;
      fill.style.width = `${pct}%`;
      fill.classList.toggle('is-partial', pct < 100);
      meter.setAttribute('aria-label', `Eşleşme oranı: ${total} şarkıdan ${found} tanesi bulundu`);
    };

    update();
    new MutationObserver(update).observe(source, { childList: true, characterData: true, subtree: true });
  }

  // --------------------------------------------------
  // 7 · Üst barın kaydırma yükseltisi
  // --------------------------------------------------
  function wireScrollElevation() {
    const bars = Array.from(document.querySelectorAll('.topbar'));
    if (!bars.length) return;
    let ticking = false;
    const apply = () => {
      const scrolled = window.scrollY > 4;
      bars.forEach((b) => b.classList.toggle('is-scrolled', scrolled));
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });
    apply();
  }

  // --------------------------------------------------
  // 8 · İlerleme çubuğunda klavye desteği
  // --------------------------------------------------
  function wireSeekKeyboard() {
    const slider = $('np-progress-container');
    if (!slider) return;

    slider.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 5;
      let delta = 0;
      if (e.key === 'ArrowRight') delta = step;
      if (e.key === 'ArrowLeft') delta = -step;
      if (!delta) return;

      e.preventDefault();
      const current = Number(slider.getAttribute('aria-valuenow') || 0);
      const next = Math.max(0, Math.min(100, current + delta));
      slider.setAttribute('aria-valuenow', String(next));

      // app.js tıklama ile seek ediyor; aynı yolu konumlandırılmış
      // sentetik tıklama ile kullanırız.
      const rect = slider.getBoundingClientRect();
      const clientX = rect.left + (rect.width * next) / 100;
      slider.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY: rect.top + rect.height / 2,
      }));
    });
  }

  // --------------------------------------------------
  // 9 · Başlat
  // --------------------------------------------------
  function init() {
    // `const UI = ...` klasik bir script'te BETIK kapsamında kalır; global
    // nesneye yazılmaz. Bu yüzden window üzerinden yapılan kontrol her zaman
    // false döner ve tema ile çevrimdışı katmanı sessizce hiç kurulmazdı.
    if (typeof UI !== 'undefined') {
      UI.initTheme();
      UI.initOfflineWatch();
    }
    watchVisibility();
    watchTabs();
    wireClientIdValidation();
    wireStateActions();
    checkRedirectUri();
    wireTabIndicator();
    wireMatchMeter();
    wireScrollElevation();
    wireSeekKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
