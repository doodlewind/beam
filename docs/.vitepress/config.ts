import { defineConfig } from 'vitepress'

// Shared nav + sidebar builders, parameterized by locale prefix and labels so
// the English root and the Chinese /zh/ tree stay in lockstep.

const enNav = [
  { text: 'Guide', link: '/guide/introduction' },
  { text: 'API', link: '/api/' },
  { text: 'Examples', link: '/examples/' },
]

const enSidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'What is Beam?', link: '/guide/introduction' },
      { text: 'Getting Started', link: '/guide/getting-started' },
    ],
  },
  {
    text: 'Core Concepts',
    items: [
      { text: 'Device', link: '/guide/device' },
      { text: 'Pipeline', link: '/guide/pipeline' },
      { text: 'Resources', link: '/guide/resources' },
      { text: 'Bindings & Draw', link: '/guide/bindings-and-draw' },
      { text: 'Targets', link: '/guide/targets' },
      { text: 'Frame & Loop', link: '/guide/frame-and-loop' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'WGSL Conventions', link: '/guide/wgsl-conventions' },
      { text: 'Migrating from WebGL', link: '/guide/migrating-from-webgl' },
    ],
  },
]

const zhNav = [
  { text: '指南', link: '/zh/guide/introduction' },
  { text: 'API', link: '/zh/api/' },
  { text: '示例', link: '/zh/examples/' },
]

const zhSidebar = [
  {
    text: '介绍',
    items: [
      { text: '什么是 Beam？', link: '/zh/guide/introduction' },
      { text: '快速开始', link: '/zh/guide/getting-started' },
    ],
  },
  {
    text: '核心概念',
    items: [
      { text: '设备', link: '/zh/guide/device' },
      { text: '管线', link: '/zh/guide/pipeline' },
      { text: '资源', link: '/zh/guide/resources' },
      { text: '绑定与绘制', link: '/zh/guide/bindings-and-draw' },
      { text: '渲染目标', link: '/zh/guide/targets' },
      { text: '帧与循环', link: '/zh/guide/frame-and-loop' },
    ],
  },
  {
    text: '参考',
    items: [
      { text: 'WGSL 约定', link: '/zh/guide/wgsl-conventions' },
      { text: '从 WebGL 迁移', link: '/zh/guide/migrating-from-webgl' },
    ],
  },
]

export default defineConfig({
  title: 'Beam',
  description: 'Expressive WebGPU',
  // Deployed at https://doodlewind.github.io/beam/ (GitHub project Pages).
  base: '/beam/',
  cleanUrls: true,

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: enNav,
        sidebar: {
          '/guide/': enSidebar,
          '/api/': enSidebar,
          '/examples/': enSidebar,
        },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-Hans',
      link: '/zh/',
      themeConfig: {
        nav: zhNav,
        sidebar: {
          '/zh/guide/': zhSidebar,
          '/zh/api/': zhSidebar,
          '/zh/examples/': zhSidebar,
        },
      },
    },
  },

  // The example gallery links into the separate examples Vite app (deployed
  // under /play/, dev server at root), not into docs pages — don't validate.
  ignoreDeadLinks: [/^\/play\//],

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/doodlewind/beam' },
    ],
  },
})
