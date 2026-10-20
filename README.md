# 角色动作网页演示

无需摄像头，支持眨眼、张嘴、呼吸与本地音频驱动嘴形。

这是分层网格动画原型，不是 Cubism 模型。音频仅在浏览器本地处理，不上传。

在线预览：https://kai1836172882-alt.github.io/character-motion-demo/

## V3 分层网格

- 102 个原位 PSD 图层按连续绘制顺序整理为 31 个部件，加 1 层身体补画底层，分别绘制三角网格。
- 胸部衣料随呼吸轻微起伏；前后发束、领带、耳饰、飘带和衣物做小幅跟随。部件使用固定根部和阻尼弹簧，避免一起同步晃动。
- 补画覆盖胸前发束和领带下方的衣料、肩部及腰封；完整底层承接细小遮挡空隙。原图可见区域优先保留。
- 可分别关闭胸部衣料、头发、领带与衣物动作，查看变形网格，调整整体幅度。
- 坐标为 1086×1448，纹理按两倍采样导出。这是源图放大，不是原生 4K 重绘。

- 已移除点头、左右摇头及自动摇头。默认待机不再自动改变头部朝向，开心回应只改变表情。
- 保留手动歪头、双眨眼、开心回应；支持依次演示及随时停止。
- 自然待机表情、轻微发丝摆动可分别关闭；指针跟随默认关闭，需要时手动开启（触屏可点画面）。
- 原有手动嘴形、本地音频驱动、暂停与恢复、背景切换保留。
- 系统开启“减少动态效果”时，自动动作与跟随默认关闭；手动动作仍可触发。

这不是 `.moc3` 或 Cubism 编辑器工程，不支持大角度转身；细发边缘与原始拆图残留仍有进一步精修空间。指针带动的是头部朝向，未单独绑定眼珠。默认待机头部固定。

## 和修图同伴协作

素材已经从 HTML 中分离，文件名和位置固定：

| 文件 | 用途 |
|---|---|
| `assets/original.png` | 原图与脸部表情取样参考 |
| `assets/expression.png` | 闭眼、闭嘴的补画表情 |
| `assets/rig/*.webp` | 实际绘制的透明部件纹理，按原位清单对齐 |
| `assets/rig/manifest.json` / `rig-assets.js` | 部件位置、源图层归属和绘制顺序；构建时同步生成 |
| `assets/rig/underpaint-source.png` | 本轮衣料与肩部补画来源 |
| `rig.js` / `mesh-renderer.js` | 网格变形、跟随计算与 WebGL 绘制 |
| `app.js` | 交互与音频控制 |
| `motion.js` | 三个动作的时间曲线 |
| `style.css` / `index.html` | 界面样式和布局 |

两张 PNG 均为 1086×1448 RGBA，必须保持角色、五官位置与画布大小一致。修噪点时保留透明底。修改眼睛/嘴部的肤色或边缘时，两张表情图应同步修改，避免表情切换时出现色差。

**V3 的身体和头发来自 `assets/rig/`，只替换 original.png 不会更新这些部件。** 同伴可以直接修对应透明 WebP（保持尺寸、位置与 alpha），或修改 PSD 后导出原位 PNG 图层及图层清单，再重建。重建会覆盖 `assets/rig/` 的生成文件，请先提交/备份手工修图，避免覆盖同伴的成果。项目没有修改原始 PSD 或原始两张 PNG。

重建（需要 Node 与 `sharp`，使用可解析的 sharp 安装；也可将 `CHARACTER_SHARP_MODULE` 设为其模块路径）：

```sh
node tools/build-rig.cjs "PSD导出目录" "补画来源.png"
```

导出目录需要 `图层清单.json` 和其中引用的 `PNG图层/` 文件。清单格式沿用本项目 102 层工作稿。输出纹理是无损 WebP；原位合成预览为 `assets/rig/rest-preview.png`。本轮补画由内置 imagegen 生成，提示词见 `docs/underpaint-prompt.txt`。

## 本地运行

分文件版通过 HTTP 打开：安装 Node 后运行 `node tools/serve.cjs`，访问终端输出的本机地址，Ctrl+C 停止。

离线单文件版：`node tools/build-offline.cjs preview.html`，之后可直接双击 `preview.html`；图片和脚本会嵌入文件，不需要服务器。

测试：`node --test tests/*.test.cjs`。

本地服务器还提供 `/rig-check.html`，可检查原位、正反最大幅度、交叉方向、表情与网格，并下载透明测试帧。

接入脚本可调用 `characterPreview.play('doubleBlink')`；动作名为 `tilt`、`doubleBlink`、`happy`。`nod` 和 `shake` 已移除，调用会返回 false。本页尚未接入 AI 聊天后端。
