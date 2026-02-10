# AgentBrowser 详细开发计划

> 版本: v0.9.0 -> v1.0.0
> 规划日期: 2026-02-03
> 周期: Q1-Q2 2026

---

## 项目进度评估总结

### 代码规模统计

| 组件 | 文件数 | 代码行数 | 完成度 |
|------|--------|----------|--------|
| TypeScript 核心 (src/) | 10 | 10,873 | 95% |
| Rust CLI (cli/src/) | 7 | 6,244 | 95% |
| Chrome Extension | 7+ | ~1,000 | 70% |
| **总计** | **24+** | **~18,000** | **90%** |

### 测试覆盖现状

| 测试文件 | 代码行数 | 覆盖模块 | 评估 |
|----------|----------|----------|------|
| `protocol.test.ts` | 1,076 | 命令验证 | 优秀 |
| `browser.test.ts` | 664 | 浏览器操作 | 良好 |
| `ios-manager.test.ts` | 157 | iOS 支持 | 基础 |
| `daemon.test.ts` | 96 | 守护进程 | 基础 |
| `actions.test.ts` | **39** | 动作处理 | **严重不足** |
| `launch-options.test.ts` | 159 | 启动配置 | 良好 |
| `serverless.test.ts` | ~50 | Serverless | 基础 |

**测试覆盖率估算**: ~30% (按功能覆盖)

### 关键发现

```
+------------------------------------------------------------------+
|                        项目健康度评估                              |
+------------------------------------------------------------------+
| [OK] 核心功能完整 - 100+ 命令全部实现                              |
| [OK] 类型安全 - Zod 验证覆盖所有命令                               |
| [OK] CI/CD 完善 - 多平台构建 + 自动发布                            |
| [OK] 文档完整 - README 870 行 + 技能文档                          |
+------------------------------------------------------------------+
| [!!] actions.ts 测试严重不足 (39行测试 / 2043行代码)               |
| [!!] stream-server.ts 无测试覆盖                                  |
| [!!] Chrome Extension 无测试                                      |
| [--] 大文件需重构 (commands.rs 2438行, actions.ts 2043行)         |
+------------------------------------------------------------------+
```

---

## 详细开发计划

### Phase 1: 测试补全 (Week 1-4)

#### 1.1 actions.ts 测试 [P0 - 关键]

**当前状态**: 39 行测试 / 2,043 行代码 (1.9% 覆盖率)
**目标**: 达到 70%+ 功能覆盖率

| 任务 | 测试项 | 优先级 | 预计工作量 |
|------|--------|--------|------------|
| 1.1.1 | Navigation actions (navigate, back, forward, reload) | P0 | 0.5 天 |
| 1.1.2 | Click actions (click, dblclick, hover) | P0 | 0.5 天 |
| 1.1.3 | Input actions (fill, type, press, select) | P0 | 1 天 |
| 1.1.4 | Get actions (get text, get html, get value, get attr) | P1 | 0.5 天 |
| 1.1.5 | State checks (is visible, is enabled, is checked) | P1 | 0.5 天 |
| 1.1.6 | Scroll actions (scroll, scrollIntoView, mouse wheel) | P1 | 0.5 天 |
| 1.1.7 | Tab operations (tab new, tab switch, tab close) | P1 | 0.5 天 |
| 1.1.8 | Cookie/Storage operations | P2 | 0.5 天 |
| 1.1.9 | Screenshot/PDF generation | P2 | 0.5 天 |
| 1.1.10 | Error handling edge cases | P1 | 1 天 |

**测试文件结构**:
```
src/
├── actions.test.ts              # 现有 (需扩展)
├── actions/
│   ├── navigation.test.ts       # 导航测试
│   ├── interaction.test.ts      # 交互测试
│   ├── data.test.ts             # 数据获取测试
│   └── state.test.ts            # 状态检查测试
```

**示例测试用例**:
```typescript
// src/actions/navigation.test.ts
describe('Navigation Actions', () => {
  describe('navigate', () => {
    it('should navigate to valid URL', async () => { ... });
    it('should handle navigation timeout', async () => { ... });
    it('should apply custom headers', async () => { ... });
    it('should handle waitUntil options', async () => { ... });
    it('should reject invalid URLs', async () => { ... });
  });

  describe('back/forward', () => {
    it('should go back in history', async () => { ... });
    it('should go forward in history', async () => { ... });
    it('should handle empty history gracefully', async () => { ... });
  });
});
```

#### 1.2 stream-server.ts 测试 [P1]

**当前状态**: 0 行测试 / 382 行代码
**目标**: WebSocket 功能完整测试

| 任务 | 测试项 | 预计工作量 |
|------|--------|------------|
| 1.2.1 | WebSocket 连接建立/断开 | 0.5 天 |
| 1.2.2 | Screencast 帧传输 | 0.5 天 |
| 1.2.3 | 输入事件注入 (鼠标/键盘/触摸) | 1 天 |
| 1.2.4 | 多客户端连接处理 | 0.5 天 |
| 1.2.5 | 错误处理和重连逻辑 | 0.5 天 |

**新建测试文件**: `src/stream-server.test.ts`

#### 1.3 Chrome Extension 测试 [P1]

**当前状态**: 0 测试
**目标**: 核心功能测试覆盖

| 任务 | 测试项 | 预计工作量 |
|------|--------|------------|
| 1.3.1 | background.js - Service Worker 生命周期 | 0.5 天 |
| 1.3.2 | content.js - DOM 快照生成 | 1 天 |
| 1.3.3 | mcp-server.js - MCP 协议合规性 | 1 天 |
| 1.3.4 | Native Messaging 通信 | 0.5 天 |

**测试框架**: Jest + Chrome Extension Testing Library

**新建测试文件**:
```
extension/
├── __tests__/
│   ├── background.test.js
│   ├── content.test.js
│   ├── mcp-server.test.js
│   └── native-host.test.js
```

#### 1.4 E2E 测试 [P2]

**当前状态**: 有限的集成测试
**目标**: CLI 端到端测试

| 任务 | 测试项 | 预计工作量 |
|------|--------|------------|
| 1.4.1 | CLI 基本命令流程 | 1 天 |
| 1.4.2 | Session 管理 | 0.5 天 |
| 1.4.3 | Profile 持久化 | 0.5 天 |
| 1.4.4 | 多标签页场景 | 0.5 天 |

**新建测试目录**: `test/e2e/`

---

### Phase 2: 功能完善 (Week 5-8)

#### 2.1 Chrome Extension 完善 [P0]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 2.1.1 | 完善 Snapshot 实现 - 匹配核心 snapshot.ts 质量 | 2 天 |
| 2.1.2 | 中文注释翻译为英文 | 0.5 天 |
| 2.1.3 | 安装文档编写 | 0.5 天 |
| 2.1.4 | Chrome Web Store 发布准备 | 1 天 |

#### 2.2 Shadow DOM 支持 [P1]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 2.2.1 | snapshot.ts - Shadow DOM 遍历 | 1.5 天 |
| 2.2.2 | actions.ts - Shadow DOM 元素定位 | 1 天 |
| 2.2.3 | 测试用例补充 | 0.5 天 |

#### 2.3 批量命令 (Batch Commands) [P1]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 2.3.1 | 协议定义 - types.ts + protocol.ts | 0.5 天 |
| 2.3.2 | Daemon 处理 - daemon.ts | 1 天 |
| 2.3.3 | CLI 支持 - commands.rs | 1 天 |
| 2.3.4 | 错误聚合和回滚策略 | 1 天 |

#### 2.4 高级等待条件 [P2]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 2.4.1 | waitForFunction 支持 | 1 天 |
| 2.4.2 | waitForResponse 增强 | 0.5 天 |
| 2.4.3 | 自定义超时策略 | 0.5 天 |

---

### Phase 3: 代码质量 (Week 9-10)

#### 3.1 大文件重构 [P2]

| 文件 | 当前行数 | 重构方案 | 预计工作量 |
|------|----------|----------|------------|
| `cli/src/commands.rs` | 2,438 | 按命令类别拆分为模块 | 2 天 |
| `src/actions.ts` | 2,043 | 按功能拆分 (navigation, interaction, data) | 2 天 |
| `src/browser.ts` | 1,877 | 提取 screencast, input injection 模块 | 1.5 天 |
| `cli/src/output.rs` | 1,812 | 按命令组拆分帮助文本 | 1 天 |

**重构后结构**:
```
src/
├── actions/
│   ├── index.ts          # 主入口
│   ├── navigation.ts     # 导航类动作
│   ├── interaction.ts    # 交互类动作
│   ├── data.ts           # 数据获取类动作
│   ├── state.ts          # 状态检查类动作
│   └── storage.ts        # 存储操作类动作
├── browser/
│   ├── index.ts          # 主入口
│   ├── screencast.ts     # 屏幕录制模块
│   └── input.ts          # 输入注入模块
```

#### 3.2 类型安全增强 [P2]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 3.2.1 | Extension 文件转 TypeScript | 2 天 |
| 3.2.2 | 严格模式检查修复 | 1 天 |
| 3.2.3 | 类型导出优化 | 0.5 天 |

#### 3.3 文档补全 [P3]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 3.3.1 | CONTRIBUTING.md | 0.5 天 |
| 3.3.2 | API 文档生成 (TypeDoc) | 1 天 |
| 3.3.3 | 架构图 (Mermaid) | 0.5 天 |

---

### Phase 4: 商业化准备 (Week 11-12)

#### 4.1 云服务架构设计 [P1]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 4.1.1 | 服务端 API 设计 | 2 天 |
| 4.1.2 | Session 持久化方案 | 1.5 天 |
| 4.1.3 | 多租户隔离设计 | 1.5 天 |
| 4.1.4 | 计费模块设计 | 1 天 |

#### 4.2 官网与文档站 [P2]

| 任务 | 描述 | 预计工作量 |
|------|------|------------|
| 4.2.1 | 落地页设计 | 2 天 |
| 4.2.2 | 文档站搭建 (Docusaurus/VitePress) | 2 天 |
| 4.2.3 | 示例 Gallery | 1 天 |

---

## 测试策略详细说明

### 测试金字塔

```
                    +--------+
                   /   E2E    \        ~10% - CLI 集成测试
                  /   Tests    \
                 +--------------+
                /   Integration  \      ~30% - 组件集成测试
               /      Tests       \
              +--------------------+
             /      Unit Tests      \    ~60% - 单元测试
            +------------------------+
```

### 单元测试规范

**命名约定**:
```typescript
describe('ModuleName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**覆盖率目标**:
| 模块 | 当前 | 目标 |
|------|------|------|
| protocol.ts | 90%+ | 95% |
| browser.ts | 60% | 80% |
| actions.ts | <5% | **70%** |
| snapshot.ts | 50% | 80% |
| stream-server.ts | 0% | **60%** |
| daemon.ts | 30% | 60% |

### 集成测试场景

| 场景 | 测试内容 | 验证点 |
|------|----------|--------|
| 登录流程 | navigate -> fill -> click -> wait | Cookie 设置正确 |
| 表单提交 | snapshot -> fill 多个字段 -> submit | 表单数据提交 |
| 多标签页 | tab new -> navigate -> tab switch | Tab 状态隔离 |
| 文件上传 | upload -> wait -> get attr | 文件上传成功 |
| 截图 | navigate -> screenshot | 图片生成正确 |

### E2E 测试框架

```bash
# 测试目录结构
test/
├── e2e/
│   ├── cli.test.ts           # CLI 命令测试
│   ├── session.test.ts       # Session 管理测试
│   ├── profile.test.ts       # Profile 持久化测试
│   └── fixtures/
│       └── test-pages/       # 测试用 HTML 页面
├── integration/
│   ├── browserbase.test.ts   # Browserbase 集成
│   └── kernel.test.ts        # Kernel 集成
└── setup.ts                  # 全局测试配置
```

### CI/CD 测试流程

```yaml
# .github/workflows/ci.yml 扩展
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - run: npx playwright install chromium
      - run: pnpm test:e2e

  coverage-report:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4
```

---

## 里程碑与时间线

```
2026 Q1-Q2 开发计划时间线

Week 1-4: Phase 1 - 测试补全
├── Week 1: actions.ts 核心测试 (navigation, click, input)
├── Week 2: actions.ts 扩展测试 (get, state, scroll)
├── Week 3: stream-server.ts + Extension 测试
└── Week 4: E2E 测试框架搭建

Week 5-8: Phase 2 - 功能完善
├── Week 5: Chrome Extension 完善
├── Week 6: Shadow DOM 支持
├── Week 7: 批量命令实现
└── Week 8: 高级等待条件

Week 9-10: Phase 3 - 代码质量
├── Week 9: 大文件重构 (actions.ts, commands.rs)
└── Week 10: 类型安全 + 文档

Week 11-12: Phase 4 - 商业化准备
├── Week 11: 云服务架构设计
└── Week 12: 官网与文档站

关键里程碑:
[M1] Week 4  - 测试覆盖率 > 50%
[M2] Week 8  - v1.0.0-beta 发布
[M3] Week 10 - 代码重构完成
[M4] Week 12 - v1.0.0 正式发布 + 云服务 Alpha
```

---

## 资源需求

### 人力配置

| 角色 | 人数 | 职责 |
|------|------|------|
| 后端开发 | 1-2 | 核心功能 + 测试 |
| 前端开发 | 1 | Chrome Extension + 官网 |
| DevOps | 0.5 | CI/CD + 云服务基础设施 |

### 工具与服务

| 工具 | 用途 | 预算 |
|------|------|------|
| Codecov | 测试覆盖率报告 | 免费 (开源) |
| BrowserStack | 跨浏览器测试 | ~$39/月 |
| Vercel | 官网托管 | 免费层 |
| Cloudflare | CDN + DNS | 免费层 |

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 测试补全延期 | 中 | 高 | 优先核心路径，降低覆盖率目标 |
| Extension 审核被拒 | 中 | 中 | 提前研究 Chrome Web Store 政策 |
| 重构引入 Bug | 中 | 高 | 先补全测试，再重构 |
| 人力不足 | 高 | 高 | 聚焦核心功能，延后 P3 任务 |

---

## 附录: 关键文件路径

### 需要测试的核心文件

| 文件 | 行数 | 当前测试 | 优先级 |
|------|------|----------|--------|
| `/home/user/AgentBrowser/src/actions.ts` | 2,043 | 39 行 | P0 |
| `/home/user/AgentBrowser/src/stream-server.ts` | 382 | 0 | P1 |
| `/home/user/AgentBrowser/extension/content.js` | ~313 | 0 | P1 |
| `/home/user/AgentBrowser/extension/mcp-server.js` | ~427 | 0 | P1 |

### 需要重构的大文件

| 文件 | 行数 | 重构方向 |
|------|------|----------|
| `/home/user/AgentBrowser/cli/src/commands.rs` | 2,438 | 模块化拆分 |
| `/home/user/AgentBrowser/src/actions.ts` | 2,043 | 按功能拆分 |
| `/home/user/AgentBrowser/src/browser.ts` | 1,877 | 提取子模块 |
| `/home/user/AgentBrowser/cli/src/output.rs` | 1,812 | 按命令组拆分 |
