# QueueDrop — Tasarım Sistemi

Bu dosya tasarımın kaynağıdır. Burada olmayan bir renk, ölçü ya da süre
arayüze girmez. Bir ekranda sapma gerekiyorsa gerekçesi bu dosyaya yazılır;
gerekçesiz sapma sürüklenmedir.

- Üretim: `design_system.py` (kontrast doğrulaması) + elde kurulan palet
- Doğrulama: `ui_audit.py` — bkz. `AUDIT.md`
- Token dosyaları: `tokens.json` (makine), `../css/tokens.css` (uygulama)

---

## Ürün çerçevesi

| | |
|---|---|
| **Yüzey** | Mobil öncelikli PWA, tek sayfa, dört ekran |
| **Birincil eylem** | Yapıştırılan listeyi Spotify kuyruğuna eklemek |
| **Kullanım bağlamı** | Tek elle, yürürken, müzik zaten çalarken |
| **Ton** | bold — hiyerarşi yüksek kontrastlı tipografiyle kurulur, parlaklıkla değil |
| **Desen** | Kimlik + tek birincil eylem · yapıştırma alanı · doğrulama önizlemesi · onay · canlı çalma durumu |

Yön: **premium karanlık + akustik yeşil**, üzerine **ölçülü cam** (yalnız yüzen
katmanlar) ve **statik aurora zemin**. Cam ve aurora efekt olarak değil,
katman hiyerarşisini okutmak için var: yüzen bir şey kayan içeriğin üstünde
durduğunu göstermeli.

---

## Palet

İki tema tam kurulu. `:root` açık temayı taşır; koyu tema hem
`prefers-color-scheme` hem `data-theme="dark"` ile tanımlıdır. Uygulama koyu
temayla açılır, kullanıcı üst bardaki düğmeyle değiştirir, tercih
`localStorage`'da kalır.

| Rol | Açık | Koyu |
|---|---|---|
| bg | `#F6F7F6` | `#07090C` |
| surface | `#FFFFFF` | `#12161C` |
| surface-3 | `#EFF2F0` | `#1E242D` |
| text | `#0D1411` | `#F2F5F7` |
| muted | `#59635F` | `#A3AEBA` |
| faint | `#5E6864` | `#8A95A1` |
| primary | `#0B7D36` | `#1ED760` |
| on-primary | `#FFFFFF` | `#04140A` |
| accent | `#4B32D4` | `#9B87FF` |
| warning | `#8A5300` | `#FFC24B` |
| danger | `#B3261E` | `#FF7A7A` |
| border | `#D8DEDA` | `#242C36` |

Spotify yeşili koyu temada aksan olarak kalır (`#1ED760`). Açık temada aynı
yeşil beyaz üstünde AA'yı geçmez, bu yüzden açık tema `#0B7D36` kullanır — aynı
marka, farklı aydınlık. Bu, paletin tek gerçek "marka tavizi"dir ve
kontrastın pazarlık konusu olmamasından kaynaklanır.

### Kontrast — hesaplanmış

`design_system.py check` ile 16 çift, WCAG 2.1 AA:

```
ok light text on bg        17.38:1     ok dark  text on bg        18.21:1
ok light text on surface   18.66:1     ok dark  text on surface   16.57:1
ok light muted on bg        5.79:1     ok dark  muted on bg        8.85:1
ok light muted on surface   6.22:1     ok dark  muted on surface   8.05:1
ok light on_primary/primary 5.25:1     ok dark  on_primary/primary 9.86:1
ok light primary on bg      4.89:1     ok dark  primary on bg     10.39:1
ok light danger on bg       6.09:1     ok dark  danger on bg       7.90:1
ok light success on bg      4.89:1     ok dark  success on bg     11.54:1
```

`faint` rolü ilk denetimde açık temada 4.32:1 ile kaldı; `#6C7773` →
`#5E6864` yapıldı (şimdi 5.37:1). Bu, gözle yakalanmayacak, denetimle
yakalanan türden bir hatadır.

---

## Tipografi

Tek aile: **Inter**. Hiyerarşi ağırlıkla kurulur, boyut enflasyonuyla değil.
Ölçek 1.25, taban 16px.

| Token | px | Kullanım |
|---|---|---|
| `--text-xs` | 13 | meta, etiket, süre — gövde metni değil |
| `--text-sm` | 15 | gövde tabanı, bunun altına inilmez |
| `--text-base` | 16 | giriş alanları, birincil buton |
| `--text-md` | 18 | kart başlığı, çalan şarkı |
| `--text-lg` | 22 | ekran başlığı |
| `--text-xl` | 28 | başarı ekranı |
| `--text-2xl` | 34 | ürün adı |

Okuma genişliği `--measure: 64ch` ile sınırlı. Sayısal alanlarda
`font-variant-numeric: tabular-nums` — süre ve sayaçlar güncellenirken
zıplamaz.

---

## Hareket

Süre 160–320ms, easing `cubic-bezier(.2,.8,.2,1)`. Hareket durum değişimini
onaylar; dekoratif hareket yok.

Aurora zemin **varsayılan olarak hareketsiz**. Tek bir katman, sadece
`prefers-reduced-motion: no-preference` ise 28 saniyelik bir opaklık
sürüklenmesi yapar; `blur` değil `radial-gradient` kullanır, yani kaydırma
maliyeti sıfırdır. Liste satırlarına cam/blur uygulanmaz — bu, düşük uçlu
telefonda kaydırma FPS'ini düşüren en yaygın hatadır.

`prefers-reduced-motion: reduce` tüm animasyon ve geçişleri sıfırlar;
konfeti hiç oluşturulmaz (JS tarafında da kontrol edilir, sadece CSS'te
gizlenmez).

---

## Katmanlar ve cam

Cam yalnız üç yerde: üst bar, alt aksiyon çubuğu, mini oynatıcı. Üçü de
kayan içeriğin üstünde duran yüzen katmanlar. `@supports` ile korumalı;
`backdrop-filter` desteklenmiyorsa opak yüzeye düşer, okunabilirlik değişmez.

---

## Dokunma ve odak

- Dokunma hedefi tabanı **44px** — buton, sekme, çip, oynatıcı kontrolü dahil
- Odak halkası tek tanım: `:focus-visible` → 2px `--color-focus`, 2px offset
- `outline: none` hiçbir yerde tek başına kullanılmaz
- Alt sayfa (modal) Escape ile kapanır, odak açılıştan önceki öğeye döner

---

## Durumlar

Ekran veri çekiyorsa tek bir ekran değildir. Uygulanan durumlar:

| Durum | Nerede | Kopya yaklaşımı |
|---|---|---|
| boş | kuyruk listesi, çalan şarkı | ne olduğunu değil, ne yapılacağını söyler |
| yükleniyor | arama sonuçları, kuyruk | iskelet satır — yerleşim zıplamaz |
| hata | çalma durumu | neden + yeniden dene düğmesi |
| çevrimdışı | oluşturucu sekmesi | yazılanın kaybolmadığını söyler |
| cihaz yok | oluşturucu sekmesi | çözümü söyler + yeniden kontrol düğmesi |
| izin | giriş ekranı, adım 2 | OAuth'un neden gerektiğini açıklar |

"Kuyruk boş" ile "aktif cihaz yok" aynı ekranla anlatılmaz: nedenleri ve
çözümleri farklıdır.

Eşleşme durumu **renkle anlatılmaz**. Her parça kartında metin etiketli bir
çip vardır: *Eşleşti · Şüpheli · Bulunamadı*. Sol kenar rengi bu etiketi
destekler, yerini almaz.

---

## Bu vertikalin hataları (anti-patterns)

1. Spotify'ın arayüzünü taklit edip ondan ayırt edilemez hale gelmek
2. Cam/blur'u liste satırlarına uygulamak
3. Durumu yalnız renkle anlatmak
4. OAuth adımını sihir gibi göstermek — kullanıcı neden izin verdiğini okuyabilmeli
5. Aurora gradyanını metnin arkasına koyup kontrastı öngörülemez yapmak
6. Boş kuyruk ile cihaz-yok durumunu aynı boş ekranla anlatmak

---

## Neyi hareket ettirmeyi hedefliyor

- ilk kuyruğa kadar geçen süre
- yapıştırılan şarkıların eşleşme oranı
- başarısız eşleşmede "Değiştir" kullanımı
- cihaz-yok hatasından kurtulma oranı

Bu dördünden birini akla yatkın biçimde etkilemeyen bir tasarım kararı
tercihtir ve öyle etiketlenmelidir.

---

## Hesaplanan ile seçilen

Bu ayrım göründüğünden önemli, çünkü ikisi de aynı dosyada aynı otoriteyle
duruyor.

**Hesaplanmış ve doğrulanabilir.** Yukarıdaki kontrast oranları, 44px dokunma
tabanı, tip ölçeğinin basamakları, `ui_audit.py`'nin geçtiği 13 kontrol.
Bunlar ya doğrudur ya da hatadır; testi vardır.

**Seçilmiş, gerekçeli ama ampirik değil.** Yeşilin tonu, violet aksan,
aurora'nın varlığı, camın üç katmanla sınırlanması, yarıçap ölçeği, Inter
tercihi, hareket süreleri. Bunlar tutarlı bir görüştür, kanıt değil. Gerçek
bir marka kılavuzu bunların hepsini ezebilir — ezdiğinde `design_system.py
check --fix` kontrastı yeniden dürüst tutar.

**Hiçbiri şunu söylemiyor:** ekranın doğru akış olup olmadığını. Kusursuz
tasarlanmış yanlış akış hâlâ yanlış akıştır.
