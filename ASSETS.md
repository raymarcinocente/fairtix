# Concert image sources

## Original hero artwork

- Runtime asset: `public/images/after-hours.webp` (106 KB, converted from the original PNG).
- Generated with the built-in imagegen tool, not the CLI.
- Original output: `C:/Users/Nicol/.codex/generated_images/01a1713a-77e7-7241-9c5e-b18aa18a752f/exec-753bb21d-8244-491b-9386-e59c9a323c6e.png`.
- The vocalist is fictional; the image does not depict an advertised real performer.

Exact generation prompt:

> Use case: photorealistic-natural. Asset type: wide cinematic concert website hero background, 16:9 landscape. Original fictional live music concert photography, no real identifiable artist. A charismatic young adult female rock vocalist in a shimmering black stage outfit in profile holding a microphone, standing on the RIGHT HALF of frame under magnificent golden amber spotlights, warm orange haze and deep black shadows, audience silhouettes and hands along bottom, a guitar player far back right, spectacular beams and subtle film grain, atmospheric premium editorial music photography, realistic camera textures, dramatic contrast. LEFT HALF mostly dark smoky negative space for website title overlay. Wide arena stage composition. No text, no logos, no typography, no watermark.

## Demo poster photography

The following images were downloaded from Unsplash's image CDN, converted to local WebP assets, and used as fictional concert atmosphere. They do not imply artist or venue endorsements. They are used under the [Unsplash License](https://unsplash.com/license), which allows downloading and use in commercial and noncommercial projects. No Unsplash+ assets were intentionally selected.

| Local asset                   | Original source                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `public/images/electric.webp` | [Concert lights](https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3)      |
| `public/images/crowd.webp`    | [Concert crowd](https://images.unsplash.com/photo-1459749411175-04bf5292ceea)       |
| `public/images/stage.webp`    | [Live crowd](https://images.unsplash.com/photo-1501386761578-eac5c94b800a)          |
| `public/images/singer.webp`   | [Acoustic musician](https://images.unsplash.com/photo-1524650359799-842906ca1c06)   |
| `public/images/festival.webp` | [Festival atmosphere](https://images.unsplash.com/photo-1492684223066-81342ee5ff30) |
| `public/images/band.webp`     | [Live performance](https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee)    |

`src/lib/concerts.ts` maps showcase event IDs to these assets. Photography does not modify the original FairTix ticket store. Other existing files under `public/images` were left untouched.
