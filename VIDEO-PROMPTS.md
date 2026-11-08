# ویدیوی هیرو تادا — راهنمای ساخت (به روش Cinematic Scroll)

هیروی سایت یک «صحنه‌ی فیلم» است که با اسکرول کاربر جلو و عقب می‌رود (روش راهنمای گلستان). کد آماده است؛ فقط فایل‌ها را بسازید، در `assets/video/` بگذارید و در `js/content.js` این مقدارها را پر کنید. هیچ کد دیگری تغییر نمی‌کند:

```js
hero: {
  video: 'assets/video/hero.mp4',          // 1920×1080، دسکتاپ
  videoWebm: 'assets/video/hero.webm',     // VP9، کروم و فایرفاکس ترجیحش می‌دهند
  videoMobile: 'assets/video/hero-720.mp4',// 720p برای زیر ۷۶۸ پیکسل
  poster: 'assets/video/hero-poster.jpg',  // فریم اول؛ برای کاهش حرکت و قبل از لود
}
```

## داستان: «یک جرقه، یک لیوان، یک بشکن»

امضای بصری تادا در همه‌ی صحنه‌ها **جرقه‌های چهارپر** است (همان سه ستاره‌ی نشان)، همان‌طور که گلبرگ سرخ امضای گلستان بود. لیوان در همه‌ی صحنه‌ها یکی است: **tall clear glass with straight sides, no handle**. این عبارت را در هر پرامپت عیناً تکرار کنید تا لیوان عوض نشود.

| بازه‌ی اسکرول | صحنه | متن روی تصویر (از `content.js`) |
|---|---|---|
| ۰–۱۵٪ | جرقه در تاریکی | لوگوتایپ و «جایی که طعم بشکن می‌زند.» |
| ۱۵–۲۵٪ | جرقه فرود می‌آید، لیوان پیدا می‌شود | «یک جرقه.» |
| ۳۵–۴۵٪ | ریختن اوبه روی یخ و شیر | «شیشه، یخ، شیر.» |
| ۶۰–۷۰٪ | مرمر شدن بنفش در سفید | «بنفش در سفید می‌رقصد.» |
| ۸۵–۱۰۰٪ | بشکن کنار لیوان، سه جرقه | «تادا!» |

## قیدهای ترکیب‌بندی (مهم)

- لوگوتایپ بالای سمت راست و متن‌ها پایین سمت راست می‌نشینند (در فارسی). **سوژه را در ثلث میانی تا چپ کادر** بگذارید و گوشه‌ی بالا-راست و پایین-راست را خلوت نگه دارید.
- زمینه یکدست، بدون میز، بدون سطح، بدون سایه‌ی زمین. خط «جادوی تادا» در لبه‌ی راست صفحه پایین می‌آید؛ هیچ عنصر روشنی در آن نوار عمودی نباشد.
- رنگ‌ها فقط از پالت: بنفش شب `#35084C` زمینه، یاسی اوبه `#926D8F` برای اوبه، سفید شیری برای شیر. هیچ طلایی، هیچ قرمزی.

## پرامپت‌های تصویر (۶ فریم کلیدی)

**پیشوند ثابت** — این را به ابتدای همه‌ی پرامپت‌ها اضافه کنید:

> cinematic product photography, deep night-purple background (#35084C) fading to near-black at the edges, soft lilac rim light from above, ultra detailed, 8k, shallow depth of field, luxury editorial, calm and magical, subject in the center-left third of the frame, the upper-right and lower-right corners kept dark and empty, 16:9 aspect ratio (desktop hero).

**۱. جرقه (The Spark)**

> a single tiny four-pointed star of soft lilac-white light floating in the dark void, slightly left of center, a faint halo around it, a few microscopic sparkles drifting nearby like dust in a beam of light, nothing else in the frame, mysterious and quiet.

**۲. لیوان (The Glass)**

> the same tiny four-pointed star of light touching the rim of a tall clear glass with straight sides, no handle, the glass filled with clear ice cubes and cold white milk to two thirds, a soft bloom of lilac light where the star meets the glass, light catching the ice and the rim, fine sparkles suspended in the air around the rim.

**۳. ریختن (The Pour)**

> a thick ribbon of lavender-lilac ube cream (#926D8F) pouring slowly from above into a tall clear glass with straight sides, no handle, filled with ice cubes and cold white milk, the purple stream folding over the ice, tiny droplets suspended mid-air, soft lilac rim light, a few four-pointed sparkles glinting in the light beam.

**۴. مرمر (The Marble)**

> inside a tall clear glass with straight sides, no handle, lavender-lilac ube swirling into white milk in slow marbled ribbons around the ice, visible currents and soft gradients from lilac to white, condensation beads on the glass, macro detail, soft lilac rim light, two or three tiny four-pointed sparkles near the glass.

**۵. کامل (The Finish)**

> a finished ube latte in a tall clear glass with straight sides, no handle, perfectly layered: deep lilac at the bottom melting into white milk, ice on top, beads of condensation, three tiny four-pointed stars of light floating just above the rim in a small diagonal cluster, quiet and perfect.

**۶. بشکن (Tada)**

> an elegant hand with slender fingers and a thin silver ring, entering from the left side of the frame, caught at the exact moment of snapping its fingers beside the finished ube latte in a tall clear glass with straight sides, no handle, a small burst of four-pointed sparkles springing from the fingertips toward the glass, motion crisp, soft lilac rim light on the knuckles and the glass.

نکته: اگر تصویری با زمینه‌ی روشن ساخته شد، زمینه را حذف کنید (`rembg` یا ImageMagick)، وگرنه روی سایت بنفش شب «وصله» می‌شود:

```bash
convert input.jpg -fuzz 8% -fill none -floodfill +0+0 white -trim out.png
```

## پرامپت‌های حرکت (Kling 3.0، حالت Start + End Frame)

هر جفت فریم پشت‌سرهم یک کلیپ ۳ تا ۵ ثانیه‌ای. در همه‌ی پرامپت‌ها: **camera locked static, no pan, no zoom, slow-motion 24fps feel**.

**۱ → ۲ · فرود جرقه**

> the tiny four-pointed star of light drifts slowly downward and to the right, leaving a faint trail of microscopic sparkles, a tall clear glass with straight sides, no handle, filled with ice and milk gently fades up out of the darkness beneath it, the star touches the rim and blooms softly, camera locked static, no pan, no zoom, slow-motion 24fps feel, smooth ease-out as the star settles on the rim, luxury product film, sharp focus throughout.

**۲ → ۳ · ریختن**

> the bloom of light on the rim fades, a thick ribbon of lavender-lilac ube cream begins to pour from above into the glass, folding slowly over the ice cubes, small droplets suspended in the air, sparkles glint in the light beam, camera locked static, no pan, no zoom, slow-motion 24fps feel, smooth ease-in on the pour, luxury product film, sharp focus throughout.

**۳ → ۴ · مرمر**

> the pour thins and stops, the lilac cream swirls down into the white milk in slow marbled ribbons, currents curl around the ice, the colour softly gradients from lilac at the bottom to white at the top, condensation forms on the glass, camera locked static, no pan, no zoom, slow-motion 24fps feel, smooth ease-out as the swirling settles, luxury product film, sharp focus throughout.

**۴ → ۵ · کامل شدن**

> the swirling settles into calm layers, the ube latte becomes perfectly still, three tiny four-pointed stars of light appear one by one just above the rim and hold in a small diagonal cluster, camera locked static, no pan, no zoom, slow-motion 24fps feel, smooth ease-out as the stars appear, luxury product film, sharp focus throughout.

**۵ → ۶ · تادا**

> an elegant hand with a thin silver ring enters gently from the left edge, fingers set for a snap, and snaps once beside the glass; at the snap a small burst of four-pointed sparkles springs from the fingertips toward the three stars above the rim, which brighten for a moment, the hand holds still after the snap, camera locked static, no pan, no zoom, slow-motion 24fps feel, crisp motion on the snap and smooth ease-out after, luxury product film, sharp focus throughout.

## مونتاژ

- پنج کلیپ را در CapCut یا Premiere پشت‌سرهم بچینید، بدون فاصله و بدون هم‌پوشانی.
- بین هر دو کلیپ یک **Cross Dissolve** بگذارید (راهنما ۳ ثانیه پیشنهاد می‌کند؛ اگر کلیپ‌ها کوتاه‌اند ۱ تا ۱٫۵ ثانیه).
- خروجی: **1920×1080، ۳۰ فریم، H.264، ۸ تا ۱۲ مگابیت، بی‌صدا**. مدت نهایی ۱۲ تا ۲۰ ثانیه.
- نور و رنگ همه‌ی کلیپ‌ها را یکی کنید؛ ویدیویی با نوردهی ناجور از نداشتن ویدیو بدتر است.

## انکود برای اسکراب (حتماً)

هر فریم باید کی‌فریم باشد، وگرنه `currentTime` با هر اسکرول گیر می‌کند. `+faststart` تا پخش زودتر شروع شود. حجم ایده‌آل زیر ۲۵ مگابایت (CRF ۲۳ تا ۲۶).

```bash
ffmpeg -i hero_master.mp4 -an -c:v libx264 -crf 24 -pix_fmt yuv420p -x264-params "keyint=1:min-keyint=1:scenecut=0" -movflags +faststart assets/video/hero.mp4
```

```bash
ffmpeg -i hero_master.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 34 -g 1 -keyint_min 1 -row-mt 1 assets/video/hero.webm
```

```bash
ffmpeg -i hero_master.mp4 -an -vf "scale=-2:720" -c:v libx264 -crf 26 -pix_fmt yuv420p -x264-params "keyint=1:min-keyint=1:scenecut=0" -movflags +faststart assets/video/hero-720.mp4
```

```bash
ffmpeg -i hero_master.mp4 -vf "select=eq(n\,0)" -frames:v 1 -q:v 3 assets/video/hero-poster.jpg
```

## آنچه کد از قبل رعایت می‌کند

- هیرو پین می‌شود: ۴۰۰vh روی دسکتاپ، ۲۵۰vh زیر ۷۶۸ پیکسل؛ پیشرفت اسکرول به `video.currentTime` نگاشت می‌شود.
- ویدیو `muted` و `playsinline` و `preload="auto"` است، قبل از اولین seek یک‌بار `load()` می‌شود و فقط وقتی متوقف است seek می‌شود (برای Safari آیفون).
- WebM اول، MP4 به‌عنوان جایگزین؛ نسخه‌ی ۷۲۰ برای موبایل.
- پوستر جلوی پرش صفحه را می‌گیرد؛ در «کاهش حرکت» فقط پوستر نمایش داده می‌شود و اسکراب خاموش است.
- متن‌ها در بازه‌های ۱۵–۲۵، ۳۵–۴۵، ۶۰–۷۰ و ۸۵–۱۰۰ درصد ظاهر و محو می‌شوند. هیچ متنی بیش از چند ثانیه‌ی اسکرول روی صفحه نمی‌ماند.
- قاب گالری با گوشه‌های براکتی، وینیت و دانه‌ی فیلم (۴٪) روی هیرو هست.

## پیش از انتشار

1. روی گوشی واقعی (نه فقط DevTools) اسکرول را آهسته جلو و عقب ببرید؛ هیچ پرشی نباید باشد.
2. Lighthouse موبایل: اگر LCP بیش از ۴ ثانیه بود، `videoMobile` را خالی بگذارید تا موبایل فقط پوستر ببیند.
3. متن روی تصویر باید کار کند: هر جمله یا اطلاعات بدهد، یا حس بسازد، یا کنجکاوی. جمله‌های کلیشه‌ای («بهترین قهوه») را ننویسید.
