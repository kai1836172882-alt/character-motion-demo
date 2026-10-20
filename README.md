# 角色动作网页演示

无需摄像头，支持眨眼、张嘴、呼吸、轻微摇头与本地音频驱动嘴形。

这是二维图像动画原型，不是 Cubism 模型。音频仅在浏览器本地处理，不上传。

在线预览：https://kai1836172882-alt.github.io/character-motion-demo/

## V2 动作

- 点头、左右摇头、歪头、双眨眼、开心回应；支持依次演示及随时停止。
- 自然待机小动作、轻微发丝摆动、指针跟随（触屏可点画面），可分别关闭。
- 原有手动嘴形、本地音频驱动、暂停与恢复、背景切换保留。
- 系统开启“减少动态效果”时，自动动作与跟随默认关闭；手动动作仍可触发。

这是连续图像小幅变形，不是真实侧脸或独立发束的 Cubism 绑定。指针带动的是头部朝向，未单独绑定眼珠。

## 和修图同伴协作

素材已经从 HTML 中分离，文件名和位置固定：

| 文件 | 用途 |
|---|---|
| `assets/original.png` | 睁眼、张嘴的原始表情 |
| `assets/expression.png` | 闭眼、闭嘴的补画表情 |
| `app.js` | 渲染、交互与音频 |
| `motion.js` | 五个动作的时间曲线 |
| `style.css` / `index.html` | 界面样式和布局 |

两张 PNG 均为 1086×1448 RGBA，必须保持角色、五官位置与画布大小一致。修噪点时保留透明底。修改眼睛/嘴部的肤色或边缘时，两张表情图应同步修改，避免表情切换时出现色差。替换这些 PNG 并提交后，GitHub Pages 会重新部署。

此前 102 层 PSD 不参与此网页的实时渲染；它是后续制作真正 Live2D 模型的素材，修改 PSD 后还需导出上述两张图。

## 本地运行

分文件版通过 HTTP 打开：安装 Node 后运行 `node tools/serve.cjs`，访问终端输出的本机地址，Ctrl+C 停止。

离线单文件版：`node tools/build-offline.cjs preview.html`，之后可直接双击 `preview.html`；图片和脚本会嵌入文件，不需要服务器。

测试：`node --test tests/*.test.cjs`。

接入脚本可调用 `characterPreview.play('nod')`；动作名为 `nod`、`shake`、`tilt`、`doubleBlink`、`happy`。本页尚未接入 AI 聊天后端。
