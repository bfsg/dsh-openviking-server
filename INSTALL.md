# dsh-openviking-server — DSH Desktop 记忆系统安装说明（AI / 自动化可执行）

> 本说明**仅针对 DSH Desktop 桌面版**（Electron 桌面应用，harness profile 为 `web`）。
> 部署 = **① 服务端(openviking-server) + ② 捕获/召回插件(@openviking/dsh-memory-plugin) + ③(可选)随启动插件(dsh-plugin-ov-server)**。
> 插件安装后必须**重启桌面应用**才生效。

## 0. 前置条件

- 已安装并运行 **DSH Desktop**(Windows)。
- Python 3.10–3.13(装服务端用;3.12.x 最稳)。
- 模型通道二选一:
  - **远程 OpenAI 兼容端点**(公网 API 或内网模型服务):填 `~/.openviking/ov.conf`;
  - **纯本地**:内置 `bge-small-zh-v1.5-f16` + llama-cpp-python(Windows 无官方 wheel,不推荐)。
- 离线包(无 PyPI 时):本仓库 [Releases](https://github.com/bfsg/dsh-openviking-server/releases) 的
  `ov-wheels-0.4.17.1-win-amd64.zip`(Windows x86_64 / Python 3.10+,含 3.12)。

## 1. 安装并启动服务端 openviking-server

### 1a. 有网 / 有 PyPI
```powershell
uv tool install openviking      # 或 pip install openviking
```

### 1b. 完全离线(内网无 PyPI)
```powershell
# 解压 ov-wheels-*.zip → 得到 ov-wheels\ 目录,然后:
python -m pip install --no-index --find-links .\ov-wheels\ openviking
# 或跑本仓库 offline\install-offline.ps1(自动建 venv + 装 + 校验)
```

### 1c. 写配置并启动
```powershell
$ov = "$env:USERPROFILE\.openviking"; New-Item -ItemType Directory -Path $ov -Force | Out-Null
# 复制仓库 config\ov.conf.example → $ov\ov.conf,填 endpoint/api_key/model(远端)或删掉 vlm 段(本地)
# 复制仓库 config\ovcli.conf.example → $ov\ovcli.conf

openviking-server doctor         # 应全部 PASS(至少 Config/Python/Embedding)
openviking-server                # 前台;或后台任务启动
```

自检服务端:
```powershell
curl.exe http://127.0.0.1:1933/health    # 期望 {"status":"ok",...}
```

## 2. 定位 `dsh` 命令行

DSH Desktop 不保证 `dsh` 在系统 PATH 上。先探测:

```powershell
dsh --version
```

- 若打印版本号(如 `0.1.2-alpha.1`)→ 直接进入第 3 步,命令用 `dsh ...`。
- 若报「无法识别 dsh」→ 改用桌面应用捆绑的 node + dsh bin,先定义变量(按实际安装目录替换 `<INSTALL_DIR>`,常见 `G:\desktop-dsh` 或 `C:\Program Files\DSH Desktop`):

```powershell
$node = "<INSTALL_DIR>\DSH Desktop\resources\app\node_modules\node\bin\node.exe"
$dsh  = "<INSTALL_DIR>\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js"
```

> 本机实测:两文件存在,`& $node $dsh --version` → `0.1.2-alpha.1`。

## 3. 安装捕获/召回插件 @openviking/dsh-memory-plugin

插件本体在仓库 `vendor\dsh-memory-plugin\`(官方 v0.3.0 完整运行副本,Apache-2.0)。
二选一安装:

```powershell
# 方式 A(推荐,离线):直接用仓库里的副本目录
dsh plugin --profile web add "G:\path\to\dsh-openviking-server\vendor\dsh-memory-plugin"

# 方式 B(官方命令,需 npm registry 可达)
dsh plugin --profile web add @openviking/dsh-memory-plugin
```

若 `dsh` 不在 PATH,统一用:

```powershell
& $node $dsh plugin --profile web add "<仓库绝对路径>\vendor\dsh-memory-plugin"
```

## 4. 校验插件安装结果(3 条全过才算成功)

Windows 下 profile 目录为 `%APPDATA%\dsh-desktop\harness\profiles\web`:

1. `profiles\web\package.json` 的 `dependencies` 含 `"@openviking/dsh-memory-plugin"`;
2. `profiles\web\node_modules\@openviking\dsh-memory-plugin\` 存在(index.mjs / runtime.mjs 等);
3. 插件自带 `cordis.patch.yml` 已声明 `openviking-memory` 组(id `openviking-memory-runtime` 挂 `@openviking/dsh-memory-plugin`)。

> 本插件走 **bundle 机制**激活(官方安装器把 bundle 装进 profile)。
> 若上述 2、3 因手动安装不满足,可改走**手动 patch 装配**(见第 6 节备用路线)。

## 5. 重启 DSH Desktop(必做,不可省略)

- 完全退出:系统托盘 → DSH Desktop 图标 → 右键 → **退出**;
- 重新打开 DSH Desktop。

(重启后 harness 才加载插件 host 半;不重启插件不生效。可同时让第 6 节的 ov-server 插件接管服务进程。)

## 6.(可选)安装随启动插件 dsh-plugin-ov-server

作用:DSH 启动时自动确保 `openviking-server` 在 `127.0.0.1:1933` 运行(未运行则 detached 拉起,日志追加 `~/.openviking/server.log`),并提供 `/dsh-openviking/status|start|stop` 路由。零 runtime 依赖。

### 装配(手动,与 local-llm-switch 同构)
1. 把 `plugins\dsh-plugin-ov-server\` 目录复制到 harness 插件区,例如
   `%APPDATA%\dsh-desktop\harness\plugins\dsh-plugin-ov-server\`;
2. 编辑 `profiles\web\package.json` 的 `dependencies`,加:
   ```json
   "dsh-plugin-ov-server": "file:../../plugins/dsh-plugin-ov-server"
   ```
3. 在 `profiles\web\cordis.patch.yml` 的 `insert` 段追加一行:
   ```yaml
   - id: ov-server
     name: dsh-plugin-ov-server
   ```
   (确认无重复 id);
4. 在 profile 目录执行 `pnpm install`(file: 本地依赖,离线可完成)。

### 自检
```powershell
curl.exe http://127.0.0.1:1933/health        # 插件已拉起服务时返回 ok
curl.exe http://127.0.0.1:49977/dsh-openviking/status   # 端口随 webServer 实际端口
```

## 7. 验证记忆系统已生效(端到端)

1. 打开任意会话,会话开头应出现 **OpenViking 上下文注入块**(`<openviking-context ...>` 或 profile/recall 注入);
2. 模型工具列表出现 `mcp__openviking__search / read / list / grep / glob / remember / add_resource` 等;
3. 问一句更早会话聊过的事(例如「standard-250k preset 是什么」),能召回即通;
4. 仍无效果:设环境变量 `OV_DEBUG_LOG` 后重启 DSH,看插件日志。

服务端侧复核:
```powershell
openviking-server doctor
ov observer system          # embedding 队列 healthy
ov ls viking://user/default/resources
```

## 8. 卸载 / 回滚

```powershell
# 移除捕获插件
dsh plugin --profile web remove @openviking/dsh-memory-plugin
# 移除随启动插件(手动)
#   - package.json dependencies 删 dsh-plugin-ov-server
#   - cordis.patch.yml 删 id: ov-server 行
#   - 重启 DSH Desktop
```

停止服务端:停掉启动它的进程,或调 `GET /dsh-openviking/stop`(若 ov-server 插件在)。

## 附:常见问题

| 现象 | 排查 |
| --- | --- |
| 会话无注入/无 `mcp__openviking__*` | 服务端未起(先过 §1 自检);插件未重载(§5);看 `OV_DEBUG_LOG` |
| `doctor` Embedding FAIL | 用远端端点时检查 ov.conf 的 api_base/api_key/model/dimension;本地则缺 llama-cpp-python |
| 装插件后 package.json 无依赖 | `dsh plugin` 需在 DSH Desktop **退出状态**下跑,或在 profile 目录有 pnpm 时手动 `pnpm add` |
| 记忆"串台" | 多项目共存时设 `OPENVIKING_RECALL_PEER_SCOPE=actor` |
| 崩溃期间消息丢失 | 自动进 `~/.openviking/pending\`,下次会话开始重放(每次 ≤50 条) |
