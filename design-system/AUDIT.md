# QueueDrop — Mekanik Denetim Raporu

```
ui_audit.py index.html --css <birleştirilmiş css> --tokens design-system/tokens.json --platform mobile-web
344 kural, 96 özel özellik, kısmi okuma yok (partial: false)
```

Denetim **beyan edilen CSS'i** okur, ekrana çizileni değil. Temiz bir denetim
tabandır, karar değil: hiyerarşinin işleyip işlemediğini ölçmez.

## Kapsam uyarısı — önce bunu okuyun

Aşağıdaki tablo **CSS katmanı** hakkındadır. DOM sözleşmesi (`id` / sınıf
kancaları), çalışma anı davranışı ve `app.js` ile etkileşim bu denetimin
görüş alanında **değildir**. Nitekim bu redesign'daki tek kritik hata —
oluşturucu panelinin `id`'sinin değişmiş olması — denetimden değil, ikinci
bir okumadan çıktı (`REVIEW.md`, K-1). "13 kontrolden 12'si geçti" cümlesini
bu sınırla birlikte okuyun.

## Sonuç

| Kontrol | Durum |
|---|---|
| contrast (CSS değişkenleri çözülerek) | geçti |
| type-size (mobil taban 15px) | geçti |
| tap-target (44px) | 1 bulgu — aşağıda |
| reflow (sabit yükseklik, nowrap) | geçti |
| colour-only (renkle anlatılan durum) | geçti |
| motion (reduced-motion bloğu) | geçti |
| focus (bastırılmış outline) | geçti |
| alt (alt özniteliği olmayan görsel) | geçti |
| headings (atlanan başlık seviyesi) | geçti |
| naming (erişilebilir adı olmayan ikon butonu) | geçti |
| theming (koyu tema karşılığı olmayan renk) | geçti |
| measure (üst sınırı olmayan okuma sütunu) | geçti |
| coverage (okunamayan stil) | geçti |

İlk çalıştırmada 8 bulgu vardı. Düzeltilenler:

- **6 × contrast.** `--color-text-faint` açık temada `#6C7773` = 4.32:1,
  AA sınırı 4.5. `#5E6864` yapıldı (5.37:1). Altı ayrı seçici aynı token'a
  bağlı olduğu için tek değişiklikle kapandı. Gözle yakalanacak bir fark
  değildi — denetimin varlık sebebi bu.
- **1 × reflow.** `.loading-dots span` sabit `height: 5px`. `aspect-ratio: 1`
  ile değiştirildi; içinde metin yok, ama sabit yükseklik beyan etmeye
  gerek de yok.
- **1 × tap-target (kısmi).** `.btn .btn-spinner` `height: 17px` — aynı
  düzeltmeyle yükseklik beyanı kalktı.

## Kalan tek bulgu — yanlış pozitif olarak bırakıldı

```
TAP-TARGET
  .btn .btn-spinner  width: 17px (minimum 44px)
```

`.btn-spinner`, en az 44px yüksekliğindeki bir butonun **içindeki** dönen
halkadır; kendisi tıklanabilir bir öğe değildir. Denetim seçiciyi `.btn`
soyundan geldiği için etkileşimli sayıyor. İki seçenek vardı:

1. Sınıfı `.btn` dışına çıkacak şekilde yeniden adlandırmak — bulgu kaybolur,
   gerçek değişmez. Bu, bulguyu susturmaktır.
2. Bırakmak ve raporda gerekçesini yazmak.

İkincisi seçildi. Denetim çıkış kodu bu yüzden **1**, 0 değil. Çıkış kodu 3
olmadığı için stil dosyalarının tamamı okundu — yani "geçti" satırları
gerçek kapsama dayanıyor.

## Denetimin göremedikleri

- Çalışma anında JS ile atanan stiller (`element.style.*`)
- Gerçek piksel çıktısı: satır uzunluğu, ritim, yoğunluk
- Ekranın doğru akış olup olmadığı

Bunlar için `MASTER.md`'deki eleştiri kriterleri ve gerçek cihazda deneme
gerekir.

---

# Tarayıcı Duman Testi (16 Eylül 2026)

Her incelemede açık kalan madde kapandı. Uygulamanın tamamı — `app.js`,
`auth.js`, `spotify.js`, `parser.js` dahil — konteynerde birleştirilip
headless Chromium'da 390×844 görünümde çalıştırıldı.

```
node smoke-test.js   →   20/20 geçti
```

Test edilenler: konsol hatası yokluğu, tema varsayılanı ve düğmesi, redirect
URI denetimi (127.0.0.1 ve localhost ayrı ayrı), K-1 sekme dönüşü, K-8 panel
boşluğu, demo modu, kayan sekme göstergesi, `aria-selected` senkronu, örneği
doldur, uzun cihaz adında üst bar taşması, mini oynatıcı örtüşmesi.

## Testin bulduğu ve statik denetimin göremediği dört hata

### T-1 · `hidden` özniteliği hiç gizlemiyordu [kritik]

`hidden`, kullanıcı-aracısı stilinde `display: none` demek. Ama
`.field-error { display: flex }` gibi bir **yazar** kuralı bunu ezer. Ölçüm:

```
redirect-uri-warning: hidden=true  computedDisplay=flex  görünür=true
client-id-error:      hidden=true  computedDisplay=flex  görünür=true
```

Yani Client ID hata mesajı ve redirect URI uyarısı **her zaman açıktı**.
Düzeltme: `index.css` içinde `[hidden] { display: none !important; }`.
`app.js` inline `style.display` ile gösterdiğinde `enhance.js` gözlemcisi
`hidden`i aynı mikro-görevde kaldırdığı için boyamadan önce senkron olur.

### T-2 · `window.UI` ve `window.SpotifyAPI` her zaman `undefined` [kritik]

Klasik bir script'te `const UI = (() => {...})()` **betik kapsamında** kalır;
global nesneye yazılmaz. `enhance.js` ve `ui.js` bu modülleri `window.UI` /
`window.SpotifyAPI` üzerinden kontrol ediyordu — kontrol her zaman false
dönüyordu. Sonuç: **tema düğmesi, çevrimdışı izleyicisi ve çalma-durumu hata
ekranı hiç kurulmuyordu.** Üçü de sessizce ölü koddu; sözdizimi kontrolü,
mekanik denetim ve kurul incelemesi üçü de göremedi.

Ölçüm: `{"UIvar":"undefined","initThemeVar":"undefined"}` — tema düğmesine
tıklamak `data-theme`'i değiştirmiyordu.

Düzeltme: `typeof UI !== 'undefined'`.

### T-3 · Uzun cihaz adı üst barı ikinci satıra taşırıyordu [yerleşim]

`app.js` cihaz adını `innerHTML = '<span class="dot"></span>' + ad` ile
basıyor; ad **düz bir metin düğümü**. Flex kapsayıcıda düz metin anonim bir
flex öğesi olur ve `text-overflow: ellipsis` uygulanmaz. "Telefon (Spotify
Connect)" iki satıra sarıp logoyu eziyordu. Çip `inline-block`a çevrildi,
`white-space: nowrap` + ellipsis artık çalışıyor. Ölçüm: üst bar 69px,
çip 148px.

### T-4 · Mini oynatıcı içeriğin son satırını örtüyordu [yerleşim]

`.builder-content` alt boşluğu 64px'ti; sabit mini oynatıcı ~56px + kenar
payı. Sayfanın sonuna kaydırınca örnek kartı oynatıcının altında kalıyordu.
132px'e çıkarıldı. Ölçüm: boşluk 58px.

Ayrıca iki cila: odakta çift halka (kenarlık + dış halka) tek vurguya
indirildi, bildirim üst barın altına alındı.

## Test ortamının bir sınırı

Konteyner proxy'si `fonts.googleapis.com`u engelliyor, bu yüzden Inter
yüklenmiyor ve konsola bir `ERR_TUNNEL_CONNECTION_FAILED` düşüyor. Uygulama
hatası değil; test bu tek deseni filtreliyor ve bunu açıkça yazıyor.
Kullanıcının makinesinde yazı tipi normal yüklenir.

---

# Bilinen iki yanlış pozitif (17 Eylül)

Denetim iki bulgu veriyor ve ikisi de bilerek bırakıldı. Susturmak yerine
gerekçeleri burada duruyor.

**1 · `tap-target` — `.btn .btn-spinner` 17px.**
En az 44px yüksekliğindeki bir butonun *içindeki* dönen halka; kendisi
tıklanabilir değil. Denetim `.btn` soyundan geldiği için etkileşimli sayıyor.
Sınıfı yeniden adlandırmak bulguyu kaybettirir ama gerçeği değiştirmez.

**2 · `focus` — `h1/h2/h3[tabindex="-1"]:focus { outline: none }`.**
`ui.js:showScreen()` ekran değişiminde başlığa odak veriyor; ekran okuyucu
kullanıcısının yeni ekranın neresi olduğunu duyması için gerekli. Ama Chrome
bu programatik odağı `:focus-visible` sayıp fare kullanıcısına da halka
gösteriyordu — etkileşimli olmayan bir başlıkta yanlış sinyal (kullanıcı
ekran görüntüsüyle bildirdi). Halka yalnız başlıklarda kapatıldı; düğme,
giriş alanı ve bağlantılarda `:focus-visible` aynen duruyor. Başlıklar Tab
ile odaklanmaz, yani klavye kullanıcısı hiçbir şey kaybetmez.

Denetim çıkış kodu bu yüzden 0 değil. Sıfır görmek için ikisini de gizlemek
gerekirdi; gizlenmedi.
