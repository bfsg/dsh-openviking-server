# dsh-plugin-ov-server

DeepSeek Harness **宿主插件**:DSH 启动时自动确保本地 OpenViking 服务端(`openviking-server`)在 `127.0.0.1:1933` 运行;未运行时 detached 拉起,已运行则不干预。附带 `/dsh-openviking/status|start|stop` HTTP 路由供手动控制。

配套 `@openviking/dsh-memory-plugin` 使用——后者只管记忆捕获/召回,不管服务进程;由本插件解决"服务随 DSH 一起启动"。

## 装配(web profile 为例)

1. 把本目录放入本地插件区,例如:
   `%DSH_HOME%\plugins\dsh-plugin-ov-server`(Windows)或 `$DSH_HOME/plugins/dsh-plugin-ov-server`(Linux)
   (本仓库根下即插件目录,复制整个 `dsh-plugin-ov-server/` 即可)

2. 在 profile 的 `package.json` 增加 file: 依赖(路径按实际调整):
   ```json
   "dependencies": {
     "dsh-plugin-ov-server": "file:../../plugins/dsh-plugin-ov-server"
   }
   ```
   然后在该 profile 目录执行 `pnpm install`(file: 本地依赖,离线可完成)。

3. 在 profile 的 `cordis.patch.yml` 追加 insert 行(照抄既有插件如 local-llm-switch 的写法):
   ```yaml
   - insert:
       - id: ov-server
         name: dsh-plugin-ov-server
   ```

4. 重启 DSH。日志看 `~/.openviking/server.log`。

## 行为

- 启动时探测 `http://127.0.0.1:1933/health`;
- 未运行 → detached spawn `openviking-server --host 127.0.0.1 --port 1933`,stdout/stderr 追加到 `~/.openviking/server.log`;
- 已运行 → 不动(可与其他方式启动的实例共存);
- 探测窗口 120s,未健康则记 warn 并放弃(可再手动调 `/dsh-openviking/start`);
- HTTP 路由由宿主 `webServer` 提供:
  - `GET /dsh-openviking/status` → `{ ok, running, starting, pid, startedAt, endpoint }`
  - `GET /dsh-openviking/start` / `GET /dsh-openviking/stop`

## 可配置项

通过 cordis.patch.yml 的 `config` 覆盖(默认值见 `lib/index.js` 顶部 `DEFAULTS`):
`endpoint`、`exe`(openviking-server 可执行文件路径)、`args`、`logFile`、`startTimeoutMs`。

## 前置条件

- 已安装 openviking(提供 `openviking-server` 可执行文件,见 `docs/deploy-guide.md`)
- 已配置 `~/.openviking/ov.conf`
- 插件代码仅用 Node 内置模块(`node:child_process` / `node:fs` / `node:os` / `node:path`),无 runtime 依赖
