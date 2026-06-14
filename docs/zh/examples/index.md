---
title: 示例
---

# 示例

这里汇集了一系列短小、自包含的程序，覆盖了整个 `beam-gpu` 的功能面——从第一个三角形，到 PBR 材质、阴影贴图，再到 GPU 上的元胞自动机。每个示例都只有几十行 TypeScript 加上一个手写的 `.wgsl` 模块，因此你可以坐下来一口气从头读到尾。

::: tip 在本地运行
这些示例位于 `examples` 工作区中。在仓库根目录下运行 `pnpm dev` 启动示例应用，然后在浏览器中打开对应的链接路径。下面每个链接都指向该示例所在的文件夹（`/play/pages/<category>/<name>/`）。
:::

::: warning 需要 WebGPU
每个示例都使用原生 WebGPU 进行渲染。你需要一个支持 WebGPU 的浏览器（较新的 Chrome、Edge 或 Safari），并已启用硬件加速。如果画布始终空白，请检查 `navigator.gpu` 是否可用。
:::

## 基础图形

从这里开始。这些示例覆盖了核心流程：从 WGSL + schema 构建管线、创建资源、然后绘制。

- <PlayLink to="basic-graphics/hello-world">Hello world</PlayLink> —— 黄金标准式的起点。用一个管线、一个 `verts` 资源和一个 `frame` 画出一个三角形。先读这个。
- <PlayLink to="basic-graphics/image-box">Image box</PlayLink> —— 透视相机下的一个带纹理立方体，引入了 `texture`、`sampler` 和一个 `mat4` uniform。
- <PlayLink to="basic-graphics/basic-ball">Basic ball</PlayLink> —— 一个法线着色的球体，展示了索引几何体和相机矩阵。
- <PlayLink to="basic-graphics/zooming-ball">Zooming ball</PlayLink> —— 用 `beam.loop` 让同一个球体动起来，每帧更新 uniform。
- <PlayLink to="basic-graphics/multi-balls">Multi-balls</PlayLink> —— 在一帧中绘制多个球体，每个对象一个 `uniforms` 资源（DESIGN §3.3）。
- <PlayLink to="basic-graphics/multi-graphics">Multi-graphics</PlayLink> —— 立方体和球体一起绘制，在同一帧中混合不同的几何体。
- <PlayLink to="basic-graphics/wireframe">Wireframe</PlayLink> —— 使用两个管线，在着色网格之上叠加一个线框 pass。

## 图像处理

全屏四边形管线：每个片元就是一个像素，乐趣都在着色器里。一个共享的单位四边形为它们全部提供输入。

- <PlayLink to="image-processing/basic-image">Basic image</PlayLink> —— 在一个平面四边形上用纹理填满画布，不做投影。最简单的纹理采样。
- <PlayLink to="image-processing/single-filter">Single filter</PlayLink> —— 一个滤镜，配有实时滑块控件，在每次重绘前写入一个具名 uniform。
- <PlayLink to="image-processing/multi-filters">Multi-filters</PlayLink> —— 三个单 pass 滤镜共享同一个顶点 schema，各自拥有自己的管线。
- <PlayLink to="image-processing/mix-images">Mix images</PlayLink> —— 在一个着色器中混合两张纹理，两者复用同一个 sampler。
- <PlayLink to="image-processing/load-svg">Load SVG</PlayLink> —— 通过 blob 加载器栅格化一个 SVG，并将其作为纹理上传。
- <PlayLink to="image-processing/premultiply-alpha">Premultiply alpha</PlayLink> —— 使用预乘 alpha 的上下文和与之匹配的着色器输出，将画布合成到页面背景之上。
- <PlayLink to="image-processing/texture-config">Texture config</PlayLink> —— 探索 sampler 和纹理选项（wrap、filter、`flipY`），每次更改都重建不可变的 sampler。

## 3D 模型

带光照的几何体、法线矩阵，以及基于物理的着色。

- <PlayLink to="3d-models/basic-lighting">Basic lighting</PlayLink> —— 方向光照明，提供交互控件来调整模型旋转以及光的方向/颜色/强度。
- <PlayLink to="3d-models/material-ball">Material ball</PlayLink> —— 一个使用环境贴图和 BRDF LUT 的 PBR 球体，其 uniform 结构体按 std140 布局排列。
- <PlayLink to="3d-models/material-balls">Material balls</PlayLink> —— 一个 PBR 球体网格，扫描遍历不同的粗糙度和金属度，每个球一个 `uniforms` 资源。

## 离屏渲染

渲染到纹理的目标：先绘制到一个离屏 `Target`，然后在第二个 pass 中采样它的颜色或深度。

- <PlayLink to="offscreen/basic-mesh">Basic mesh</PlayLink> —— 将一个带光照的网格渲染到一个颜色 + 深度目标中，然后把那张颜色贴图 blit 到一个全屏四边形上。
- <PlayLink to="offscreen/basic-shadow">Basic shadow</PlayLink> —— 一个两 pass 的阴影贴图：先从光源视角渲染深度，然后从相机视角用一个比较型 sampler 进行着色。
- <PlayLink to="offscreen/visualize-depth">Visualize depth</PlayLink> —— 填充一个离屏深度缓冲，然后将 `target.depth` 采样到一个灰度视图中。

## 特效

多 pass 与乒乓（ping-pong）技术。

- <PlayLink to="effects/conway">Conway</PlayLink> —— 在 GPU 上运行康威生命游戏，用一个 step 管线和一个 display 管线在两个目标之间乒乓地交换状态。
- <PlayLink to="effects/image-explode">Image explode</PlayLink> —— 一个带纹理的四边形网格，向外炸开再重新组合，由一个进度 uniform 驱动动画。

## 设计模式

在简洁的核心之上构建的更高层结构。

- <PlayLink to="design-patterns/build-renderer">Build renderer</PlayLink> —— 将 `beam-gpu` 封装进一个小巧的 `MeshRenderer` / `Mesh` 抽象，由它持有 device、管线和场景，从而让应用代码保持极简。
