/* eslint-env browser */

const loadImage = url => new Promise(resolve => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.src = url
})

const loadSVG = url => new Promise(resolve => {
  fetch(url).then(resp => resp.text()).then(xml => {
    // const svg64 = btoa(xml)
    // const b64Start = 'data:image/svg+xml;base64,'
    // const image64 = b64Start + svg64
    // const image = new Image()
    // image.src = image64
    // console.log(image)
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
