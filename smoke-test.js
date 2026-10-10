const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const results = [];
  const ok = (n, pass, detail = '') => results.push({ n, pass, detail });

  for (const host of ['127.0.0.1', 'localhost']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    const IGNORE = /fonts\.googleapis|ERR_TUNNEL/;  // konteyner proxy'si engelliyor, uygulama hatası değil
    page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

    await page.goto(`http://${host}:8099/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    if (host === '127.0.0.1') {
      ok('konsol hatasız', errors.length === 0, errors.join(' | ').slice(0, 200));
      ok('giriş ekranı görünür', await page.isVisible('#login-screen'));
      ok('tema koyu açılıyor', (await page.getAttribute('html', 'data-theme')) === 'dark');
      ok('redirect URI gerçek değeri gösteriyor',
         (await page.textContent('#redirect-uri-code')).includes('127.0.0.1:8099'));
      ok('127.0.0.1 için uyarı YOK', await page.isHidden('#redirect-uri-warning'));

      // K-8: adım panelindeki butonlar bitişik mi?
      const gap = await page.evaluate(() => {
        const sec = document.querySelector('#step-client-id .config-section');
        const btn = document.getElementById('save-client-id');
        if (!sec || !btn) return null;
        return Math.round(btn.getBoundingClientRect().top - sec.getBoundingClientRect().bottom);
      });
      ok('K-8 adım paneli boşluğu (12px bekleniyor)', gap === 12, `ölçülen: ${gap}px`);

      // Demo moduna geç
      await page.click('#demo-mode-btn');
      await page.waitForTimeout(600);
      ok('demo modu oluşturucu ekranını açıyor', await page.isVisible('#builder-screen'));
      ok('oluşturucu sekmesi görünür', await page.isVisible('#builder-tab'));

      // K-1: sekme değiştir, geri dön
      await page.click('#tab-live-queue');
      await page.waitForTimeout(400);
      const liveVisible = await page.isVisible('#live-queue-tab');
      await page.click('#tab-builder');
      await page.waitForTimeout(400);
      ok('K-1 canlı kuyruk sekmesi açıldı', liveVisible);
      ok('K-1 geri dönünce oluşturucu BOŞ DEĞİL', await page.isVisible('#song-input'));

      // Kayan sekme göstergesi
      const tabW = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.tab-bar')).getPropertyValue('--tab-w').trim());
      ok('kayan sekme göstergesi ölçüldü', tabW && parseFloat(tabW) > 40, `--tab-w: ${tabW}`);

      // aria-selected senkronu
      ok('aria-selected senkron', (await page.getAttribute('#tab-builder', 'aria-selected')) === 'true');

      // Tema düğmesi
      await page.click('#theme-toggle');
      await page.waitForTimeout(250);
      ok('tema düğmesi açık temaya geçiyor', (await page.getAttribute('html', 'data-theme')) === 'light');
      await page.screenshot({ path: '/home/claude/shot-light.png' });
      await page.click('#theme-toggle');
      await page.waitForTimeout(250);
      ok('tema düğmesi koyuya dönüyor', (await page.getAttribute('html', 'data-theme')) === 'dark');

      // Örnek doldur + arama (ağ yok, hata yolunu tetikler)
      await page.click('#fill-example-btn');
      await page.waitForTimeout(200);
      const filled = (await page.inputValue('#song-input')).length > 10;
      ok('örneği doldur çalışıyor', filled);

      // F1 — uzun cihaz adı üst barı taşırıyor mu?
      const topbar = await page.evaluate(() => {
        const el = document.getElementById('device-indicator');
        const bar = document.querySelector('#builder-screen .topbar');
        if (!el || !bar) return null;
        el.hidden = false;
        el.style.display = 'inline-block';
        el.innerHTML = '<span class="dot"></span>Berk\u2019in iPhone 15 Pro Max (Spotify Connect)';
        const h = Math.round(bar.getBoundingClientRect().height);
        return { barH: h, chipW: Math.round(el.getBoundingClientRect().width) };
      });
      ok('F1 uzun cihaz adı üst barı taşırmıyor', topbar && topbar.barH <= 72,
         `üst bar: ${topbar && topbar.barH}px, çip: ${topbar && topbar.chipW}px`);

      // F2 — son içerik mini oynatıcının altında kalıyor mu?
      const overlap = await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 200));
        const last = document.querySelector('.builder-example');
        const mini = document.getElementById('mini-player');
        if (!last || !mini || mini.hidden) return null;
        return Math.round(mini.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
      });
      ok('F2 içerik mini oynatıcının altında kalmıyor', overlap === null || overlap >= 0,
         `boşluk: ${overlap}px`);

      // Cihaz seçici — bilgisayarda açıkken telefonu hedef seçme senaryosu
      const cihaz = await page.evaluate(async () => {
        let aktarilan = null;
        SpotifyAPI.getDevices = async () => ([
          { id: 'pc1', name: 'Web Player (Chrome)', type: 'Computer', isActive: true, isRestricted: false },
          { id: 'tel1', name: 'Berk\u2019in iPhone', type: 'Smartphone', isActive: false, isRestricted: false },
          { id: 'tv1', name: 'Salon TV', type: 'TV', isActive: false, isRestricted: true },
        ]);
        SpotifyAPI.transferPlayback = async (id) => { aktarilan = id; return true; };

        const warn = document.getElementById('device-warning');
        warn.hidden = false; warn.style.display = 'flex';
        document.getElementById('show-devices-btn').click();
        await new Promise(r => setTimeout(r, 400));

        const sheet = document.querySelector('.modal-sheet');
        const items = sheet ? [...sheet.querySelectorAll('.device-item')] : [];
        const isimler = items.map(i => i.querySelector('.track-card-title').textContent);
        const kilitli = items.filter(i => i.disabled).length;
        const telefon = items.find(i => i.textContent.includes('iPhone'));
        if (telefon) telefon.click();
        await new Promise(r => setTimeout(r, 300));
        return { acildi: !!sheet, isimler, kilitli, aktarilan, kapandi: !document.querySelector('.modal-sheet') };
      });
      ok('cihaz seçici açılıyor', cihaz.acildi);
      ok('üç cihaz listeleniyor', cihaz.isimler.length === 3, cihaz.isimler.join(' | '));
      ok('kısıtlı cihaz seçilemiyor', cihaz.kilitli === 1, `kilitli: ${cihaz.kilitli}`);
      ok('telefon seçilince aktarım çağrılıyor', cihaz.aktarilan === 'tel1', `aktarılan: ${cihaz.aktarilan}`);
      ok('seçimden sonra sayfa kapanıyor', cihaz.kapandi);

      // "Spotify'ı aç" düğmesi: kurulu olmayan bir protokolü değil, web oynatıcıyı açmalı
      const acilanAdres = await page.evaluate(() => {
        let yakalanan = null;
        const asil = window.open;
        window.open = (u) => { yakalanan = u; return null; };
        const b = document.getElementById('open-spotify-btn');
        if (b) b.click();
        window.open = asil;
        return yakalanan;
      });
      ok('Spotify aç düğmesi web oynatıcıyı açıyor',
         acilanAdres === 'https://open.spotify.com/', `açılan: ${acilanAdres}`);

      await page.screenshot({ path: '/home/claude/shot-builder.png', fullPage: true });

      // Canlı kuyruk ekranı görüntüsü
      await page.click('#tab-live-queue');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/home/claude/shot-queue.png', fullPage: true });

      ok('demo sonrası konsol hatasız', errors.length === 0, errors.join(' | ').slice(0, 300));
    } else {
      // localhost: uyarı çıkmalı
      const warnVisible = await page.isVisible('#redirect-uri-warning');
      const warnText = warnVisible ? await page.textContent('#redirect-uri-warning-text') : '';
      ok('localhost için uyarı ÇIKIYOR', warnVisible, warnText.slice(0, 120));
      ok('uyarı 127.0.0.1 öneriyor', warnText.includes('127.0.0.1'));
      await page.screenshot({ path: '/home/claude/shot-localhost-warning.png' });
    }
    await ctx.close();
  }

  // ---- file:// — kullanıcıyı gerçekten vuran durum ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('file:///home/claude/smoke/index.html');
    await page.waitForTimeout(500);

    const warnVisible = await page.isVisible('#redirect-uri-warning');
    ok('file:// uyarısı GÖRÜNÜYOR', warnVisible);

    const text = warnVisible ? await page.textContent('#redirect-uri-warning-text') : '';
    ok('file:// uyarısı serve.bat diyor', text.includes('serve.bat'), text.slice(0, 90));

    ok('file:// giriş düğmesi KAPALI', await page.isDisabled('#spotify-login-btn'));

    // Yapısal koruma: uyarı, gizlenebilen adım panelinin içinde olmamalı.
    const kap = await page.evaluate(() => {
      const w = document.getElementById('redirect-uri-warning');
      return w && w.closest('#step-client-id') ? 'adım panelinin içinde' : 'panel dışında';
    });
    ok('uyarı gizlenebilen panelin DIŞINDA', kap === 'panel dışında', kap);

    // Client ID kayıtlıyken adım 1 gizlenir — uyarı yine görünmeli mi?
    await page.evaluate(() => {
      document.getElementById('step-client-id').style.display = 'none';
      document.getElementById('step-spotify-login').style.display = 'block';
    });
    await page.waitForTimeout(200);
    ok('adım 2\'deyken uyarı hâlâ görünüyor', await page.isVisible('#redirect-uri-warning'));

    await page.screenshot({ path: '/home/claude/shot-file-uyari.png' });
    await ctx.close();
  }

  await browser.close();
  let fails = 0;
  for (const r of results) {
    if (!r.pass) fails++;
    console.log(`${r.pass ? 'GEÇTI ' : 'KALDI '} ${r.n}${r.detail ? '  → ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - fails}/${results.length} geçti`);
  process.exit(fails ? 1 : 0);
})();
