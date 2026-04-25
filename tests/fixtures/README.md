# Test Fixtures

Do NOT commit real NSFW images to this repository.

## Generating Safe Test Images

Use ImageMagick or Node.js canvas to generate solid-color PNG files:

```bash
# A solid white 512x512 image (safe — should return 'approved')
convert -size 512x512 xc:white safe-white.png

# A solid blue image (safe)
convert -size 512x512 xc:blue safe-blue.png
```

Or in Node.js:
```js
const { createCanvas } = require('canvas');
const fs = require('fs');

const canvas = createCanvas(512, 512);
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 512, 512);
fs.writeFileSync('safe-white.png', canvas.toBuffer('image/png'));
```

## Testing Against Real NSFW Content

For real model validation (not CI), use the following publicly available test sets:

- [NSFW Detection Benchmark](https://github.com/alex000kim/nsfw_data_scraper) — instructions for downloading annotated datasets
- The nsfwjs demo at https://nsfwjs.com/ includes a live classifier you can test manually

For automated integration testing against real explicit content, run the server locally and use
`curl` or a test script against a private fixture directory that is `.gitignore`d:

```bash
# Example: test a known-safe image
curl -X POST http://localhost:3100/moderate/image \
  -H "X-Api-Key: your-key" \
  -F "file=@/path/to/safe.jpg"

# Expected: { "verdict": "approved", ... }
```

## CI Strategy

CI uses mocked classifier responses (see `tests/integration.test.ts`).
The mock always returns safe scores so tests run without TF/nsfwjs.
Real model accuracy is validated manually before deploying new model versions.
