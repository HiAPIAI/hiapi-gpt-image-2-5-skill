![HiAPI GPT Image 2.5](assets/social-preview-gpt-image-2-5.png)

# GPT Image 2.5 Agent Skill：HiAPI 图像生成与编辑技能

通过 HiAPI 从 Codex 或 Claude Code 生成商品图、海报封面、透明素材或编辑参考图，使用准确的模型 ID `gpt-image-2.5-flare` 与 `gpt-image-2.5-sunburst`；默认使用 Flare，Sunburst 需明确选择。

已发布的技能包。可使用 Agent Skills CLI 安装；客户端运行和付费任务验收仍需单独核实。

[English](README.md) · [中文](README.zh-CN.md) · [Flare 文档](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-flare/) · [Sunburst 文档](https://www.hiapi.ai/docs/models/image/gpt-image-2-5-sunburst/) · [获取 API 密钥](https://www.hiapi.ai/zh/dashboard/api-keys) · [价格](https://www.hiapi.ai/zh/pricing) · [安装](#安装)

## 可用场景

| 场景 | 用法 | 契约要点 |
| --- | --- | --- |
| 商品图 | 从提示词创建商品场景 | 文生图；省略 `image_urls` |
| 海报或封面 | 为宣传素材选择支持的比例或像素尺寸 | 每任务一张；显式选择 `aspect_ratio` |
| 参考编辑 | 在保留原图的前提下修改指定元素 | 图生图；传入 1–16 个可访问 URL |
| 透明素材 | 请求抠出的主体或透明图形 | `background: transparent` 配合 `png` 或 `webp` |

功能遵循公开 schema：最多 32,000 字符提示词、1–16 个公开 HTTP(S) 参考图 URL、支持的比例/像素尺寸、6 个质量值、3 个背景值，以及 PNG/JPEG/WebP 输出。每个已接受的异步任务返回一张图片。

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
  --model gpt-image-2.5-flare --prompt "清晨安静的高山湖泊" \
  --aspect-ratio 16:9 --quality medium --background auto \
  --output-format webp --dry-run --estimate
```

文生图只提交一次，并固定幂等键：

```bash
export HIAPI_API_KEY='...'
node scripts/hiapi-gpt-image-2-5.mjs \
  --model gpt-image-2.5-flare --prompt "清晨安静的高山湖泊" \
  --idempotency-key gpt25-demo-001
```

图生图明确选择 Sunburst，并重复 `--image-url`（1–16 个可访问的 HTTP(S) URL）：

```bash
node scripts/hiapi-gpt-image-2-5.mjs \
  --model gpt-image-2.5-sunburst \
  --prompt "只把天空改成温暖的日落；保留主体和构图。" \
  --image-url "https://example.com/reference.webp" \
  --aspect-ratio 1:1 --quality high --output-format webp \
  --idempotency-key gpt25-edit-001
```

CLI 不上传本地路径；本地文件需先提供可访问的 HTTP(S) URL。`--no-wait` 在提交后立即返回 task ID；已有任务用 `--resume-task-id` 恢复，不会再次创建：

```bash
node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id "tk-hiapi-REPLACE_WITH_YOUR_TASK_ID"
node scripts/hiapi-gpt-image-2-5.mjs --resume-task-id "tk-hiapi-REPLACE_WITH_YOUR_TASK_ID" --no-save
```

本地验证：`npm test`、`npm run check:contract`。完整字段见 [references/api.md](references/api.md)，交付与验收见 [references/workflow.md](references/workflow.md)，安装说明见 [llms-install.md](llms-install.md)。

## 常见问题

**GPT Image 2.5 与 GPT Image 2 有什么关系？** 本技能只处理 `gpt-image-2.5-flare` 和 `gpt-image-2.5-sunburst`。GPT Image 2 及其他图像模型不在本技能触发范围内，应分别查看当前模型文档。

**两个 2.5 型号怎么选？** 未指定时使用 Flare；调用方明确要求时选择 Sunburst。技能不对两者作未经验证的质量、速度或视觉排名。

**这是 API 还是 Skill？** HiAPI 提供异步 API 和模型契约；本仓库将校验、估价、幂等、轮询、恢复和下载封装成可重复的 Agent Skills 工作流。

**需要 key 吗，价格怎么算？** 创建和恢复任务需要 `HIAPI_API_KEY`，本地校验和 dry-run 不需要。使用 `--estimate` 读取当前 `/api/pricing` 快照；估价不是账单保证，最终以已接受任务的当前价格为准。

**透明背景怎么用？** 设置 `--background transparent`，并选择 `--output-format png` 或 `webp`；JPEG 不支持透明度。

**没有 key 能安装或恢复吗？** 安装和 dry-run 是本地操作。恢复需要 key 和已有 task ID，但不会创建新任务；提交超时或使用 `--no-wait` 后，用 `--resume-task-id` 恢复。

**能直接传本地图片吗？** CLI 不上传本地路径。请先让源图具备可访问的 HTTP(S) URL，再重复传入 `--image-url`；也可使用带可访问 URL 的 direct API。不要为了可访问而公开私有媒体。
