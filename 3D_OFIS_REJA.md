# 3D OFIS — ish rejasi (Claude Code uchun)

Bu fayl Claude Code sessiyalari uchun. Har sessiya boshida: "`3D_OFIS_REJA.md` ni o'qi, N-bosqichni bajar".
Bosqich tugagach shu faylning "Holat" jadvalida o'sha qatorni ✅ qilib, commit hash'ini yoz.

## Holat
| Bosqich | Nima | Holat |
|---|---|---|
| 1 | Sahna, zonalar, stollar, kamera, `/3d` | ✅ `73c7a5d` |
| 2 | Xodimlar, holatlar, tool pufakchalari, SSE feed | ✅ `c5e9b80` |
| 2b | Dizaynni yaxshilash (yorug'lik, jihozlar, xodimlar) | ✅ `023a7fe` |
| **CHAT** | **USTUVOR (Zafar 12-10):** 3D ofisda xodimni bosganda ovozli Roast-chat — 4+5+6 bosqichlarning birlashgan varianti | ⏳ |
| 2c | AFK botlar, kun/tun rejimi, ofis mushugi | ⏳ |
| 3 | Haqiqiy oqimga ulash + o'ng panel | ⏳ |
| 4 | Xodimlar bilan chat + "Roast" rejimi | → CHAT ga birlashtirildi |
| 5 | Ovozli kirish (o'zbekcha ASR) | → CHAT |
| 6 | Ovozli javob (TTS) | → CHAT |
| 7 | Kreativ xonalar: render-xona, kinozal, plyonka, mijoz, shon-sharaf devori, charchoq, ekvalayzer | ⏳ |
| 8 | Silliqlash + haqiqiy montaj testi + README + push | ⏳ |

## Maqsad
Mavjud AI Montaj Ofisi saytiga (`07_AI_Ofis_Sayt/`) **3D ofis ko'rinishi**: qorong'i fon, izometrik kamera, bo'limlar
(Rejissyor, Ovozchi, Montajchi, Motion, Rangchi + Oshxona/Dam olish), stollar va monitorlar, har stolda ismli past-poligonal
xodim. Xodim faqat haqiqiy hodisa kelganda ishlaydi: tepasida tool pufakchasi (Bash, Edit, Read, Write, Glob…), monitori yonadi,
qo'llari yozadi. Bo'sh xodim AFK hayot kechiradi (qahva, divan, uxlash). Kamera: aylantirish, zoom, surish. Xodimni bossangiz
o'ng panelda uning vazifalari, jurnali va u bilan chat.

## Qat'iy qoidalar (hamma bosqichga)
- Hamma kod faqat `07_AI_Ofis_Sayt/` ichida. 00/01/02/03/06 papkalarga yozma (`README.md`, "Nima qilinmaydi").
  `04_Tayyor_videolar` faqat o'qiladi (thumbnail/kesh `07_AI_Ofis_Sayt/_cache/` ga).
- **Soxta progress yo'q.** "Ishlayapti" holati faqat `jobs/<id>/events.jsonl` / SSE dan. AFK harakatlar (qahva, uxlash, o'yin)
  ruxsat, lekin hech qachon "ishlayapti" kabi ko'rinmasin (monitor yonmaydi, tool pufakchasi chiqmaydi).
  Haqiqiy hodisa kelsa AFK xodim darhol stoliga qaytadi (yugurib).
- Kutubxonalar lokal (`web/vendor/`), CDN yo'q, internetsiz ishlasin (ElevenLabs ixtiyoriy — 6-bosqich).
- Mavjud 2D sahifa (`/`) buzilmasin. Hech bir yangi xususiyat montaj runner'ini (navbat, `claude -p` montaj sessiyasi) sekinlatmasin.
- O'zbekcha (lotin) matn, `oʻ/gʻ` uchun U+02BB. Shrift: Inter Display. Tezlik: M5 Mac'da ≥ 50 fps.
- Kalit/token (ElevenLabs va h.k.) faqat `config.json` da (u `.gitignore` da) — hech qachon git'ga emas.
- Har bosqich oxirida Chrome'da tekshir (avval konsol/`read_page`, skrinshot faqat dizayn uchun), keyin `git commit`.
  `git push` faqat foydalanuvchi aytganda. Yangi paket o'rnatish (`pip`, torch va h.k.) — avval foydalanuvchidan so'ra.

## Ma'lumot → 3D bog'lanish
| Hodisa | 3D'da |
|---|---|
| `agent=<rol>, state=working` | o'sha bo'lim xodimi stolda yozadi, monitori yonadi, pufakchada `text` |
| `type=tool` (`name=Bash/Edit/Read/…`) | faol xodim tepasida tool yorlig'i (Bash yashil, Edit ko'k, Read kulrang, Write binafsha…) |
| `Task`/sub-agent tool_use | o'sha bo'limda yangi xodim eshikdan kirib stolga o'tiradi, tugagach chiqib ketadi |
| `handoff: A→B` | A dan B ga papka ko'tarib yuradigan kuryer yoki uchuvchi paket |
| `type=edl` | 7-bosqich: poldan plyonka-konveyer (haqiqiy segmentlar) |
| `type=render` (pct, kadr) | render-xona serverlari miltillaydi, tepada halqa (haqiqiy kadr/jami) |
| `type=final` | xodimlar kinozalga yig'iladi, katta ekranda yakuniy video, qarsak |
| `state=error` | xodim tepasida qizil "!", boshini ushlaydi |
| `status=queued/new` (yangi ish) | 7-bosqich: eshikdan mijoz papka bilan kiradi → Rejissyorga beradi |
| hodisa yo'q > 60 s | AFK rejim (2c) |

---

## 2b-bosqich — dizaynni yaxshilash (~1 soat) · model: fable (xhigh)
Hozirgi muammolar (skrinshot 11:37): juda qorong'i va bir xil, stollar kulrang qutilar, xodimlar juda kichik, zona nomi va xodim
nomi ikki marta bir xil yozilgan.
- **Yorug'lik:** iliq stol lampalari (PointLight yoki emissive + fake light-pool), monitorlar emissive (ishlayotganda yorqinroq),
  yengil bloom (`UnrealBloomPass`, lokal vendor), ambient past, yumshoq soya. Fon qorong'i qolsin, lekin ofis "tirik" ko'rinsin.
- **Xodimlar 2–3 barobar katta:** bosh/yuz (ko'z, soch rangi), tana, qo'llar, kiyim rangi = rol rangi. Har biri farqli (soch,
  ko'zoynak, kepka, naushnik). Original dizayn, mavjud brend personajlarini ko'chirma.
- **Zona yorliqlari:** zonada vazifa nomi + ikonka ("🎬 Rejissyor xonasi", "🎙 Ovoz bo'limi", "✂️ Montaj", "✨ Motion",
  "🎨 Rang va render"), xodim ismi faqat uning tepasida. Zona yorlig'i — neon yozuv devorda yoki polda.
- **Interyer:** shisha to'siqlar (yarim shaffof), o'simliklar, gilam, oshxonada qahva mashinasi + stol, divan.
- **Kasbga mos jihozlar:** Ovozchi — mikrofon stoyka + naushnik; Montajchi — ikki monitor (birida timeline chiziqlari);
  Rangchi — rang paneli (trekbol); Motion — planshet + stilus; Rejissyor — klapper + katta ekran.
- `InstancedMesh` va umumiy materiallar (tezlik). LOD: uzoqda yorliqlar kichrayadi/yashirinadi.
- **Qabul:** 2D↔3D almashadi, fps ≥ 50, konsol toza; skrinshotda xodimlar aniq ko'rinadi, ism takrorlanmaydi.

## CHAT-bosqich — USTUVOR: 3D ofisda bosilganda ovozli Roast-chat (~1.5–2 soat) · model: fable (xhigh)
**MUHIM: hammasi faqat 3D sahifada (`/3d`, `web/3d.html`, `web/3d/*`).** 2D sahifaga (`/`, `web/index.html`, `web/app.js`) chat
qo'shilmaydi va u o'zgartirilmaydi. Chat oynasi 3D sahna ustida — bosilgan xodim yonida suzuvchi karta yoki 3D sahifaning o'ng
paneli (Zafar 13:31: "ovozli chatlarni 3D'da xohlagandim, 2D oynasida emas").
Zafarning talabi (12-10, so'zma-so'z ma'nosi): "ish jarayonida emas, ishdan bo'sh payti Rangchi yoki boshqasining ustiga bosganda
ovozli chat bo'lishi kerak; men nima yozsam ham 18+ hazil qilsin; gapirsam ham ovoz bilan gapirsin". 4, 5, 6-bosqichlar
tafsilotlari (pastda) shu yerda qo'llanadi — farqlari:
- **Kirish:** istalgan xodimni bosish → shu xodim yonida chat oynasi (o'ng panel yoki xodim tepasida suzuvchi karta) darhol
  ochiladi. 3-bosqich o'ng paneli hali yo'q bo'lsa — chat uchun minimal panel shu bosqichda yasaladi (3-bosqich keyin kengaytiradi).
  Bosilgan xodim chat paytida o'giriladi, kameraga qaraydi, gapirganda og'zi qimirlaydi.
- **Ish paytida:** xodim haqiqiy montaj ishida band bo'lsa chat baribir ochiladi, lekin u qisqa va "band" ohangida javob beradi
  ("hozir render qilyapman, keyin gaplashamiz, ..."), montaj sessiyasiga hech qanday ta'sir qilmaydi (alohida jarayon).
- **Roast 18+ — STANDART YOQIQ** (Zafar so'radi). Birinchi ochilganda bir marta "18 yoshdan kattaman" tasdig'i
  (`config.json → chat.roast_ok=true`), keyin so'ralmaydi. Sozlamada "Yumshoq" ga o'tkazish mumkin.
  Har javob — personasiga mos achchiq hazil, roast, so'kinish, qo'pol sarkazm, uyatli ishora; foydalanuvchi oddiy narsa yozsa ham
  (masalan "salom") javob hazilli bo'ladi. Ruxsat yo'q (persona promptida aniq yozilsin): ochiq jinsiy tasvir, millat/din/jins
  bo'yicha kamsitish, haqiqiy uchinchi shaxslarni haqorat, o'z-o'ziga zarar mavzusi. O'zbekcha (lotin), qisqa (1–3 gap) — ovozda tez.
- **Ovozli kirish (5-bosqich):** 🎙 bosib turish → yozish → qo'yib yuborilganda avtomatik ASR → avtomatik yuborish
  (matn ham ko'rinadi). Doimiy `server/asr_worker.py`, `engine/asr_wave.py`, internetsiz.
- **Ovozli javob (6-bosqich) — STANDART YOQIQ** chat oynasida (sahifaning umumiy 🔊 tugmasidan mustaqil):
  1) `config.json → tts.elevenlabs_key` bo'lsa — ElevenLabs multilingual (o'zbekcha), har xodimga alohida `voice_id`
     (sozlamada tanlanadi; standart: har rolga farqli erkak/ayol ovoz).
  2) Kalit bo'lmasa — macOS `say` (rus ovozlari, o'zbekchani aksent bilan; har xodimga farqli ovoz/tezlik). Chat oynasida
     kichik eslatma: "O'zbekcha tabiiy ovoz uchun Sozlamalar → ElevenLabs kaliti".
  Javob matni kelishi bilan TTS boshlanadi; navbat bilan (bir vaqtda bitta ovoz). "To'xtat" tugmasi.
- **Model:** chat `haiku` + `--system-prompt` (persona) + `--tools ""` (tez va arzon). Har javob tagida kichik token raqami.
- **Qabul:** Rangchi ustiga bosib "salom" desam (ovoz bilan) — 5–8 s ichida o'z ovozida achchiq hazil bilan javob beradi;
  boshqa 4 xodim ham o'z xarakterida; montaj ishi ketayotganda ham ishlaydi va montajni sekinlatmaydi.

## 2c-bosqich — AFK botlar, kun/tun (~45 daq) · model: fable (xhigh)
- AFK holatlar (faqat ish bo'lmaganda): qahva olishga borish, oshxonada 2–3 kishi "gaplashadi" (qo'l harakati), divanda telefon,
  stol tennisi (2 kishi), cho'zilish/esnash, stolda uxlash (zZ). Tasodifiy, lekin tabiiy jadval (har 20–90 s almashadi).
- Ofis mushugi: aylanib yuradi, ba'zan stolga chiqib yotadi, bossangiz "miyov" pufakchasi.
- **Kun/tun:** Asia/Tashkent vaqti. Kunduz — yorug'roq; 19:00 dan keyin lampalar asosiy; 22:00–07:00 ko'pchilik uxlaydi yoki
  "uyga ketgan" (stol bo'sh, kurtka stulda). Haqiqiy ish kelsa — baribir darhol ishlaydi.
- Holat mashinasida `afk` va `working` aniq ajratilgan: AFK hech qachon monitor yoqmaydi va tool pufakchasi chiqarmaydi.
- **Qabul:** 3 daqiqa kuzatilganda ofis "tirik", `progress_sinov.command` ishga tushsa AFK xodimlar stollariga yuguradi.

## 3-bosqich — haqiqiy oqimga ulash + o'ng panel (~45–60 daq) · model: fable (xhigh)
- `web/3d/state.js`: SSE hodisalari → xodimlar holat mashinasi (jadval yuqorida); `type=tool` → faol xodimga.
  Faol xodimni aniqlash: oxirgi `progress.py` hodisasining `agent` i; bo'lmasa Rejissyor.
- `Task` tool_use → yangi vaqtinchalik xodim (ism: vazifa qisqa nomi), tugagach chiqib ketadi.
- Xodimni bosish → o'ng panel: ism, rol, holat, joriy vazifa, metriklar, oxirgi 20 hodisa (keyin 4-bosqichda chat shu panelda).
- Chap panel / ish tanlash 2D bilan bir xil (`/api/jobs`), tugagan ishda "QAYTA KO'RISH" (yozib olingan haqiqiy hodisalar).
- **Qabul:** mock (`_tekshiruv/mock_claude.py`, `config.json → claude_bin`) bilan to'liq ish boshlanish → final; keyin mockni olib tashla.

## 4-bosqich — xodimlar bilan chat + "Roast" rejimi (~1 soat) · model: fable (xhigh)
- O'ng panelda chat maydoni. `POST /api/chat {agent, text, mode}` → server alohida (montaj navbatidan mustaqil) kichik jarayon:
  `claude -p "<prompt>" --model haiku --tools "" --output-format json --system-prompt "<persona + qoidalar>"`
  (`--system-prompt` standart katta prompt o'rniga — token tejaydi; tool yo'q; montajga xalaqit bermaydi).
  Bir vaqtda 1 chat so'rovi, timeout 60 s.
- **Personalar** (`runner/personalar.json`, sozlamalarda tahrirlanadi): har rol uchun xarakter — Rejissyor (talabchan, "yana bir
  dubl!"), Ovozchi (doim "musiqa baland" deb arazlaydi), Montajchi (kesimga oshiq, "bu yerda 2 kadr ortiqcha"), Motion
  (blur-in'siz yashay olmaydi), Rangchi (injiq perfeksionist, "bu teri rangi emas, apelsin").
- **Kontekst:** promptga joriy ishning qisqa holati (oxirgi 5 hodisa, mijoz, bosqich) qo'shiladi — hazillar haqiqiy ishga bog'liq bo'lsin.
- **Rejimlar:** "Yumshoq" (standart) va "Roast 18+" (sozlamada, birinchi yoqilganda "18 yoshdan kattaman" tasdig'i).
  Roast'da ruxsat: qo'pol so'zlar, so'kinish, achchiq sarkazm, roast, yengil uyatli ishora. Ruxsat yo'q: ochiq jinsiy kontent,
  millat/din/jins bo'yicha kamsitish, haqiqiy uchinchi shaxslarni haqorat. Bu cheklovlar persona promptida aniq yozilsin.
- Chat tarixi: `07_AI_Ofis_Sayt/chat/<agent>.jsonl` (`.gitignore` ga qo'sh), promptga oxirgi 8 xabar.
  Javob 3D'da xodim tepasida pufakcha bo'lib ham chiqsin.
- Har javob tokenini (`usage`) ko'rsat (kichik kulrang raqam) — limit nazorati uchun.
- **Qabul:** har 5 xodim o'z xarakterida javob beradi; montaj ishi ketayotganda chat ishlaydi va montajni to'xtatmaydi.

## 5-bosqich — ovozli kirish, o'zbekcha ASR (~45 daq) · model: fable (xhigh)
- Chat maydonida 🎙 tugma (bosib turish = yozish). Brauzer `MediaRecorder` → `POST /api/asr` (webm/opus).
- Server: `bin/ffmpeg` → 16 kHz mono wav (`_cache/asr/`) → `engine/asr_wave.py` (model `02_Assets/ASR/`, faqat o'qish).
  Modelni har safar yuklamaslik uchun doimiy ASR ishchi jarayon (`server/asr_worker.py`, venv python, stdin/stdout JSON),
  birinchi so'rovda ishga tushadi. 20 s dan uzun yozuvni sukut bo'yicha bo'laklarga bo'l.
- Natija matn maydoniga tushadi (tahrirlash mumkin) → "Yuborish". `oʻ/gʻ` U+02BB ga normalizatsiya.
- **Qabul:** 5–10 s o'zbekcha gap ≤ 5 s ichida matnga aylanadi, internetsiz.

## 6-bosqich — ovozli javob, TTS (~1 soat) · model: fable (xhigh)
Provayderlar (`config.json → tts.provider`, sozlamalarda tanlanadi), standart `say`:
1. **`say` (macOS, bepul, offline):** rus/ingliz ovozlari (o'zbekchani aksent bilan o'qiydi — hazil uchun yaxshi). Har xodimga
   alohida ovoz va tezlik. `say -v <ovoz> -o _cache/tts/<id>.aiff` → `bin/ffmpeg` → m4a → brauzerda o'ynaydi.
2. **ElevenLabs (ixtiyoriy, pullik, internet):** `config.json → tts.elevenlabs_key` + har xodimga `voice_id`. Kalit faqat lokal.
   Model multilingual (o'zbekcha). Xatoda `say` ga qaytadi.
3. **MMS-TTS (Meta, offline o'zbekcha):** faqat foydalanuvchi ruxsat bersa — torch/transformers o'rnatish kerak (katta hajm).
   Avval so'ra, sifatini sinab ko'r.
- Xodim gapirayotganda og'zi qimirlaydi (oddiy amplituda animatsiyasi), pufakchada matn. Ovoz tugmasi (🔇/🔊) yuqori panelda,
  standart: o'chiq.
- **Qabul:** `say` bilan har xodim o'z ovozida javob beradi; ElevenLabs kaliti kiritilsa o'zbekcha ovoz ishlaydi.

## 7-bosqich — kreativ xonalar va effektlar (~1.5–2 soat) · model: fable (xhigh)
Hammasi **haqiqiy ma'lumotdan**:
- **Render-xona:** server shkaflari, LED'lar `type=render` paytida miltillaydi (tezligi haqiqiy fps ga bog'liq), tepada halqa
  `kadr/jami`. Render yo'q paytda LED'lar sekin "nafas oladi".
- **Kinozal:** `type=final` → xodimlar kinozalga yuradi, katta ekranda yakuniy video (`/api/file`, Range), tugagach qarsak
  (zarrachalar). Tugmalar: "Kinozalda ko'rish" har versiya uchun.
- **Plyonka-konveyer:** `type=edl` → polda montaj bo'limidan render-xonaga plyonka tasmasi, har segment bitta "kadr" (uzunligi
  haqiqiy davomiylikka proporsional, rang `kind` bo'yicha). Ustiga bosilsa segment vaqti.
- **Mijoz tashrifi:** yangi ish (`status=new/queued`) → eshikdan mijoz (ismi `job.client` yorlig'ida) papka bilan kiradi,
  Rejissyorga beradi, chiqib ketadi. Tuzatish (`fix`) bo'lsa — mijoz qaytib kelib qog'oz beradi.
- **Shon-sharaf devori:** `04_Tayyor_videolar` dagi videolar (`/api/assets/ready`) devorda ramkalarda. Thumbnail:
  `bin/ffmpeg -ss 1 -frames:v 1` → `_cache/thumbs/` (04 ga yozilmaydi). Bossangiz kinozalda o'ynaydi. Oxirgi 12 ta.
- **Charchoq ko'rsatkichi:** joriy ish tokenlari `claude.jsonl` dagi `result.usage`/`total_cost_usd` dan (haqiqiy). Ko'p token →
  xodimlar ko'proq qahvaga boradi, ko'zlari qizaradi; o'ng panelda "Bugun: N token" raqami.
- **Ekvalayzer:** ish musiqasi (`job.music` yoki Ovozchi `--metric` dagi trek, `02_Assets/Musiqa` dan faqat o'qib) yuqori panel
  🔊 yoqilsa past ovozda chalinadi, Ovoz bo'limi devoridagi ekvalayzer Web Audio `AnalyserNode` bilan tebranadi. Standart: o'chiq.
- **Qabul:** mock ish davomida hammasi to'g'ri vaqtda ishga tushadi; fps ≥ 50.

## 8-bosqich — silliqlash + haqiqiy test (~1–2 soat) · model: fable (xhigh)
- Tezlik (ko'p xodimda ham ravon), telefon kengligi, sozlamalar (2D/3D standart, ovoz, roast, TTS provayder).
- Haqiqiy montaj testi: `04_Tayyor_videolar` dagi qisqa video + "o'zbekcha subtitr qo'sh" — boshidan oxirigacha 3D'da kuzatish
  (mijoz kiradi → ishlash → render-xona → kinozal).
- `README.md` ga 3D bo'limi (boshqaruv, chat, ovoz, roast, TTS sozlamalari, token sarfi), `git commit` + push.
- **Qabul:** haqiqiy ish o'tdi, final video 04 da, 3D hamma bosqichni to'g'ri ko'rsatdi, 00/02/03/06 o'zgarmagan.

---

## Model va token
- **Qurish modeli: `fable`, effort `xhigh`** (foydalanuvchi qarori, 2026-10-12). Ishga tushirish:
  `claude --chrome --model fable --effort xhigh`. Bu sonnet'dan ancha ko'p limit sarflaydi — shuning uchun tejash muhim.
- Har bosqich = yangi sessiya (`/clear`). Boshida faqat shu faylni o'qit.
- Saytning **ichidagi** chat (4-bosqich) baribir `haiku` + `--system-prompt` + tool'siz bo'lib qoladi — bu qurish modeli emas,
  har xabarda ishlaydigan runtime; fable bo'lsa har hazil juda qimmatga tushadi.
- Tekshiruvda avval konsol/matn, skrinshot faqat dizaynni ko'rish kerak bo'lganda.
- Katta fayllarni to'liq o'qitma; kerakli joyini so'ra.
