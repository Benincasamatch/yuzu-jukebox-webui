# Yuzu Jukebox Web

[Yuzu Jukebox](https://github.com/Youwenqwq/yuzu-jukebox)（Go 服务端）的 Web 客户端：聆听、控制、管理。协议以服务端 `docs/spec-v1.md` 为准，本仓为其实现。

## 功能

- 房间聆听：全局同步播放、辉光舞台、同步歌词、Media Session 系统媒体控制
- 房间控制：入队 / 点歌、进度控制、音量
- 大厅实况：在线房间列表，含听众数与当前播放
- 管理：房间建删、电台 / 策略 / 历史、歌单与媒体管理（上传 / 本地媒体 / 缓存 / 凭据扫码）、播放端
- 登录：统一认证与 102 账号登录均跳转浏览器；安卓通过一次性 PKCE 授权码回传 App，本地管理员权限自动映射。音乐服务需设置 `unified_auth.public_url` 并允许 `https://localhost` 跨域；无网关的服务器保留 OIDC PKCE 登录兼容路径。
- Android 1.2.1：同步最新界面、红魔馆皮肤、房间音量、全屏优化及搜索来源平台图标；首次安装默认连接 `https://music.102.yuna.team`，自选服务器优先；网络/SSL/服务停机不会清除已保存的会话，可重试恢复；完成的浏览器回调不再阻断启动恢复。桌面图标使用服务器已有的咲夜 SVG 原图转换，版本码为 10201，覆盖安装说明见 `docs/releases/1.2.1.md`。
- 界面：参考 Apple HIG 的内容层级、系统字体与材质设计；固定侧栏导航、正在播放首页、封面卡片与移动端底部导航
- 主题：深 / 浅色 + 自定义强调色；本机选择 > config.js > 内置深色，支持减少动态效果、减少透明度与增强对比度；i18n（zh-CN）

## 技术栈

React 19 · Vite 7 · TypeScript（strict）· Tailwind CSS v4 · i18next · radix-ui · vitest

## 开发

```bash
pnpm install   # 注意：pnpm-workspace.yaml 的 allowBuilds: esbuild 必须保留
pnpm dev       # Vite dev，代理 /api /stream /ws → VITE_YUZU_SERVER（默认 127.0.0.1:8080）
pnpm test      # vitest 全量
pnpm build     # tsc -b + vite build
```

本机部署可运行 `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173`，打开 `http://127.0.0.1:4173/`。预览服务将 `/api`、`/stream`、`/ws` 代理至 `VITE_YUZU_SERVER`（默认 `http://127.0.0.1:8080`）。服务端启用管理员口令时，将 `public/config.js` 的 `admin_password_enabled` 设为 `true` 并重新构建。

需要本地服务端：`~/projects/yuzu-jukebox`（或按 `VITE_YUZU_SERVER` 指向远端）。

## 运行期配置

`public/config.js`（部署后直接编辑，无需重新构建）：

| 字段 | 说明 |
| --- | --- |
| `server` | 服务端基址；留空 = 同源 |
| `oidc_client_id` | PKCE 应用 client_id；留空回退服务端主 id |
| `title` / `favicon` | 网页标题 / 图标 |
| `accent` / `scheme` | 默认主题色 / 深浅色（用户本机选择优先） |
| `admin_password_enabled` | 是否显示访客管理员口令框 |
| `android_update_url` / `android_download_url` | Android 更新清单 / 网页顶部 APK 下载地址 |

优先级：`config.js` > 构建期 `VITE_*` > 默认值。

## 架构

```
src/
  protocol/   框架无关协议内核：WS 客户端、校时、房间快照（YuzuClient / ClockSync / SessionStore）
  player/     AudioRenderer、DriftCorrector（对齐基线）、LRC 歌词解析
  api/        REST 客户端
  auth/       TokenStore、OIDC PKCE
  app/        组合根单例：session / player / theme / mediasession
  ui/         React 视图与组件
  i18n/       i18next + zh-CN 文案
```

核心纪律：服务端是唯一权威状态源，UI 只是渲染器；播放位置始终由 `position_ms + updated_at + playing + rate` 推算，不存在本地进度状态。

## 目录

- 协议与对齐行为：服务端仓库 `docs/spec-v1.md`
- 开发约定与踩坑记录：`AGENTS.md`

## License

[AGPL-3.0](LICENSE)

## 界面维护

视觉基础集中在 `src/styles/tokens.css`：深浅色板、系统字体、分隔线与材质使用语义 token；`src/app/theme.ts` 保留用户强调色与主题偏好。运行期 `config.js` 的品牌色仍优先于内置默认值。导航与播放控件使用半透明材质，正文与内容面板保持实色。

首页优先展示热门、播放历史与本房热门，再展示榜单；仅有当前曲目时显示播放展示区，提供全屏播放和标注「控制房间播放状态」的全房间暂停／继续与下一首按钮；房间控制遵循服务端权限，准备起播或请求中禁用，状态只随服务端广播更新。控制区位于当前曲目卡片的标题下方、封面左侧，以紧凑面板呈现，包含播放状态标签、主要播放按钮、下一首和全屏入口；请求中显示等待图标并锁定房间操作。首页及底部播放栏不再显示独立的选择房间按钮，房间切换保留在房间面板和账户菜单。榜单复用 `ChartCard`，缺少封面时显示图标。所有新增文案位于 `src/i18n/zh-CN.ts`。界面调整不应改动音频单例、同步时钟和权限判断。

参考：[Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)。这是适配 Web 的视觉与交互设计，不依赖 Apple 原生 UI 框架。

### 彩蛋皮肤：红魔馆

桌面点击顶部调色盘，在「彩蛋皮肤」选择「红魔馆」；手机打开账户菜单后选择。皮肤使用酒红、绯红与古金夜色，包含原创 SVG 吸血鬼纹章、哥特窗格、绯月、荆棘纹样和边角覆盖的静止钟表、飞刀，覆盖首页、曲目卡片、侧栏、菜单及底部播放栏。再次点击「红魔馆」可返回默认外观。

时停意象仅由页面边角的 SVG 静止钟表、刻度和飞刀构成，不设置独立展示区或交互效果；装饰层不拦截点击，音频、房间状态、进度和歌词照常运行。皮肤选择存入 `yuzu-skin`，启动前恢复，跨标签页同步；普通主题色与深浅偏好保持独立，退出皮肤后恢复。

装饰边框采用古金双线、米白蕾丝与酒红宝石蝴蝶结：弹窗、登录卡和首页播放卡使用完整花边，菜单、标题分隔线和播放栏使用细花边，曲目卡与快捷入口使用内嵌金线。素材位于 `src/styles/assets/scarlet-{lace,bow}.svg`，仅在红魔馆皮肤启用；装饰不接收点击，窄屏缩小花边，增强对比度模式隐藏纹样。

首页「正在播放」卡片使用独立的 `ScarletHeroFrame`：四角金色卷草与宝石、顶部酒红缎带／蝠翼纹章、底部菱形坠饰，配双线内框和上下蕾丝。三张原创素材位于 `src/styles/assets/scarlet-hero-{corner,crest,pendant}.svg`；四角镜像复用，边缘蕾丝平铺，随卡片高度适配而不拉伸纹章。装饰仅在红魔馆皮肤挂载，使用 `aria-hidden` 和 `pointer-events: none`；窄屏缩小图案，增强对比度及强制颜色模式隐藏装饰。

菜单花边仅为未使用 `absolute`／`fixed` 的菜单建立相对定位；不得覆盖主题弹层、右键菜单及电台菜单的定位。主题菜单展开不应改变顶栏高度（常态 72px，搜索聚焦时 84px）。

皮肤实现位于 `src/app/skin.ts`、`src/ui/ScarletSkin.tsx` 与 `src/styles/scarlet.css`。使用本地 SVG/CSS，无外部字体或图片请求；遵循减少动态效果、减少透明度与增强对比度设置。新皮肤不可接入播放控制或同步时钟。

前端已移除「随便听听」区块及私人 FM、心动模式入口；首页与榜单过滤这两类源，旧集合页链接返回榜单，通用电台按钮也不显示这两类源。服务端能力及房间电台状态不变；若房间已有这类电台运行，队列仍提供通用运行提示与停止操作。歌单、榜单等其它来源的电台播放保留。

### 网页跟随播放与房间音量

首页当前曲目控制区提供房间音量和「网页跟随播放」开关。房间音量沿用 controller 权限及房间 output API，拖动松手、键盘调整完成或失焦时提交；获取失败时可重试，不把失败的加载结果当作当前音量。

浏览器默认不跟随播放；`yuzu-web-follow=0/1` Cookie 以 `Path=/; Max-Age=31536000; SameSite=Lax` 保存一年，HTTPS 时加 `Secure`。切歌、空闲和换房不重置该偏好；刷新恢复选择。主页开关、底栏、全屏和系统媒体控件的个人播放操作共用单例并更新 Cookie。关闭跟随仅让本网页静默，不改变房间播放；开启时对齐房间当前进度。原生 Android 仍保持原有个人播放行为。Cookie 被浏览器禁用或清除后，新加载页面默认关闭跟随。

榜单卡片采用顶部对齐的纵向布局，封面固定正方形，并为副标题统一预留两行高度；有无副标题时封面与标题均保持对齐。

### 全屏舞台性能

全屏按实际视口挂载单套桌面／移动视图；背景使用单层静态径向渐变，去除全视口多层大半径 blur。展开阶段先复用普通封面，动画后再显示高清图和歌词；手机首次仅挂载封面，切到歌词时才创建歌词列表。歌词面板按内容与激活行记忆化，屏幕外的歌词使用 content-visibility 跳过排版绘制，仍保留完整手动滚动；首次定位不平滑滚动，后续仅滚动歌词容器。关闭回调与滚动锁保持稳定，避免底栏每秒更新导致重复锁定与布局读取。

红魔馆边角 SVG 提高了钟表／飞刀的不透明度与线条粗细，继续保持静态、不可拦截点击。

### Android 发布维护

1. `npm run build`（含恢复已发布下载资源），随后 `node node_modules/@capacitor/cli/bin/capacitor sync android`。
2. `JAVA_HOME=/home/yuna/tools/jdk-21 ANDROID_HOME=/home/yuna/Android/Sdk android/gradlew -p android --offline --no-daemon assembleDebug`。
3. 用 apksigner 对比上版证书、核对版本及 APK 内前端资源。将版本 APK 和 `latest.apk` 放到 `releases/android/`，生成含 packageId、versionCode、versionName、apkUrl、sha256、notes 的 `latest.json`，执行 `node scripts/restore-android-updates.mjs` 发布。清单最后原子替换，APK 排除 `app-updates`，不嵌套分发文件。
4. 验证正式域名的清单、APK 状态、下载哈希及 MIME 类型。默认更新源独立于用户自选音乐服务器，App 启动时检查，账户菜单／登录页可手动检查；旧 1.1.3 需先手动覆盖安装最新 APK。
