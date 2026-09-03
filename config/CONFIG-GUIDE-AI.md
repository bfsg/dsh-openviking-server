# openviking-server 配置填写指南(AI 可执行版)

> 对象:`~/.openviking/ov.conf`。本指南写给**要部署 DSH 记忆系统的 AI/操作者**。
> 照抄 §2 模板、按 §1 收集 4 个值填入,再跑 §3 自检即完成。
> ⚠️ `ov.conf` 是**运行时 JSON:不能写注释、不能留 `//`、不能留 `,` 尾逗号**——填完先按 §3.0 验 JSON 合法性。

## 1. 你需要向模型服务方收集的 4 个值(缺一不可)

| # | 值 | ov.conf 字段 | 说明 / 常见样子 |
|---|---|---|---|
| 1 | **API 地址(OpenAI 兼容)** | `embedding.dense.api_base` | 通常**要带 `/v1`**。例:`https://gw.xxx.com/v1` 或 `http://10.0.0.5:8000/v1` |
| 2 | **API Key** | `embedding.dense.api_key` | 内网网关若免鉴权可留 `""`;一般是一串 token |
| 3 | **Embedding 模型名** | `embedding.dense.model` | 问模型服务方要"embedding 模型名",如 `text-embedding-v3` |
| 4 | **向量维度** | `embedding.dense.dimension` | **必须等于该 embedding 模型输出的维度**(1024 / 768 / 512…),填错 → 召回全废 |

> 前提确认(服务方答 3 个问题):
> a) 端点是否 **OpenAI 兼容**(支持 `POST {api_base}/embeddings`)?不是则需加兼容适配层,不能直填。
> b) 该 Key 是否有 **embedding 模型权限**?(有些网关只开了对话,没开 embedding)
> c) 若想开启**记忆抽取**(session commit 后自动摘要),还要一个**文本生成模型**(见 §2 的 `vlm` 段,可选)。

## 2. 模板(直接复制,把 4 个值替换进去)

```json
{
  "embedding": {
    "dense": {
      "provider": "openai",
      "api_base": "https://<模型服务地址>/v1",
      "api_key": "<API_KEY>",
      "model": "<EMBEDDING_MODEL_NAME>",
      "dimension": <EMBEDDING_DIMENSION>
    }
  },
  "vlm": {
    "provider": "openai",
    "api_base": "https://<模型服务地址>/v1",
    "api_key": "<API_KEY>",
    "model": "<TEXT_GENERATION_MODEL_NAME>",
    "thinking": false
  },
  "storage": {
    "workspace": "C:/path/to/openviking/data"
  },
  "server": {
    "host": "127.0.0.1",
    "port": 1933
  }
}
```

字段速查:

| 段 | 字段 | 取值 | 不填/填错后果 |
|---|---|---|---|
| `embedding.dense` | 见 §1 | 4 个值全要 | doctor Embedding FAIL,召回失效 |
| `vlm`(可选) | 模型服务 + 文本模型 | 有则开记忆抽取;无则删掉整段 | 不删也没关系,服务端会探测;不配 = 只存不抽 |
| `storage.workspace` | 数据目录绝对路径 | 默认 `./data` | 建议显式指定独立盘路径 |
| `server.host/port` | `127.0.0.1` / `1933` | 单机默认 | 多端共享才改 host/端口 |

## 3. 自检(填完按顺序跑,全绿才算配好)

### 3.0 JSON 合法性(必做,防低级错误)
```powershell
python -c "import json; json.load(open(r'%USERPROFILE%\.openviking\ov.conf')); print('JSON OK')"
```

### 3.1 doctor(配置与连通性总检)
```powershell
openviking-server doctor
```
**判定标准**:
- `Config` → PASS(文件能被读、结构对)
- `Python` → PASS(环境正常)
- `Embedding` → **PASS = 4 个值齐全且服务端能真调到**(会发一次 probe 请求)
- 其余(VLM/Auth/Disk…)FAIL 若标"optional"可忽略

### 3.2 端到端确认(可选但推荐)
```powershell
openviking-server            # 启动(或已由 ov-server 插件拉起)
curl.exe http://127.0.0.1:1933/health     # {"status":"ok",...}
ov observer system           # embedding 队列 healthy
```

## 4. 常见失败对照表

| 现象 | 原因 | 对策 |
|---|---|---|
| doctor Embedding FAIL:`401/403` | api_key 错或 Key 无 embedding 权限 | 换 Key;向网关确认开通 embedding |
| FAIL:`Connection refused/timeout` | api_base 不可达 | 检查地址前缀是否带 `/v1`、内网放行、`ping`/`curl` 该地址 |
| FAIL:`model not found` | model 名不对 | 向服务方要**准确的 embedding 模型名**(不是对话模型名) |
| doctor 过但召回为空 | dimension 与模型实际不符 | 查模型文档确认维度(1024/768/512),改后重启服务端 |
| FAIL:`Invalid URL / 404` | api_base 少了 `/v1` 或多了一层 | 确认 `POST {api_base}/embeddings` 能通 |
| FAIL 提示需 VLM 之类(optional) | 未配 vlm | 可忽略;要记忆抽取再补 `vlm` 段 |

## 5. 一句话给 AI

> 向模型服务方要 **4 个值**:api_base(带 /v1)、api_key、embedding 模型名、向量维度;
> 照抄 §2 模板填入 `~/.openviking/ov.conf`;跑 §3.0 JSON 校验 → §3.1 doctor 看到 Embedding PASS 即配置完成。
> **4 个值缺一不可,维度最容易漏。**
