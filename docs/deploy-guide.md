# OpenViking + DSH 记忆系统 · 通用部署指南

适用:DeepSeek Harness(DSH Desktop)+ OpenViking 长期记忆。内容来自 2026-09 实际部署经验。

## 架构

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  DSH Desktop (每台机器)      │        │  OpenViking server (本地/共享) │
│  ├ dsh-memory-plugin        │  HTTP  │  ├ openviking-server :1933    │
│  │   (捕获/召回/MCP工具)     │◄──────►│  ├ embedding (必配)           │
│  └ dsh-plugin-ov-server     │        │  ├ vlm (可选,开记忆抽取)      │
│     (随 DSH 拉起服务,可选)    │        │  └ 数据: ~/.openviking/data   │
└─────────────────────────────┘        └──────────────────────────────┘
```

## 1. 安装 openviking

要求:Python 3.10–3.13(勿用 3.14,火山 SDK 有告警)、Node.js ≥22(DSH 侧)。

```bash
# 方式 A:uv(推荐)
uv tool install openviking            # 提供 openviking / openviking-server / ov / vikingbot

# 方式 B:pip
pip install openviking
```

安装后确认可执行文件在 PATH:`~/.local/bin`(uv)或 Scripts 目录(pip),必要时加 PATH。

> Windows 注意:本地 embedding 需 `llama-cpp-python`,PyPI 无官方 Windows wheel(只能源码编译)。
> **推荐:改用 OpenAI 兼容 embedding 服务(见 §3),可完全绕开。**

## 2. 配置文件

```bash
mkdir -p ~/.openviking
# 服务端配置(复制仓库 config/ov.conf.example)
# CLI 配置(复制 config/ovcli.conf.example)
```

`ov.conf` 顶层结构:`embedding` / `vlm`(可选)/ `storage` / `server` / `ingest`(可选)。
本仓库模板已含占位 Key,填写后:

```bash
openviking-server doctor     # 逐项校验:Config/Python/Embedding/Auth/Disk
openviking-server            # 默认 127.0.0.1:1933
curl http://127.0.0.1:1933/health   # {"status":"ok",...}
```

首次使用 CLI 先设语言:`ov language zh-CN`(或 en)。

## 3. 模型配置(关键决策)

### A. OpenAI 兼容模型服务(推荐,含内网自建)
```json
"embedding": { "dense": {
  "provider": "openai",
  "api_base": "https://<endpoint>/v1",
  "api_key": "<key>",
  "model": "<embedding model>",
  "dimension": <按模型对齐,如 1024>
}}
"vlm": { "provider": "openai", "api_base": "...", "api_key": "...",
         "model": "<llm/vlm>", "thinking": false }
```
配了 vlm 才启用会话 commit 后的**长期记忆抽取**;不配则只存不抽。

### B. 纯本地(零 API,离线)
- 需 `llama-cpp-python` + GGUF 模型 `bge-small-zh-v1.5-f16.gguf`(512 维)
- 模型文件放 `~/.cache/openviking/models/`
- Linux:`pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu`
- **仍建议配一个 vlm** 用于记忆抽取(否则 recall 只有原始会话,无抽取记忆)

## 4. DSH 侧插件

```bash
dsh plugin --profile web add <vendor/dsh-memory-plugin 路径或 tarball>
dsh --profile web --dump-config   # 应看到 openviking-memory 组
```

- 插件通过 **bundle 机制**激活(自带 cordis.patch.yml,id `openviking-memory`);
  不要再在 profile 的 cordis.patch.yml 手写同 id 的 insert,会冲突。
- 可选:装配 `dsh-plugin-ov-server` 让服务随 DSH 启动(见 plugins/dsh-plugin-ov-server/README.md)。

## 5. 验证

```bash
curl http://127.0.0.1:1933/health
openviking-server doctor
ov observer system            # embedding 队列 healthy
ov ls viking://user/default/resources
```

DSH 端:开新会话,开头应有 OpenViking 上下文注入,工具里有 `mcp__openviking__*`;
问一句更早会话聊过的事,确认跨会话召回。若没有:`OV_DEBUG_LOG=/tmp/ov-dsh.log` 看插件日志。

## 6. 常见问题

| 现象 | 排查 |
| --- | --- |
| 无注入无工具 | `dsh --profile web --dump-config` 看是否有 openviking-memory;重装插件 |
| doctor Embedding FAIL(local) | 缺 llama-cpp-python 或模型文件;或改配 OpenAI 兼容服务 |
| 401/403 | 服务端非 dev 模式:配 `OPENVIKING_API_KEY` / `OPENVIKING_ACCOUNT` / `OPENVIKING_USER` |
| 串入其他项目记忆 | 设 `OPENVIKING_RECALL_PEER_SCOPE=actor` |
| 崩溃后没 commit | 写入排队到 `~/.openviking/pending`,下次会话开始自动重放(每次 ≤50 条) |
| 记忆抽取不生效 | vlm 未配置;或重启服务端使配置生效 |
