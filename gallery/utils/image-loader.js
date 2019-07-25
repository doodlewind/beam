/* eslint-env browser */

const loadImage = url => new Promise(resolve => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.src = url
})

const loadSVG = url => new Promise(resolve => {
  fetch(url).then(resp => resp.text()).then(xml => {
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const blogURL = URL.createObjectURL(blob)
    const image = new Image()
    image.src = blogURL

    image.onload = () => resolve(image)
  })
})

const loadURL = url => {
  const suffix = url.split('.').pop()
  return suffix === 'svg' ? loadSVG(url) : loadImage(url)
}

export const loadImages = (...urls) => Promise.all(urls.map(loadURL))

export const loadEnvMaps = (
  basePath,
  level = 9,
  dirs = ['right', 'left', 'top', 'bottom', 'front', 'back']
) => new Promise(resolve => {
  const cubeMaps = [
    { type: 'diffuse', level: 0, urls: [], images: [] },
    { type: 'specular', level, urls: [], images: [] }
  ]

  cubeMaps.forEach(({ type, level }, i) => {
    dirs.forEach(dir => {
      for (let j = 0; j <= level; j++) {
        cubeMaps[i].urls.push(`${basePath}/${type}/${type}_${dir}_${j}.jpg`)
      }
    })
  })

  const loadPromises = cubeMaps
    .map(light => Promise.all(light.urls.map(loadImage)))

  Promise.all(loadPromises).then(imageGroups => {
    imageGroups.forEach((images, i) => { cubeMaps[i].images = images })
    resolve(cubeMaps)
  })
})
