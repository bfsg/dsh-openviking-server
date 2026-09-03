# 华为内网部署清单

目标:在**无公网/受限网络**的内网机器上,把 OpenViking + DSH 记忆系统跑起来。
前提假设(按需调整):内网可访问 GitHub;模型来自**内网自建 OpenAI 兼容服务**(embedding + LLM);单机自用。

## 一、内网特殊点总览

本系统对外部依赖共 4 处,内网全部要有替代物:

| 外部依赖(公网) | 内网替代 |
| --- | --- |
| openviking 安装(PyPI) | 离线 wheel / 内网 pip 源 / GitHub Release 产物 |
| embedding/VLM API(如 DashScope) | **内网 OpenAI 兼容模型服务**(本项目前提) |
| `@openviking/dsh-memory-plugin`(npm) | 本仓库 `vendor/dsh-memory-plugin/` 直接可用 |
| huggingface 模型下载(仅本地 embedding 用) | 走内网模型服务则完全不需要 |

## 二、准备清单

### 机器
- Linux x86_64(openEuler/Kylin 亦可)或 Windows;单机自用 2C4G 起步,多人共享建议 4C8G+
- Python 3.10–3.13(不要 3.14)
- 独立数据盘(向量库 + 工作区持续增长),记好挂载路径
- 放行 TCP 1933(仅本机则 127.0.0.1 即可)

### 制品(提前下载打包,拷入内网)
1. openviking 安装包 + 全量依赖(能出公网的机器 `pip download -r` 或 uv 离线)
2. 本仓库整体 clone/下载(`vendor/` 已含官方插件副本,离线可用)
3. DSH Desktop 安装包 + `@deepseek-ai/dsh-*` peer 依赖(离线 pnpm store)
4. (如走本地 embedding)GGUF 模型 + llama-cpp-python wheel(Linux 官方 wheel 可从 abetlen.github.io 拿)

### 配置
```bash
mkdir -p ~/.openviking
cp config/ov.conf.example ~/.openviking/ov.conf    # 填内网模型 endpoint/key
cp config/ovcli.conf.example ~/.openviking/ovcli.conf
```

## 三、内网 ov.conf 要点(模型指内网服务)

```json
{
  "embedding": { "dense": {
    "provider": "openai",
    "api_base": "http://<内网模型网关>/v1",
    "api_key": "<内网key>",
    "model": "<内网 embedding 模型>",
    "dimension": <对齐维度>
  }},
  "vlm": { "provider": "openai", "api_base": "http://<内网模型网关>/v1",
           "api_key": "<内网key>", "model": "<内网 LLM>", "thinking": false },
  "storage": { "workspace": "<数据盘路径>" },
  "server": { "host": "127.0.0.1", "port": 1933 }
}
```
内网模型服务如能同时提供 embedding + 文本生成,则 vlm 也配上 → 记忆抽取开启(比只存不抽强)。

## 四、安装与启动(内网机器)

```bash
# openviking 离线安装后:
openviking-server doctor     # 全 PASS 再往下
openviking-server &          # 或 nohup / systemd
curl http://127.0.0.1:1933/health

# DSH 桌面端:
dsh plugin --profile web add vendor/dsh-memory-plugin
# 可选让服务随 DSH 启动:装配 plugins/dsh-plugin-ov-server(见其 README)
```

## 五、验收

```bash
curl http://127.0.0.1:1933/health
ov observer system            # embedding 队列 healthy、向量库 OK
```
DSH 新会话 → 有 OpenViking 上下文注入 + `mcp__openviking__*` 工具 → 问旧会话内容能召回。

## 六、合规提醒(内网通用)

- 软件安装/端口开放走内网审批流程
- 数据(含会话日志、代码片段)落受管盘,不外传
- 不接任何公网 API;模型与数据均在内网
- 多人共享服务端时改用 API Key / trusted 模式 + 每用户 `OPENVIKING_ACCOUNT/USER`,并设
  `OPENVIKING_RECALL_PEER_SCOPE=actor` 隔离项目记忆
