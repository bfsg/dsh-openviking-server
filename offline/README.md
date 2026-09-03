# OpenViking 离线安装(wheel 包)

openviking 通过 PyPI 分发(GitHub Release 无二进制)。内网无 PyPI 时,用离线 wheel 包安装。

## 获取离线包

**Release 附件**:前往本仓库 [Releases](https://github.com/bfsg/dsh-openviking-server/releases)
下载 `ov-wheels-0.4.17.1-win-amd64.zip`(163 个 wheel,~170 MB,Windows x86_64 / Python 3.10+ 含 3.12)。

解压后得到 `ov-wheels/` 目录,与 `install-offline.ps1` 同目录放置。

## 本目录内容

- `install-offline.ps1` — Windows 一键离线安装脚本(自动建 venv + 本地安装 + 校验)
- `install-offline.sh` — Linux 版本(需先用 pip download 打 Linux wheel 包,见下)
- 说明见本文件

## 内网安装(Windows + Python 3.12)

```powershell
# 方式 1:脚本(推荐)
.\install-offline.ps1 .\ov-wheels

# 方式 2:手动
python -m venv C:\openviking-venv
C:\openviking-venv\Scripts\python.exe -m pip install --no-index --find-links ov-wheels\ openviking
C:\openviking-venv\Scripts\openviking.exe --version     # openviking 0.4.17.1
C:\openviking-venv\Scripts\openviking-server.exe        # 启动服务端
```

Linux 内网:在能出网机器上打 Linux 包再按脚本装:
```bash
pip download --platform manylinux2014_x86_64 --python-version 3.12 \
  --only-binary=:all: --dest ov-wheels-linux openviking
```

## 说明

- 走 API embedding / 内网模型服务时,**不需要** llama-cpp-python(GGUF 本地推理才需要);
  包内已确认不含 llama-*。
- openviking 本体仅 Python 依赖,无原生编译要求(`--only-binary` 全命中 wheel)。
- 装完后仍需 `~/.openviking/ov.conf`(见仓库根 config/ov.conf.example)。
- 本包由 `pip download --only-binary=:all: openviking` 于 2026-09-04 生成,并在全新 venv
  离线安装验证通过(163 包 Successfully installed,openviking-server --version 正常)。
