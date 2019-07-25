/*
Demo OBJ structure:

# some comment
o
v -1.23 1.23 0.23
v -4.56 4.56 0.56
v -7.89 7.89 0.89
v 1.23 -1.23 0.23
vt 0.23 0.23
vt 0.56 0.56
vt 0.89 0.89
vt 0.23 0.23
vn 0.33 0.33 0.33
vn 0.33 0.33 0.33
vn 0.33 0.33 0.33
vn 0.33 0.33 0.33
f 1/1/1 2/2/2 3/3/3
f 1/1/1 3/3/3 4/4/4
*/

const toFloatArr = (prefix, line) => line
  .replace(prefix, '').trim().split(' ').map(parseFloat)

const join = (targetArr, arr) => {
  for (let i = 0; i < arr.length; i++) {
    targetArr[targetArr.length] = arr[i]
  }
}

export const parseOBJ = str => {
  const uncommentedStr = str.replace(/#(.)+\n/g, '')
  const segments = uncommentedStr.split(/o\n/).filter(s => !!s)

  const models = []
  segments.forEach(segment => {
    const lines = segment.split('\n').filter(line => line && line[0] !== '#')
    const model = {
      data: {
        position: [],
        texCoord: [],
        normal: []
      },
      index: { array: [] }
    }
    lines.forEach(line => {
      const actionMapping = {
        'v ': line => {
          const arr = toFloatArr('v ', line)
          join(model.data.position, arr)
        },
        'vt': line => {
          const arr = toFloatArr('vt', line)
          join(model.data.texCoord, arr)
        },
        'vn': line => {
          const arr = toFloatArr('vn', line)
          join(model.data.normal, arr)
        },
        'f ': line => {
          const group = line
            .replace('f ', '')
            .split(' ')
            // OBJ face index starts from 1
            .map(abc => parseInt(abc.split('/')[0] - 1))
          join(model.index.array, group)
        }
      }
      const key = line.substr(0, 2)
      if (!actionMapping[key]) return
      actionMapping[key](line)
    })
    models.push(model)
  })
  return models
}
