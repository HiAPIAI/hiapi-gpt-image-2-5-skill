![HiAPI GPT Image 2.5](assets/social-preview-gpt-image-2-5.png)

# GPT Image 2.5 Agent Skill：HiAPI 图像生成与编辑技能

通过 HiAPI 从 Codex 或 Claude Code 使用 GPT Image 2.5 Flare 或 Sunburst 生成商品图、海报封面、透明素材或编辑参考图。默认按输入自动选择按分辨率计价的模式模型：没有参考图用 `gpt-image-2.5-flare/text-to-image`，有参考图用 `gpt-image-2.5-flare/image-to-image`；`--family sunburst` 切换到 Sunburst 对应模型。`--route pro` 选择按质量计价的 `gpt-image-2.5-flare@pro` / `gpt-image-2.5-sunburst@pro`。不直接请求裸 ID `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`。

已发布的技能包。可使用 Agent Skills CLI 安装；客户端运行和付费任务验收仍需单独核实。

[English](README.md) · [中文](README.zh-CN.md) · [Flare 文生图](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-text-to-image/) · [Flare 图生图](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare-image-to-image/) · [Sunburst 文生图](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-text-to-image/) · [Sunburst 图生图](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst-image-to-image/) · [Flare 质量档](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare/) · [Sunburst 质量档](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst/) · [获取 API 密钥](https://www.hiapi.ai/zh/dashboard/api-keys) · [价格](https://www.hiapi.ai/zh/pricing) · [安装](#安装)

## 可用场景

| 场景 | 用法 | 契约要点 |
| --- | --- | --- |
| 商品图 | 从提示词创建商品场景 | 文生图；省略 `--image-url` |
| 海报或封面 | 为宣传素材选择比例和 1K/2K/4K 输出 | 每任务一张；`--aspect-ratio`、`--resolution` |
| 参考编辑 | 在保留原图的前提下修改指定元素 | 图生图；传入 1–16 个可访问 URL 或 data URI |
| 透明素材 | 请求抠出的主体或透明图形 | `--background transparent`，仅限 1K |

## 模型路线

| 路线 | 模型 ID | 何时选用 | 计价依据 | 参数 |
| --- | --- | --- | --- | --- |
| 模式（默认） | `gpt-image-2.5-flare/text-to-image`、`gpt-image-2.5-flare/image-to-image`、`gpt-image-2.5-sunburst/text-to-image`、`gpt-image-2.5-sunburst/image-to-image` | 省略 `--model`；按是否传 `--image-url` 选模式；`--family` 默认 `flare` | 按 `resolution`（1K/2K/4K）每张计价 | 提示词 ≤ 8,000 字符，13 种比例（默认 `auto`），`resolution`（默认 `1K`），可选 `background`（仅 1K） |
| Pro（需明确指定） | `gpt-image-2.5-flare@pro`、`gpt-image-2.5-sunburst@pro` | `--route pro`（配合 `--family`），或 `--model` 写明这两个 ID 之一 | 按 `quality` 每张计价 | 提示词 ≤ 8,000 字符，比例或像素尺寸，6 个质量值，背景，PNG/JPEG/WebP 输出 |

每个已接受的异步任务返回一张图片。模式路线传 `--quality`/`--output-format`、pro 路线传 `--resolution` 都会直接报错，不会静默丢弃。技能不对两条路线或 Flare/Sunburst 作未经验证的质量、速度或视觉排名。

六个模型 ID 的提示词上限统一为 8,000 字符。CLI 先去除首尾空白，再按 JavaScript `string.length` 计算 UTF-16 码元：常用汉字计 1，补充平面 emoji 计 2。超过上限会在提交任务前被拒绝。下方示例的提示词均需遵守此上限。

## 安装

要求 Node.js 18+。本地 checkout 安装到显式指定的空目标目录：

```bash
node scripts/install.mjs --target /tmp/hiapi-gpt-image-2-5-skill
```

推荐的 Agent Skills CLI 安装命令：

```bash
npx skills add HiAPIAI/hiapi-gpt-image-2-5-skill --skill hiapi-gpt-image-2-5
```

随包 installer 也支持 `--codex`、`--claude` 和显式 `--target`；客户端运行验收单独记录。

只有创建或恢复任务需要 `HIAPI_API_KEY`。不要把 key 放进 shell 历史或日志。`HIAPI_BASE_URL` 可在受控环境覆盖 API 地址，`HIAPI_SITE_URL` 可覆盖估价和契约检查站点。

先做不扣费预检；`--estimate` 读取当前公开 `/api/pricing` 快照，也不会创建任务：

```bash
node scripts/hiapi-gpt-image-2-5.mjs \
  --prompt "清晨安静的高山湖泊" \
  --aspect-ratio 16:9 --resolution 2K --dry-run --estimate
```

文生图只提交一次（默认 `gpt-image-2.5-flare/text-to-image`），并固定幂等键：

```bash
export HIAPI_API_KEY='...'
node scripts/hiapi-gpt-image-2-5.mjs \
  --prompt "清晨安静的高山湖泊" --resolution 2K \
  --idempotency-key gpt25-demo-001
```

图生图选择 Sunburst，并重复 `--image-url`（1–16 个可访问的 HTTP(S) URL 或 `data:image/...;base64,` URI），CLI 会选用 `gpt-image-2.5-sunburst/image-to-image`：

```bash
node scripts/hiapi-gpt-image-2-5.mjs --family sunburst \
  --prompt "只把天空改成温暖的日落；保留主体和构图。" \
  --image-url "https://example.com/reference.webp" \
  --aspect-ratio 1:1 --resolution 1K \
  --idempotency-key gpt25-edit-001
```

质量档走 pro 路线：

```bash
node scripts/hiapi-gpt-image-2-5.mjs --route pro --family sunburst \
  --prompt "清晨安静的高山湖泊" --quality high --output-format webp \
  --dry-run --estimate
```

CLI 不上传本地路径；本地文件需先提供可访问的 HTTP(S) URL，模式路线也可传 data URI。`--no-wait` 在提交后立即返回 task ID；已有任务用 `--resume-task-id` 恢复，不会再次创建：

```bash
node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id "tk-hiapi-REPLACE_WITH_YOUR_TASK_ID"
node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id "tk-hiapi-REPLACE_WITH_YOUR_TASK_ID" --no-save
```

本地验证：`npm test`、`npm run check:contract`。完整字段见 [references/api.md](references/api.md)，交付与验收见 [references/workflow.md](references/workflow.md)，安装说明见 [llms-install.md](llms-install.md)。

## 常见问题

**GPT Image 2.5 与 GPT Image 2 有什么关系？** 本技能只处理上表列出的 6 个 GPT Image 2.5 Flare/Sunburst 模型 ID。GPT Image 2 及其他图像模型不在本技能触发范围内，应分别查看当前模型文档。

**2.5 模型怎么选？** 省略 `--model`：CLI 按是否传参考图，使用 Flare 的文生图或图生图模型。要求 Sunburst 时加 `--family sunburst`；需要质量档或指定 PNG/JPEG/WebP 输出时，用 `--route pro`（`gpt-image-2.5-flare@pro` / `gpt-image-2.5-sunburst@pro`）。技能不对它们作未经验证的质量、速度或视觉排名。

**这是 API 还是 Skill？** HiAPI 提供异步 API 和模型契约；本仓库将校验、估价、幂等、轮询、恢复和下载封装成可重复的 Agent Skills 工作流。

**需要 key 吗，价格怎么算？** 创建和恢复任务需要 `HIAPI_API_KEY`，本地校验和 dry-run 不需要。使用 `--estimate` 读取当前 `/api/pricing` 快照；估价不是账单保证，最终以已接受任务的当前价格为准。

**透明背景怎么用？** 默认模式路线：设置 `--background transparent` 且 `--resolution 1K`（只有 1K 接受 `background`），返回带 alpha 的 PNG。pro 路线：设置 `--background transparent` 并选择 `--output-format png` 或 `webp`；JPEG 不支持透明度。

**没有 key 能安装或恢复吗？** 安装和 dry-run 是本地操作。恢复需要 key 和已有 task ID，但不会创建新任务；提交超时或使用 `--no-wait` 后，用 `--resume-task-id` 恢复。

**能直接传本地图片吗？** CLI 不上传本地路径。默认模式路线可传 `data:image/png|jpeg|webp;base64,` URI；否则请先让源图具备可访问的 HTTP(S) URL，再重复传入 `--image-url`。不要为了可访问而公开私有媒体。
