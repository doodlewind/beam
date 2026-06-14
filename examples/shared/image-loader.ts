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

const loadSVG = (url: string): Promise<HTMLImageElement> =>
  fetch(url)
    .then((resp) => resp.text())
    .then(
      (xml) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const blob = new Blob([xml], { type: 'image/svg+xml' })
          const blobURL = URL.createObjectURL(blob)
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = blobURL
        })
    )

const loadURL = (url: string): Promise<HTMLImageElement> => {
  const suffix = url.split('.').pop()
  return suffix === 'svg' ? loadSVG(url) : loadImage(url)
}

export const loadImages = (...urls: string[]): Promise<HTMLImageElement[]> =>
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
