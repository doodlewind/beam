// Image / cube-map loaders — typed port of the old gallery util.
// WebGPU's copyExternalImageToTexture accepts ImageBitmap, HTMLImageElement,
// HTMLCanvasElement; ImageBitmap is preferred, so `loadBitmap` is the default.

export const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

// SVGs have no concrete pixel buffer, so WebGPU's copyExternalImageToTexture
// uploads them as empty. Rasterize the SVG onto a 2D canvas (which always has a
// concrete size) and return that canvas as the texture source.
const loadSVG = async (url: string): Promise<HTMLCanvasElement> => {
  const xml = await fetch(url).then((r) => r.text())
  const blob = new Blob([xml], { type: 'image/svg+xml' })
  const blobURL = URL.createObjectURL(blob)
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = reject
    image.src = blobURL
  })
  // SVGs may report a 0 intrinsic size; fall back to the viewBox, then square.
  let w = image.naturalWidth || image.width
  let h = image.naturalHeight || image.height
  if (!w || !h) {
    const m = xml.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/)
    if (m) {
      const p = m[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      w = p[2]
      h = p[3]
    }
    w = w || 1024
    h = h || 1024
  }
  const scale = 1024 / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(blobURL)
  return canvas
}

export type LoadedImage = HTMLImageElement | HTMLCanvasElement

const loadURL = (url: string): Promise<LoadedImage> => {
  const suffix = url.split('.').pop()
  return suffix === 'svg' ? loadSVG(url) : loadImage(url)
}

export const loadImages = (...urls: string[]): Promise<LoadedImage[]> =>
  Promise.all(urls.map(loadURL))

/** Decode a URL to an ImageBitmap (the preferred WebGPU texture source). */
export const loadBitmap = async (url: string): Promise<ImageBitmap> => {
  const resp = await fetch(url)
  const blob = await resp.blob()
  return createImageBitmap(blob)
}

/**
 * Load 6 cube faces in WebGPU face order (+X, -X, +Y, -Y, +Z, -Z), which the
 * old gallery's dir order [right, left, top, bottom, front, back] already
 * matches. Returns a 6-tuple of ImageBitmaps ready for `beam.cube(faces)`.
 */
export const loadCubeFaces = async (
  basePath: string,
  ext = 'jpg',
  dirs: string[] = ['right', 'left', 'top', 'bottom', 'front', 'back']
): Promise<ImageBitmap[]> =>
  Promise.all(dirs.map((dir) => loadBitmap(`${basePath}/${dir}.${ext}`)))
