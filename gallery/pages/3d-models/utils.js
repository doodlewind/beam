export const createSolidCanvas = (color, width = 16, height = 16) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // document.body.appendChild(canvas)
  return canvas
}
