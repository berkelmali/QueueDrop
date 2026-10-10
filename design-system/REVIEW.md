# QueueDrop Redesign — Çekişmeli Kurul İncelemesi

İncelenen: 16 Eylül 2026 tarihli tasarım güncellemesi (13 dosya, yerinde
redesign, `app.js` / `auth.js` / `parser.js` / `spotify.js` değiştirilmedi).

---

## 0 · Analist — ortak olgusal zemin

**Belge türü.** Çalışan bir vanilla-JS PWA üzerinde yapılmış kapsamlı bir
arayüz değişikliği ve eşlik eden tasarım sistemi dokümanı.

**Amaç.** Görsel kimliği yenilemek, tüm durum ekranlarını kurmak, erişilebilirlik
tabanı oluşturmak, açık tema eklemek — mevcut iş mantığına dokunmadan.

**Ana iddialar.**
1. Eski ID sözleşmesi tamamen korundu, bu yüzden `app.js` kırılmaz.
2. Kontrast mekanik olarak doğrulandı (16/16 çift AA).
3. Denetim 13 kontrolden 12'sini geçti, kalan bulgu yanlış pozitif.
4. Cam ve aurora performansı düşürmeyecek biçimde sınırlandı.

**Destekleyici veri.** `design_system.py check` çıktısı, `ui_audit.py` çıktısı
(342 kural, `partial: false`), `node --check` sözdizimi kontrolleri.

**Hedef kitle.** Tek geliştirici (Berk); ikincil olarak uygulamanın kullanıcısı.

**Örtük varsayımlar.**
- `app.js`'in DOM'a dokunma biçimi, okunan parçalardan tümüyle anlaşıldı.
- Sözdizimi kontrolü + statik CSS denetimi, çalışma anı doğruluğu için
  yeterli bir vekildir.
- Bir MutationObserver köprüsü, `app.js`'i düzenlemekten daha az risklidir.

**Belgenin kendisi hakkında söylediği riskler.** Gerçek tarayıcıda hiç
çalıştırılmadı; köprü kırılgan; açık temada marka yeşili değişti.

---

## 1 · Muhalefet — açılış

**M-1. "ID sözleşmesi korundu" iddiası yanlış ve bu kanıtlanabilir.**
`index.html` satır 205'te oluşturucu paneli `id="main-content"` taşıyor.
`app.js`'teki `switchTab` şunu yapıyor:
`panel.classList.toggle('active', panel.id === tabId)` — `tabId` değeri
`"builder-tab"`. Belgede `id="builder-tab"` diye bir öğe yok. Sonuç: kullanıcı
"Çalan & sıradakiler" sekmesine geçip geri döndüğünde oluşturucu sekmesi boş
kalır ve sayfa yenilenene kadar öyle kalır. Bu, uygulamanın birincil eylemini
yok eden bir regresyon ve tam olarak "korundu" denen şeyin ihlali.

**M-2. Köprü, bilinmeyen bir davranışa bahis oynuyor.**
`enhance.js` `hidden` ile `style.display`'i eşitliyor, ama ilk sürümdeki
koşul `el.style.display` doğru olduğunda çalışıyordu. `app.js` bir öğeyi
`el.style.display = ''` ile açarsa — ki bu yaygın bir kalıptır — koşul
sağlanmaz, `hidden` kalır, öğe hiç görünmez. Yazar `app.js`'in bu satırlarını
okuyamadı (bilgisayar çevrimdışıydı) ve yine de "çalışır" dedi.

**M-3. Mekanik denetim, güvenlik hissi üretiyor.**
`ui_audit.py` beyan edilen CSS'i okur. Bu redesign'ın en riskli kısmı CSS
değil, DOM sözleşmesi ve çalışma anı. Denetim M-1'i göremez, göremedi de.
"342 kural geçti" cümlesi, kırık bir sekmenin yanında durduğunda okuyucuyu
yanlış yöne çeker.

**M-4. Belgelenen davranış ile kod çelişiyordu.**
`MASTER.md` "uygulama koyu temayla açılır" diyor. Kod ise kayıt yoksa
`data-theme`'i siliyor ve sistem tercihine düşüyordu. Açık tema tercihli bir
işletim sisteminde ilk açılış beyaz olurdu — "premium karanlık" yönünün ilk
izlenimi hiç görülmezdi.

**M-5. Gerçekçi en kötü durum.** Dosyalar diske yazılır, kullanıcı sekme
değiştirir, uygulama boş ekran verir, sebep CSS'te aranır — oysa tek satırlık
bir `id`. Yedek alınmış olsa bile geri dönüş maliyeti, değişikliğin kendisinden
büyük.

---

## 2 · Savunma — nokta nokta

**M-1'e — tam kabul.** Bu bir hata ve savunulacak yanı yok. `<main>`
öğesine atlama bağlantısı hedefi olsun diye `main-content` verildi; sekme
panelinin kimliği olduğu gözden kaçtı. Düzeltildi: panel `id="builder-tab"`
oldu, atlama bağlantısı da oraya işaret ediyor. Kabul edilmesi gereken asıl
nokta şu: iddianın kendisi ("sözleşme korundu") doğrulanabilirdi ve
doğrulanmadı.

**M-2'ye — kabul, düzeltildi.** Gözlemci artık `el.hidden = (el.style.display
=== 'none')` yapıyor; boş dizge dahil her değer doğru yöne çeviriyor. Ayrıca
başlangıçta `hidden` olan öğelere inline `display:none` yazılıyor, böylece iki
temsil baştan hizalı. Yine de muhalefetin asıl noktası ayakta: `app.js`
okunamadan verilen "çalışır" hükmü, kanıt değil tahmindi.

**M-3'e — kısmi itiraz.** Denetimin DOM sözleşmesini görmediği doğru ve zaten
`AUDIT.md`'de "denetimin göremedikleri" başlığı altında yazılı. Ama denetim
gerçek bir iş yaptı: gözle yakalanamayacak bir kontrast hatasını (4.32:1)
yakaladı. Sorun denetimin varlığı değil, denetimden çıkan "geçti" tablosunun
kapsamının açıkça sınırlanmamış olması.

**M-4'e — tam kabul.** Düzeltildi; `data-theme="dark"` belgede duruyor ve
kayıt yoksa silinmiyor. Açık tema artık bilinçli bir tercih.

**Görmezden gelinen bağlam.** Değişikliğin yapısı — `app.js`'e hiç dokunmamak
— M-1'in maliyetini düşürüyor: geri dönüş, dört CSS dosyası, `index.html`,
`ui.js` ve `enhance.js`'i yedekten geri koymaktan ibaret; iş mantığı hiç
kirlenmedi. Ayrıca `_backup_predesign/` adımı yazma akışının parçası.

**Gerçek güçlü yanlar.** Kontrast doğrulaması gerçek bir hata buldu. Durum
matrisi gerçekten uygulandı (boş / iskelet / hata / çevrimdışı / cihaz-yok /
izin), sadece adı geçmiyor. Renk-tek-anlam sorunu metin çipiyle çözüldü.
Cam üç katmanla sınırlı, aurora gradyan tabanlı — bunlar ölçülebilir
performans kararları.

---

## 3 · Çapraz sorgu — tur 1 (Muhalefet → Savunma)

**S1.** Savunma "iddianın kendisi doğrulanabilirdi ve doğrulanmadı" diyor.
O hâlde geriye kaç doğrulanmamış iddia kaldı?
**Cevap.** Bilinen üç tane: (a) `app.js`'in `style.display` yazdığı tam öğe
listesi okunamadı — `SYNCED_IDS` listesi eski okumalardan çıkarıldı, eksik
olabilir; (b) `np-progress-container` için sentetik `MouseEvent`, `app.js`'in
seek işleyicisi `offsetX` kullanıyorsa yanlış konuma gider; (c) hiçbir dosya
tarayıcıda açılmadı. Üçü de rapora yazılmalı, "çalışır" denmemeli.

**S2.** "Yedek var" savunması, hata tarayıcıda değil kullanıcıda ortaya
çıkarsa ne işe yarıyor?
**Cevap.** Yaramaz. Yedek, geri dönüşü ucuzlatır; hatayı bulmayı değil.
Doğru karşılık duman testidir, yedek değil.

**S3.** `ui.js` baştan yazıldı. `app.js`'in çağırdığı her yöntem gerçekten
duruyor mu, yoksa bu da M-1 gibi doğrulanmamış bir iddia mı?
**Cevap.** Dışa açılan ad listesi eskisinin üst kümesi; `app.js`'in çağırdığı
14 adın hepsi `return` bloğunda mevcut. Bu doğrulanabilir ve doğrulandı.
`renderLiveQueue`'nun ikinci parametresi (`nowPlaying?.track`) artık
kullanılmıyor ama fazladan argüman zararsız.

---

## 4 · Çapraz sorgu — tur 2 (Savunma → Muhalefet)

**S1.** M-3, denetimi "güvenlik hissi üretiyor" diye eleştiriyor. Denetim
olmasaydı 4.32:1 kontrast hatası hangi mekanizmayla yakalanacaktı?
**Cevap.** Yakalanmazdı. M-3'ün iddiası denetimin değersiz olduğu değil,
kapsamının raporda abartıldığı. Bu fark kabul edilirse M-3 zayıflar ama
düşmez: "13 kontrolden 12'si geçti" cümlesi, kontrol edilmeyen alanın
büyüklüğünü söylemeden duruyorsa hâlâ yanıltıcıdır.

**S2.** M-5'teki "en kötü durum", düzeltmelerden sonra hâlâ geçerli mi?
**Cevap.** M-1 ve M-2 kapandığı için o senaryo artık bilinen bir yoldan
gelmiyor. Ama S1'deki üç doğrulanmamış iddia, aynı sonucu başka bir kapıdan
üretebilir. En kötü durum daha az olası; ortadan kalkmadı.

---

## 5 · Beş bağımsız hüküm

Her hâkim yalnızca yukarıdaki tutanağı okudu.

### J1 — Mantık / kanıt
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"`index.html` satır
205'te oluşturucu paneli `id="main-content"` taşıyor… Belgede
`id="builder-tab"` diye bir öğe yok."* Bu, merkezi iddianın (ID sözleşmesi
korundu) yanlış olduğunu kanıtlıyordu ve savunma tam kabul etti. Kanıtın
kalitesi yüksek: dosya satırı, kod yolu ve sonuç birlikte verilmiş. Düzeltme
sonrası iddia tekrar doğrulanabilir hâle geldi, ama süreç kusuru gerçek:
doğrulanabilir bir iddia doğrulanmadan raporlandı. Güven: **Yüksek**.

### J2 — Risk
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"Yedek, geri dönüşü
ucuzlatır; hatayı bulmayı değil. Doğru karşılık duman testidir."* Değişikliğin
risk profili aslında iyi kurulmuş — iş mantığı dosyalarına hiç dokunulmaması,
geri dönüşü dosya kopyalamaya indirger ve bu ciddi bir azaltıcı. Kalan risk
tersine çevrilebilir ve sınırlı. Ama üç doğrulanmamış iddia (`SYNCED_IDS`
eksikliği, sentetik seek, sıfır tarayıcı testi) hâlâ açık ve bunların ikisi
sessizce bozulan türden — kullanıcı fark etmeden yanlış davranır. Güven:
**Yüksek**.

### J3 — Uygulanabilirlik
**Hüküm: Savunulabilir.** Belirleyici argüman: *"geri dönüş, dört CSS dosyası,
`index.html`, `ui.js` ve `enhance.js`'i yedekten geri koymaktan ibaret; iş
mantığı hiç kirlenmedi."* Uygulanabilirlik açısından bu iş temiz kurulmuş:
kapsam net, dosya sayısı sınırlı, bağımlılık eklenmemiş, build adımı yok,
her çıktı tek bir klasörde hazır. Kalan iş — yazma + duman testi — dakikalar
sürer. Tespit edilen iki hata da zaten düzeltilmiş durumda. Güven: **Orta**.

### J4 — Şüpheci (varsayılan konum: aleyhte)
**Hüküm: Kısmen Savunulabilir.** Belirleyici argüman: *"Denetim M-1'i
göremez, göremedi de."* En güçlü itiraz buydu ve savunma onu tam olarak
yanıtlamadı — kısmi itirazla geçiştirdi. Asıl mesele şu: bu iş, mekanik
doğrulamanın güçlü olduğu alanda (renk, ölçü) sıkı, zayıf olduğu alanda
(DOM sözleşmesi, çalışma anı) tamamen doğrulamasızdı; ve rapor bu asimetriyi
okuyucuya göstermeden "geçti" tablosu sundu. Bulunan tek kritik hatanın
denetim tarafından değil, incelemeyi yapan kişinin ikinci bir okumasıyla
bulunmuş olması bu noktayı kanıtlıyor. Düzeltmeler gerçek, o yüzden "Değil"
değil; ama süreç kendini denetleyemiyordu. Güven: **Yüksek**.

### J5 — Dengeleyici
**Hüküm: Kısmen Savunulabilir.** İki taraf da haklı olduğu yerde haklı.
Muhalefet, iddia ile kanıt arasındaki boşluğu doğru teşhis etti — ve teşhis
somut bir hataya bağlandığı için retorik değil. Savunma ise M-3'e verdiği
kısmi itirazda haklı: *"denetim gerçek bir iş yaptı: gözle yakalanamayacak bir
kontrast hatasını (4.32:1) yakaladı."* Bu ikisi çelişmiyor. Sonuç değişmiyor:
tasarım işi sağlam, doğrulama anlatısı fazla iddialıydı. Tutarlı hâle gelmesi
için gereken şey daha fazla tasarım değil, rapor dilinin kapsamla
hizalanması ve bir duman testi. Güven: **Orta**.

---

## 6 · Sayım

| Hüküm | Sayı | Hâkimler |
|---|---|---|
| Savunulabilir | 1 | J3 |
| **Kısmen Savunulabilir** | **4** | J1, J2, J4, J5 |
| Savunulamaz | 0 | — |

Yeter sayı: 5/5 geçerli hüküm (≥4 gerekli). ✅
Çoğunluk: 4/5 — **Kısmen Savunulabilir**.
Çoğunluktaki Yüksek güven sayısı: 3 (J1, J2, J4) → **Güç etiketi: Güçlü**.

## Nihai hüküm

**Kısmen Savunulabilir (Güçlü).**

Tasarım kararlarının kendisi ayakta: palet doğrulanmış, durum matrisi
uygulanmış, erişilebilirlik tabanı gerçek, performans kısıtları bilinçli.
Kurul iki gerçek kusur buldu — biri uygulamanın birincil sekmesini bozacak
düzeyde — ve ikisi de düzeltildi. Ayakta kalan eleştiri bir tasarım eleştirisi
değil, bir **doğrulama eleştirisi**: doğrulanabilir iddialar doğrulanmadan
raporlandı ve mekanik denetimin kapsamı olduğundan geniş sunuldu.

Bu yüzden "Savunulabilir" değil. Bir duman testi ve rapor dilinin
düzeltilmesiyle oraya çıkar.

---

## Bu inceleme sonrası yapılan düzeltmeler

| # | Bulgu | Durum |
|---|---|---|
| K-1 | Oluşturucu paneli `id="main-content"` → sekme değişince boş kalıyordu | `id="builder-tab"` yapıldı, atlama bağlantısı güncellendi |
| K-2 | `enhance.js` `display: ''` durumunda öğeyi gizli bırakıyordu | `el.hidden = (el.style.display === 'none')` + başlangıç hizalaması |
| K-3 | `MASTER.md` "koyu açılır" diyordu, kod sistem tercihine düşüyordu | İlk açılış koyu; açık tema bilinçli tercih |
| K-4 | Modal'da `<span>` içinde ellipsis çalışmıyordu | `.track-card-*` sınıflarına `display: block` |
| K-5 | Örnek metin `<button>` oldu ama ortalanmış ve tıklanabilir görünmüyordu | Sola hizalı, tam genişlik, hover/odak affordance'ı |
| K-6 | `Bulunamadı` çipi dar ekranda başlık sütununu eziyordu | Görünen etiket `Yok`, tam anlam `aria-label`'da |
| K-7 | Font `@import` render'ı blokluyordu | `<link>` + `preconnect` |

## Kapanmayan üç maddenin akıbeti

Bilgisayar bağlantısı geri gelince üçü de ele alındı.

**1 — `SYNCED_IDS` eksik olabilir mi? Hayır.** `grep -n "style.display"
js/app.js` beş kullanım gösterdi: `step-client-id`, `step-spotify-login`
(satır 704-714), `device-indicator`, `device-warning` (758-764),
`queue-progress` (977, 1011). Beşi de listede; liste aslında üst küme.
Ayrıca hepsi açık değer (`'block'` / `'flex'` / `'none'`) kullanıyor, hiçbiri
`''` yazmıyor — yani K-2'de düzeltilen risk bu kod tabanında zaten
tetiklenmiyordu. Düzeltme yine de doğru, ama tehdit varsayılandan küçüktü.

**2 — Sentetik seek doğru mu? Evet.** `handleSeek` (satır 617-625)
`e.clientX` ve `getBoundingClientRect()` kullanıyor; `offsetX` yok. Klavye
ile üretilen olay tam olarak bu iki değeri sağlıyor.

**3 — Bu okuma yeni bir hata buldu (K-8).** `app.js` giriş adım panelini
inline `display: block` ile açıyor. Panel CSS'te `display: flex; gap:
var(--space-3)` idi; inline stil bunu ezince `gap` etkisiz kalıyor ve
paneldeki butonlar bitişiyordu. `display: block` + kardeş marjına
çevrildi. Bu, mekanik denetimin değil, karşı tarafın kodunu okumanın
bulduğu üçüncü hata — J4'ün itirazını doğrulayan üçüncü örnek.

**Tarayıcı testi hâlâ yapılmadı.** Sözdizimi ve statik denetim geçmesi
"çalışıyor" demek değildir; bu madde açık kalıyor.
