// Shrinks a BOL or POD photo on the phone before it is sent, so it goes through on a weak
// signal and takes little space on the office server, while the paper stays easy to read.
// A phone photo is often 3 to 6 MB. It is drawn at most 1600 pixels on its long side (about
// 145 dots per inch on a letter page), then saved as a JPEG a bit smaller each step until it
// is about 350 KB. It never goes below 1200 pixels and quality 0.5, where small print starts
// to blur. PDFs and pictures the phone cannot draw are sent as they are.
export const SHRINK_STEPS = [
  [1600, 0.7],
  [1600, 0.6],
  [1400, 0.6],
  [1400, 0.5],
  [1200, 0.5],
];
export const TARGET_BYTES = 350 * 1024;

// The size of the file a data URL holds.
export function bytesOf(dataUrl) {
  const data = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  return Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
}

// Tries each step until one is small enough; keeps the smallest the phone made, or the
// original when that is smaller still. `encode(maxSide, quality)` returns a data URL.
export function smallest(original, encode, { steps = SHRINK_STEPS, target = TARGET_BYTES } = {}) {
  let best = original;
  for (const [side, quality] of steps) {
    const url = encode(side, quality);
    if (url && bytesOf(url) < bytesOf(best)) best = url;
    if (bytesOf(best) <= target) break;
  }
  return best;
}

export async function fileToUploadDataUrl(file, options) {
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
  if (!file.type.startsWith('image/')) return original;
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = original;
    });
    const canvases = {};
    const drawn = (maxSide) => {
      if (canvases[maxSide]) return canvases[maxSide];
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // White under a picture with see through parts, so it does not turn black as a JPEG.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvases[maxSide] = canvas;
      return canvas;
    };
    return smallest(original, (side, quality) => drawn(side).toDataURL('image/jpeg', quality), options);
  } catch {
    return original;
  }
}
