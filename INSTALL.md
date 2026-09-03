# dsh-openviking-server — DSH Desktop 记忆系统安装说明（AI / 自动化可执行）

> 本说明**仅针对 DSH Desktop 桌面版**（Electron 桌面应用，harness profile 为 `web`）。
> 部署 = **① 服务端(openviking-server) + ② 捕获/召回插件(@openviking/dsh-memory-plugin) + ③(可选)随启动插件(dsh-plugin-ov-server)**。
> 插件安装后必须**重启桌面应用**才生效。

## 0. 前置条件(目标机器上本身必须有)

分三类:部署流程会**自动处理**的不算前提;下面列的每一条都是机器上**预先要有**的,缺了装不动。

### 0.1 必须预装(缺一不可)

| 项 | 版本/要求 | 为什么必须有 | 缺失后果 |
|---|---|---|---|
| **DSH Desktop 桌面版** | 当前版(Electron 应用) | 插件的宿主;插件只装在它的 harness profile 里 | 没有它,捕获/召回插件无处可装(本仓库所有插件流程都针对桌面版,见 [docs/PLUGIN-GUIDE-AI.md](./docs/PLUGIN-GUIDE-AI.md)) |
| **Python**(仅服务端用) | **3.10–3.13**,推荐 3.12.x | `openviking-server` 是 Python 程序;离线 wheel 是 `cp310-abi3`/`py3-none-any`,靠**系统 Python** 建 venv 安装(install-offline.ps1 用 `python -m venv`) | 离线包不含解释器;没有 Python 第 1 步就装不了 |

> ⚠️ 离线包是 **wheel(代码),不含 Python 解释器**。内网机器必须先有 Python 3.12 才能用它。
> 若内网连 Python 都没有:需另带官方 Python 3.12 安装包(或嵌入式 zip)一并拷入——这是仓库外的前提。

### 0.2 必须有但无需预装(部署时提供/自带)

| 项 | 说明 |
|---|---|
| openviking 本体 | 本仓库 Release `ov-wheels-*.zip` 自带(离线可装) |
| @openviking/dsh-memory-plugin | 本仓库 `vendor\dsh-memory-plugin\` 自带 |
| dsh-plugin-ov-server(可选) | 本仓库 `plugins\dsh-plugin-ov-server\` 自带 |
| 配置文件 | 本仓库 `config\` 模板自带 |

### 0.3 机器侧前提(非软件安装项)

| 项 | 要求 |
|---|---|
| 模型服务可达 | 服务端需要 embedding;走内网 OpenAI 兼容端点时必须能访问它(网络放行);纯本地则需 llama-cpp-python + GGUF(不推荐,见 0.4) |
| 磁盘空间 | openviking 数据目录(向量库/工作区)+ 解压后的 wheel 目录;建议预留 ≥1 GB |
| 端口 | 服务端默认 `127.0.0.1:1933`,本机回环即可(单机不用开防火墙) |

### 0.4 明确不需要的东西(免得白准备)

- ❌ **不需要**先装 openviking / uv / pip 全局包——第 1 步会装(有网用 uv,离线用 Release wheel)
- ❌ **不需要** llama-cpp-python(走内网模型服务时)——本仓库离线包已确认不含它
- ❌ **不需要** Node.js / pnpm 全局安装——DSH Desktop 自带捆绑 node + `.desktop-bin` shim(§2 用它)
- ❌ **不需要** Docker
- ❌ **不需要** 访问 npm registry / PyPI(前提:已拿到本仓库 + Release 离线包)

### 0.5 一句话清单

> **一台装了 DSH Desktop 的 Windows x86_64 机器 + 系统 Python 3.12.x + 能访问内网模型服务(或自带本地模型)**
> = 具备开始部署的全部前提。其余(openviking 本体、插件、配置)由本仓库提供。

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

## 2. 环境锁定(先做,不做会装错地方)

插件安装流程完全遵循 [PLUGIN-GUIDE-AI.md](./docs/PLUGIN-GUIDE-AI.md) §10–11(DSH Desktop 插件开发指南,AI 可执行版)。**第一条硬规则:CLI 不设 `DSH_HOME` 默认装到 `~/.dsh`,桌面版感知不到**。

```powershell
# 1) 定位桌面版安装目录:从运行中进程/注册表/常见路径找,验证存在:
#    <INSTALL_DIR>\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js
#    本机示例:INSTALL_DIR = G:\desktop-dsh
$installDir = "G:\desktop-dsh"            # ← 按实际替换

# 2) 定义捆绑 node + dsh(一律用捆绑的,不要用 PATH 上的裸 dsh)
$node = "$installDir\DSH Desktop\resources\app\node_modules\node\bin\node.exe"
$dsh  = "$installDir\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js"
& $node $dsh --version                     # 期望 0.1.x(如 0.1.2-alpha.1)

# 3) 环境锁定:DSH_HOME 指到桌面版 harness;活跃 profile 用 web
$env:DSH_HOME = "$env:APPDATA\dsh-desktop\harness"
$profileDir  = "$env:DSH_HOME\profiles\web"
$env:PATH    = "$env:DSH_HOME\.desktop-bin;" + $env:PATH    # 桌面版自带 pnpm shim
```

> 反查环境没锁错:第 5 步后 `~/.dsh/profiles/*/node_modules/@openviking` 必须**不存在**(存在=装错 home)。

## 3. 安装捕获/召回插件 @openviking/dsh-memory-plugin

插件本体在仓库 `vendor\dsh-memory-plugin\`(官方 v0.3.0 完整运行副本,Apache-2.0)。
安装 = **装依赖 + 接线**两步,先装依赖:

```powershell
# 方式 A(推荐,离线):用仓库副本目录(等价于 pnpm add 本地目录)
& $node $dsh plugin --profile web add "<仓库绝对路径>\vendor\dsh-memory-plugin"

# 若上面失败,退回桌面版自带 pnpm 直接装:
& "$env:DSH_HOME\.desktop-bin\pnpm.cmd" --dir "$profileDir" add "<仓库绝对路径>\vendor\dsh-memory-plugin"

# 方式 B(官方命令,需 npm registry 可达)
& $node $dsh plugin --profile web add @openviking/dsh-memory-plugin
```

## 4. 接线(二选一,绝不都做)

> 本插件是 **bundle 包**(自带 `dsh.bundle.patch: ./cordis.patch.yml`,声明
> `openviking-memory` 组)。loader 通过 package.json 的 `dsh.profile.bundles` 应用它的 bundle patch。
> **只在 bundles 接线;不要再去 cordis.patch.yml 手动 insert openviking-memory——都做 =
> `duplicate loader entry id` 启动失败**。

检查并补全接线(编辑 `%APPDATA%\dsh-desktop\harness\profiles\web\package.json`):

```jsonc
{
  "dependencies": {
    "@openviking/dsh-memory-plugin": "^0.3.0"      // 装依赖后应有
  },
  "dsh": {
    "profile": {
      "bundles": [                                  // 必须含该包名
        "@openviking/dsh-memory-plugin"
        // ...其它 bundle
      ]
    }
  }
}
```

校验(4 条全过才算装好):
1. `package.json` 的 `dependencies` 含 `"@openviking/dsh-memory-plugin"`;
2. 同一文件 `dsh.profile.bundles` 数组含 `"@openviking/dsh-memory-plugin"`;
3. `profiles\web\node_modules\@openviking\dsh-memory-plugin\` 存在
   (index.mjs / runtime.mjs / cordis.patch.yml);
4. `cordis.patch.yml` 内 `openviking-memory` 组只出现一次(全局无重复 id)。

## 5. 重启 DSH Desktop(必做,不可省略)

```powershell
# 完全退出(托盘退出,不要只关窗口):
Stop-Process -Name "DSH Desktop" -Force -ErrorAction SilentlyContinue   # 或托盘右键退出
Start-Process "$installDir\DSH Desktop\DSH Desktop.exe"
```

(重启后 harness 才加载插件 host 半;不重启插件不生效。)

## 6. 验证插件已加载(重启后全部打勾才算完成)

```powershell
# 1) 日志有新启动段且无插件报错(路径按实际 logs 位置)
Select-String -Path "$env:APPDATA\dsh-desktop\logs\harness.log" -Pattern 'openviking|memory-plugin' |
  Where-Object { $_ -match 'fail|error' }     # 应为空

# 2) 服务端健康
curl.exe http://127.0.0.1:1933/health          # {"status":"ok",...}
```

3. 打开任意会话,开头出现 **OpenViking 上下文注入块**(`<openviking-context ...>`);
4. 工具列表出现 `mcp__openviking__search / read / list / grep / glob / remember / add_resource`;
5. 问一句更早会话聊过的事(如「standard-250k preset 是什么」),能召回即通;
6. 反查默认 home 没被污染:
   `Get-ChildItem "$env:USERPROFILE\.dsh" -Recurse -Filter '*openviking*'` 应无结果;
7. 仍无效:设 `$env:OV_DEBUG_LOG` 后重启 DSH,看插件日志。

服务端侧复核(可选,端到端再确认):
```powershell
openviking-server doctor
ov observer system          # embedding 队列 healthy
ov ls viking://user/default/resources
```

## 7.(可选)安装随启动插件 dsh-plugin-ov-server

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
| 启动失败 `duplicate loader entry id: openviking-memory` | bundles 和 patch 层**都**接线了 → 二选一(§4);或 cordis.patch.yml 里 insert 了框架 bundle 已有的 id |
| 插件装了但桌面版没反应 | `DSH_HOME` 没设,装进了 `~/.dsh`(§2 环境锁定);反查 §6.6 |
| 重装后代码没变化 | pnpm 对版本号未变的 file:/tgz 依赖跳过复制 → 删 `node_modules\@openviking\dsh-memory-plugin` 再 install |
| 装插件后 package.json 无依赖 | `dsh plugin` 需在 DSH Desktop **退出状态**下跑,或用 `$DSH_HOME\.desktop-bin\pnpm.cmd` 装(§3) |
| 日志 `migration failed, restoring the pre-upgrade profile` | 桌面版 generations 迁移既有问题,与新插件无关,忽略(PLUGIN-GUIDE-AI §12.10) |
| `doctor` Embedding FAIL | 用远端端点时检查 ov.conf 的 api_base/api_key/model/dimension;本地则缺 llama-cpp-python |
| 记忆"串台" | 多项目共存时设 `OPENVIKING_RECALL_PEER_SCOPE=actor` |
| 崩溃期间消息丢失 | 自动进 `~/.openviking/pending\`,下次会话开始重放(每次 ≤50 条) |
