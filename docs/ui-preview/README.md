# 前端改版预览

这些截图由本地真实 React 页面在 Firefox 137 无头浏览器中渲染，使用浏览器内注入的演示身份、歌单与榜单数据；不代表正式服务器上的账号或内容。运行期蓝色品牌配置保持不变。

- `desktop-light.png` / `desktop-dark.png`：1440px 桌面深浅主题。
- `tablet-light.png`：820px 平板。
- `mobile-light.png` / `mobile-dark.png`：390px 手机深浅主题。
- `mobile-small.png`：320px 窄屏。
- `desktop-current.png` / `mobile-current.png`：有当前曲目时的全屏入口和房间播放状态控制。
- `mobile-current-small.png`：320px 窄屏播放控制区。
- `login-mobile.png`：手机登录页。

检查了视口无横向溢出、主要区域无内容溢出，以及首页搜索跳转和全屏播放入口。热门、播放历史、本房热门位于榜单与电台之前；空闲时不显示大幅播放介绍区。房间播放按钮标注「控制房间播放状态」，包含播放状态、暂停／继续、下一首与全屏入口，使用房间级 pause/resume/skip 命令，状态等待广播更新，无权限时禁用。演示验证确认下一首发出 `playback.skip`，请求中锁定两个房间操作，准备播放时不发送切歌命令。截图用于本地设计审阅，不构成真实账号登录、音频出声或正式域名部署验证。

## 红魔馆彩蛋皮肤

`toolbar-menu-fix/scarlet-theme-open.png` 展示主题弹层打开后的紧凑顶栏。修复了菜单花边的 `position: relative` 覆盖主题弹层 `absolute`、导致顶栏从 72px 增至约 284px 的问题；红魔馆与默认主题在 1440／900／768px 视口下，菜单打开前后顶栏均为 72px，搜索聚焦时保持 84px，固定菜单保持 `fixed` 定位。

`scarlet-hero/desktop-card.png` 为首页「正在播放」卡片的独立边框预览；同目录的 `desktop.png`、`laptop.png`、`mobile.png`、`small.png` 分别使用 1920、1280、390、320px 视口，均为演示数据。专用素材为 `src/styles/assets/scarlet-hero-{corner,crest,pendant}.svg`：角部卷草镜像复用，顶部缎带／蝠翼宝石与底部坠饰固定比例缩放，上下蕾丝平铺。浏览器检查覆盖横向溢出、控制区点击命中、装饰不接收点击，以及切回默认主题时移除装饰；类型检查与 Vite 生产构建通过。

`scarlet-desktop.png`、`scarlet-mobile.png`、`scarlet-small.png` 分别展示 1440px、390px、320px 的酒红与古金外观，`scarlet-mobile-menu.png` 展示手机账户菜单中的皮肤入口。均为演示数据。

验证换肤保留原配色、皮肤选择持久化、首帧恢复、底栏存在及无横向溢出；时停元素现为边角 SVG 钟表与飞刀装饰，已移除独立邀请卡、时停按钮和动效；旧截图中的这些元素仅代表早期版本。

## 房间音量与网页跟随播放

`follow-desktop.png`、`follow-mobile.png`、`follow-small.png` 展示控制区新增的房间音量滑杆和网页跟随开关，使用演示数据，音频 play 方法被隔离替代。默认 Cookie 为 `yuzu-web-follow=0`；演示确认首次播放调用为零，开启、关闭与刷新均恢复正确，底栏个人暂停更新 Cookie，空闲和换房保持关闭。房间音量从 35 改到 75 只提交一次 `{volume:75}`，网页 audio.volume 仍为 1；桌面和窄屏没有横向溢出。

`charts-aligned-desktop.png` 和 `charts-aligned-mobile.png` 为最新对齐验证截图，使用同排一个没有副标题、一个有副标题的榜单；同时展示静态边角 SVG 时停装饰。

## 全屏性能与增强 SVG

`fullscreen-desktop.png` / `fullscreen-mobile.png` 是用 600 行演示歌词验证后的全屏画面；`scarlet-enhanced-corners.png` 展示增强不透明度和线条的角落 SVG。桌面全屏实际只有一张封面、一套歌词，进入时歌词列表为零，动画结束后才创建；手机初始不挂载歌词，切换后创建一套。背景 blur 层为零，动画合成提示会释放，Escape 退出后 body/main 滚动锁恢复。

无头 Firefox 的帧间隔仅作诊断，仍观察到少量超过 50ms 的间隔，不代表真实用户设备已完全消除卡顿；这次验证证明了重复渲染与重型背景层的移除及交互正确性。
