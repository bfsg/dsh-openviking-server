# dsh-openviking-server

DeepSeek Harness(DSH)记忆系统 —— OpenViking 服务端 + DSH 插件的**离线部署资产包**。

在 DSH 桌面版上启用跨会话长期记忆:OpenViking 服务端(`openviking-server`)+ `@openviking/dsh-memory-plugin` 捕获/召回 + 可选 `dsh-plugin-ov-server` 让服务随 DSH 一起启动。

本仓库只收集**现成可用、无敏感信息**的部署资产,供内网/离线环境复用(已去除 API Key,配置均为模板)。

## 目录结构

```
├── README.md                        # 本文件
├── docs/
│   ├── deploy-guide.md              # 通用部署指南(安装/配置/验证)
│   └── huawei-intranet.md           # 华为内网部署清单(无公网环境)
├── plugins/
│   └── dsh-plugin-ov-server/        # [自研] 随 DSH 启动 openviking-server 的宿主插件
├── vendor/
│   └── dsh-memory-plugin/           # [官方] @openviking/dsh-memory-plugin v0.3.0 打包副本
├── offline/
│   ├── install-offline.ps1          # Windows 离线一键安装脚本
│   └── README.md                    # 离线安装说明
├── config/
│   ├── ov.conf.example              # openviking-server 配置模板(占位 Key)
│   └── ovcli.conf.example           # ov CLI 配置模板
└── scripts/                         # 一键安装脚本(可选)
```

> **内网无 PyPI?** openviking 本体离线包在仓库 [Releases](https://github.com/bfsg/dsh-openviking-server/releases)
> (`ov-wheels-0.4.17.1-win-amd64.zip`,163 wheel,离线 `pip install --no-index --find-links` 即装)。
> 详细见 `offline/README.md`。

## 快速开始(有网机器,30 秒看效果)

```bash
# 1. 安装 openviking(服务端 + CLI)
uv tool install openviking

# 2. 写配置(复制模板并填 endpoint/key)
cp config/ov.conf.example ~/.openviking/ov.conf
cp config/ovcli.conf.example ~/.openviking/ovcli.conf

# 3. 校验并启动
openviking-server doctor
openviking-server            # 监听 127.0.0.1:1933

# 4. DSH 侧激活插件
dsh plugin --profile web add vendor/dsh-memory-plugin
#    或在 cordis.patch.yml 装配 plugins/dsh-plugin-ov-server(见其 README)
```

## 组件说明

| 组件 | 来源 | 作用 |
| --- | --- | --- |
| `openviking` v0.4.17.1 | PyPI([volcengine/OpenViking](https://github.com/volcengine/OpenViking)) | 记忆/资源/技能的服务端与 CLI |
| `@openviking/dsh-memory-plugin` v0.3.0 | npm, Apache-2.0 | DSH 会话自动捕获 + 召回 + OpenViking MCP 工具面 |
| `dsh-plugin-ov-server` v0.1.0 | 本仓库自研 | DSH 启动时自动拉起 openviking-server |

## 关键注意

- **embedding/VLM 模型**:服务端必须能调用 embedding;本地模式需 `bge-small-zh-v1.5-f16.gguf` + `llama-cpp-python`(Windows 无官方 wheel,建议 Linux 或指内网 OpenAI 兼容模型服务)。见 `docs/deploy-guide.md`。
- **隐私**:本仓库不含任何真实 Key 与会话内容。
- 服务端 `auth_mode: dev` 仅适合单机本地;共享环境请配置 API Key / trusted 模式。

## 参考

- OpenViking 文档:https://docs.openviking.ai
- DSH 记忆插件仓库:https://github.com/volcengine/OpenViking/tree/main/examples/dsh-memory-plugin
