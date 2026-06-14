// Resolve a public asset URL under the app's deploy base. In dev the base is
// '/', so asset('/assets/x.png') -> '/assets/x.png'; when the examples are
// built for GitHub Pages under '/beam/play/', it becomes '/beam/play/assets/x.png'.
export const asset = (path: string): string =>
  import.meta.env.BASE_URL + path.replace(/^\/+/, '')
