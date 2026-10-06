# Vision 走查 R5–R10（2026-10-06，主会话迭代轮）

> 背景：用户视觉评审判定当时状态「不及格」，要求以 vision 子代理走查 + 继续迭代。
> 方法：每轮 fresh-context vision critic（不读源码、只看截图、严格 art-director 人设）→
> 按高杠杆清单修复 → 重截全套 → 下一轮 fresh critic。截图存于 /tmp/webui-walkthrough/。

## 分数轨迹

| 轮次 | 分数 | 判定 | 本轮主打修复 |
| ---- | ---- | ---- | ---- |
| R5 | 6.0 | — | 首次严格 fresh critic：高杠杆清单 8 项 + 3 项大手术 |
| R6 | 7.7 | CONDITIONAL | 双栏工作台（表单左/画布右 + 空态）、失败任务紧凑卡、429/401/404/5xx/网络错误 i18n 映射、禁用态统一中性灰、移动端状态 nowrap、批量文案去重、库卡片放大 |
| R7 | 7.9 | CONDITIONAL | 成功卡右栏垂直居中 + 图片 420px 封顶、禁用 CTA 加一句原因、批量单列 + textarea 增高、库抽屉加宽 576px 双列方图、破坏性动作红显、库网格宽度同步测量（IAB ResizeObject 永不回调的健壮性修复） |
| R8 | 8.2 | CONDITIONAL | 禁用文案单句化、批量 CTA sticky 钉底（rail max-h 修正为 calc(100vh-9.5rem)）、库按钮墙收敛（预览/下载描边/⋮）、抽屉宽度档位统一、vision 细节级别本地化、触控目标第一批 |
| R9 | 8.0 | CONDITIONAL | Tab 激活改琥珀描边（实心琥珀只留 CTA）、库卡死区消除、禁用皮统一 surface-2、vision 提交卡钉底（首版）、触控目标全部 ≥44px（实测 nav/stepper/trash=44） |
| R10 | **8.6** | **ACCEPT** | 下载动作统一琥珀描边（实心=每屏唯一 CTA 成文）、vision 提交卡真钉底（flex 链 mt-auto 贯通 Drawer→面板→form）、全局暗色滚动条、移动端 textarea 禁 resize；终审 critic 凭 r10 截图证据闭环两处 P1 后给出 ACCEPT |

## R10 后的琥珀法则（设计规范成文）

- **实心琥珀**：每屏唯一主 CTA（开始生成 / 开始批量生成）。开始识图禁用时为中性灰。
- **琥珀描边**（border-accent/40 + text-accent）：下载（画布卡与库卡同皮）、比例 chip 选中态、Tab 激活态（bg-accent/10 + ring-accent/40）。
- **中性灰**（bg-surface-2 + text-text-tertiary）：一切禁用态，永远暗于可用控件，配单句原因文案。
- **红色**仅用于语义错误/破坏性动作（失败徽章、错误条、删除、清空缓存），全部带确认或恢复路径。

## 结构性决定记录

1. **双栏工作台**（R6）：≥1280px 表单左（sticky, max-h calc(100vh-9.5rem)，预留头部 chrome 保证钉底 CTA 始终在视口内）+ 画布右；空画布有设计过的空态。
2. **失败任务紧凑卡**（R6）：error/cancelled 且无图的任务不再渲染 ~500px 空画布，折叠为紧凑行（徽章 + meta + 单行 prompt + 本地化错误 + 行内重试/使用此参数 + kebab）。
3. **错误 i18n 映射**（R6）：src/lib/errors.ts `toI18nError` 把 429/401/403/404/5xx/网络失败映射到 `errors.*` 命名空间 key，TaskCard 既有 isI18nKey 机制自动本地化；未知错误原样保留可读性。
4. **库抽屉**（R7/R8）：Drawer 增加 size 档位（md=448 表单 / lg=576 浏览面），卡片 200px 双列方图（保形）、单行 model·size meta、预览/下载描边/⋮ 三件套。
5. **IAB 环境健壮性**（R7）：ResizeObserver 在内嵌 webview 永不回调 → 网格挂载时同步 getBoundingClientRect 测一次初值（对真实浏览器同样无害）。

## 已知保留项（P2，未阻塞）

- 拉丝铝材质叙事仍不可辨（身份靠琥珀纪律 + 布局语法支撑）；需要真正的材质层设计时再立项。
- 主 chunk ~678KB 构建警告、无自动化测试（后续 P2 债务）。
- 页脚语言切换胶囊样式偏「悬浮」，可并入页脚排版。
