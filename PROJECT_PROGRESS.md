# Atelier 项目进度整理

> 本文档记录截至 2026-05-27 的项目状态，基于 `atelier` 分支（commit: `7f6e80a`），工作区存在大量未提交的活跃改动。

---

## 一、项目定位

**Atelier** 是从开源项目 InkOS（github.com/Narcooo/inkos, AGPL-3.0）硬分叉的自主 AI 严肃文学写作系统。核心转向：

- **从** 中文网文工业流水线（玄幻/仙侠/都市/科幻，平台雷达，同人番外）
- **到** 严肃文学创作助手（社会现实主义、心理现实主义、家庭史诗、生态文学等，强调主题深度、心理真实、意象网络、社会拓扑）

> 品牌名从 `InkOS` → `Atelier`，包名从 `@actalk/inkos-*` → `@atelier/*`，CLI 二进制从 `inkos` → `atelier`。

---

## 二、架构概览（Monorepo）

| 包 | 职责 | 关键依赖 |
|---|---|---|
| `@atelier/core` | 引擎：全部 Agent、管线编排、状态管理、LLM 抽象、Zod 模型 | TypeScript, Zod, pi-agent-core, SQLite |
| `@atelier/cli` | 终端入口：命令、TUI 仪表盘、国际化 | Commander.js, Ink (React for terminal), React 19 |
| `@atelier/studio` | Web 工作台：可视化书籍管理、章节编辑、真相文件编辑、服务配置 | Vite, React 19, Hono, Tailwind CSS v4, Zustand, Motion |

**交互一致性**：TUI、Studio Chat、`atelier interact`、OpenClaw Skill 共享同一套 `interaction/runtime.ts` + `interaction/nl-router.ts`，自然语言意图路由到相同的原子工具，无论用户从哪个界面进入。

---

## 三、已完成的核心改造

### 3.1 文学真相文件体系（新增 6 个结构化长期记忆）

基于 Zod Schema 的 JSON 权威存储 + Markdown 人类可读投影：

| 文件 | 核心内容 | 对应 Agent |
|---|---|---|
| `thematic_framework.json` | 核心命题、价值张力、变奏路线、结局姿态、禁忌解 | ThematicAnalyst |
| `character_psychology.json` | 心理塑形事件、家族传递模式、阶级烙印、核心矛盾性、注意习惯、弧光节拍、关系动力学 | CharacterPsychologist |
| `symbolic_network.json` | 核心意象节点（seeded/echoed/transformed/silent 状态机）、色彩/空间/动作象征系统 | SymbolWeaver |
| `social_topology.json` | 经济层、权力网络（正式/非正式）、文化系统（仪式/代际/语言层）、空间地理 | SocialTopologist |
| `narrative_rhythm.json` | 卷情绪曲线、章节密度、呼吸点、强度等级 | （手动编辑） |
| `historical_context.json` | 年代、政策锚点、物质锚点、语言锚点、时代错位防护 | SocialTopologist |

**设计决策**：
- JSON 为权威来源，Markdown 为投影——防止 LLM 重写整份文件时产生"坏数据雪崩"
- 所有 schema 支持版本号（`schemaVersion: 1`），为未来迁移预留空间
- 状态机约束：同一意象禁止连续渲染 >2 次

### 3.2 新增 4 个文学专用 Agent

| Agent | 文件 | 职责 |
|---|---|---|
| ThematicAnalyst | `thematic-analyst.ts` (108 loc) | 从创作简报提炼主题骨架，产出核心命题 + 价值张力 + 变奏路线 |
| CharacterPsychologist | `character-psychologist.ts` (134 loc) | 构建人物心理档案，聚焦"矛盾性"而非"标签+反差" |
| SymbolWeaver | `symbol-weaver.ts` (119 loc) | 编织意象网络，追踪意象在 seeded → echoed → transformed → silent 状态机中的演进 |
| SocialTopologist | `social-topologist.ts` (154 loc) | 构建社会拓扑四子层（经济/权力/文化/空间），确保人物在结构中行动 |

### 3.3 EditorialAuditor — 文学层审计（新增）

三层合并审计：
1. **连续性审计**（原有 33 维度）— 角色记忆、物资连续性、伏笔回收、大纲偏离等
2. **AI 痕迹检测**（规则基，9 个文学调优维度）— 高频疲劳词、句式单调、过度总结
3. **文学维度审计**（LLM 评估，10 个严肃文学维度，编号 30-39）

**10 个文学审计维度**：
1. 主题一致性 — 折射是否含蓄，是否避免议论
2. 心理深度 — 行为是否可追溯至塑形经历
3. 矛盾性优先 — 真实的内部撕扯，非机械标签
4. 群像独立性 — 配角是否有独立于主角的关切
5. 意象网络 — 意象是否承担主题折射，状态机推进
6. 留白与克制 — 至少一处主动省略，避免上帝视角总结
7. 节奏呼吸 — 紧张/松弛交替，可辨识换气处
8. 对话潜台词 — 表层 A / 里层 B，避免全透明对话
9. 感官具体性 — 视觉之外至少一项感官，具体名词压过抽象词
10. 结局承认丧失 — 阶段性收束必须让读者闻到代价

**关键设计**：审计不通过 → 自动进入"修订 → 再审计"循环，直到关键问题清零。

### 3.4 体裁系统重构

**删除 12 个网文体裁**：玄幻、仙侠、都市、科幻、异世界、Litrpg、升级文、地牢核心、爬塔、系统末日、浪漫奇幻、恐怖、修仙

**新增 8 个严肃文学体裁**（每个均为带 YAML frontmatter 的 Markdown 配置）：
- `social-realism`（社会现实主义）
- `rural-decline`（乡村衰败）
- `psychological`（心理现实主义）
- `family-epic`（家庭史诗）
- `existential`（存在主义）
- `ecological`（生态文学）
- `historical`（历史小说）
- `urban-migration`（城乡迁移）

每个体裁定义：章节类型（如"处境章/对峙章/缝隙章/回响章/代价章"）、疲劳词表、节奏规则、审计维度、叙事禁忌、语言铁律。

### 3.5 Studio Web 工作台改造

**删除页面**：
- `BookDetail.tsx` → 功能拆分到 `BookSettings` + `ChatPage`
- `DaemonControl.tsx` — 守护进程模式移除
- `RadarView.tsx` — 平台市场雷达移除

**新增/重构页面**：
- `BookSettings.tsx`（1008 loc）— 书籍设置 + 创作圣经 6 Tab 可视化
  - 主题 / 人物心理 / 意象网络 / 社会拓扑 / 叙事节奏 / 历史语境
  - 支持 Agent 一键生成、JSON 直接编辑、Zod 校验保存
  - 危险区：书籍删除二次确认（输入 bookId）
- `BookCreateWizard.tsx` — 新的分步建书向导
- `ChapterList.tsx` — 章节列表独立页面

**API 新增**（`server.ts`）：
- `GET /api/v1/books/:id/literary-truth` — 可用性 + 计数摘要
- `GET /api/v1/books/:id/literary-truth/:key` — 读取单个真相文件
- `PUT /api/v1/books/:id/literary-truth/:key` — 保存（Zod 校验）
- `POST /api/v1/books/:id/literary-truth/:key/regenerate` — 调用 Agent 重新生成

### 3.6 CLI 新增命令

```bash
atelier theme [book-id]       # 生成/优化主题框架
atelier character [book-id]   # 生成/优化人物心理档案
atelier symbol [book-id]      # 生成/优化意象网络
atelier social [book-id]      # 生成/优化社会拓扑
```

### 3.7 核心管线调整

- Planner / Writer Prompt 重新调优：强调文学克制（慢节奏、潜台词、省略）
- `ai-tells.ts` 扩展文学调优维度
- 输入治理 v2（`plan` → `compose` → `draft`）保留并增强
- 字数治理、多模型路由、状态快照、导出（txt/md/epub）全部保留

---

## 四、已删除的原 InkOS 功能

| 功能 | 原因 |
|---|---|
| Daemon 模式 (`inkos up/down`) | 严肃文学创作不需要后台自动量产 |
| Fanfiction / 同人创作 | 脱离网文生态，不再适用 |
| 平台雷达（Radar） | 不再追踪网文平台趋势 |
| 市场扫描 / 平台格式导出 | 脱离网文发布链路 |
| `eval` 命令 | 评估体系随体裁转向而失效 |
| `draft` 独立命令 | 统一为管线内步骤 |

---

## 五、当前工作区状态

```
Branch: atelier
Commit: 7f6e80a "Update README.md"

Changes not staged for commit: 111 files modified, 1634 insertions(+), 3548 deletions(-)
Untracked files: 22
```

**未提交文件分类**：
- **CLI**: 删除 daemon/draft/eval/fanfic/genre/radar 命令；新增 theme/character/symbol/social 命令；大量命令适配新包名
- **Core**: 删除 12 个网文体裁文件；新增 8 个文学体裁 + 4 个文学 Agent + 文学真相文件模型 + EditorialAuditor
- **Studio**: 删除 BookDetail/DaemonControl/RadarView；新增 BookSettings/BookCreateWizard/ChapterList/AuditPanel/CreativeBibleSection；API 扩展文学真相文件端点；路由重构

**测试状态**：
- 159 个测试文件，覆盖 CLI 集成、Studio API、Core Agent、TUI 组件、Session Store
- 部分测试已更新适配新包名，但尚未全量验证通过

---

## 六、待完成项

| 优先级 | 事项 | 说明 |
|---|---|---|
| P0 | 提交当前工作区 | 111 个 modified + 22 个 untracked 需要分批 commit |
| P0 | 测试修复 | 包名更名后部分 import 路径、snapshot 可能失效 |
| P1 | CI/CD 工作流更新 | `.github/workflows` 仍引用 `@actalk/inkos` 包名 |
| P1 | Studio 品牌替换 | 部分 UI 仍显示 "InkOS Studio" |
| P2 | `narrative_rhythm` Agent 化 | 当前仅支持手动编辑，无自动生成 Agent |
| P2 | 英语 prompt 全面调优 | 部分新增 Agent 的英文 prompt 为直译，需润色 |
| P3 | 互动小说 | 原路线图功能，优先级降低 |
| P3 | 局部干预（半章重写 + 级联更新） | 原路线图功能 |

---

## 七、关键指标

| 指标 | 数值 |
|---|---|
| TypeScript/TSX 源文件 | ~501 |
| 测试文件 | 159 |
| 新增文学 Agent | 4 |
| 新增文学真相文件 Schema | 6 |
| 文学审计维度 | 10 |
| 严肃文学体裁 | 8 |
| 删除网文体裁 | 12 |
| 删除功能模块 | 6（daemon/fanfic/radar/eval/draft/genre cmd）|
| Studio 页面重构 | 3 删 + 3 新增 |
| CLI 新增命令 | 4 |

---

## 八、风险与阻断

1. **测试覆盖率下降风险**：大量文件删除 + 新增，部分旧测试可能已过时，需要补充新 Agent 的单元测试
2. **品牌替换不彻底**：工作流、文档、部分 UI 文案仍有 InkOS 残留
3. **Node 版本要求**：SQLite 内存数据库要求 Node 22+，需确认目标用户环境
