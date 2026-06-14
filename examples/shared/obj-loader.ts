// Minimal OBJ parser — typed port of the old gallery util.
// Returns models shaped for the new API: model.vertex + model.index.
export interface ObjModel {
  vertex: { position: number[]; texCoord: number[]; normal: number[] }
  index: { array: number[] }
}

const toFloatArr = (prefix: string, line: string): number[] =>
  line.replace(prefix, '').trim().split(' ').map(parseFloat)

const join = (targetArr: number[], arr: number[]) => {
  for (let i = 0; i < arr.length; i++) targetArr[targetArr.length] = arr[i]
}

export const parseOBJ = (str: string): ObjModel[] => {
  const uncommentedStr = str.replace(/#(.)+\n/g, '')
  const segments = uncommentedStr.split(/o\n/).filter((s) => !!s)

  const models: ObjModel[] = []
  segments.forEach((segment) => {
    const lines = segment.split('\n').filter((line) => line && line[0] !== '#')
    const model: ObjModel = {
      vertex: { position: [], texCoord: [], normal: [] },
      index: { array: [] },
    }
    lines.forEach((line) => {
      const actionMapping: Record<string, (line: string) => void> = {
        'v ': (line) => join(model.vertex.position, toFloatArr('v ', line)),
        vt: (line) => join(model.vertex.texCoord, toFloatArr('vt', line)),
        vn: (line) => join(model.vertex.normal, toFloatArr('vn', line)),
        'f ': (line) => {
          const group = line
            .replace('f ', '')
            .split(' ')
            // OBJ face index starts from 1
            .map((abc) => parseInt(abc.split('/')[0], 10) - 1)
          join(model.index.array, group)
        },
      }
      const key = line.substr(0, 2)
      const action = actionMapping[key]
      if (action) action(line)
    })
    models.push(model)
  })
  return models
}
