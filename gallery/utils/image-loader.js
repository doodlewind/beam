/* eslint-env browser */

const loadImage = url => new Promise(resolve => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.src = url
})

export const loadImages = (...urls) => Promise.all(urls.map(loadImage))
