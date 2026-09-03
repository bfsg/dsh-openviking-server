# OpenViking + DSH 记忆系统 · 快速安装助手(离线可用)

用法:
  install.sh <openviking-安装源>     # 安装 openviking;或直接运行,假设已在 PATH

脚本目的:内网机器把本仓库的资产落地成可用状态(配置模板、目录、校验)。
不执行任何公网下载。

set -euo pipefail

HOME_DIR="${HOME:-$USERPROFILE}"
OV_DIR="$HOME_DIR/.openviking"

echo "==> 1/5 准备 ~/.openviking 目录"
mkdir -p "$OV_DIR"

echo "==> 2/5 放置配置模板(不覆盖已有文件)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$OV_DIR/ov.conf" ] || cp "$REPO_DIR/config/ov.conf.example" "$OV_DIR/ov.conf"
[ -f "$OV_DIR/ovcli.conf" ] || cp "$REPO_DIR/config/ovcli.conf.example" "$OV_DIR/ovcli.conf"

echo "==> 3/5 确认 openviking-server"
if command -v openviking-server >/dev/null 2>&1; then
  echo "    openviking-server: $(command -v openviking-server)"
elif [ -x "$HOME_DIR/.local/bin/openviking-server" ]; then
  echo "    openviking-server: $HOME_DIR/.local/bin/openviking-server"
  export PATH="$HOME_DIR/.local/bin:$PATH"
else
  echo "    [WARN] 未找到 openviking-server —— 请先离线安装 openviking(见 docs/deploy-guide.md)"
fi

echo "==> 4/5 doctor 校验(可先手动编辑 $OV_DIR/ov.conf 填模型 endpoint/key)"
if command -v openviking-server >/dev/null 2>&1; then
  openviking-server doctor || echo "    [INFO] doctor 有失败项 —— 按输出修 ov.conf 后重跑"
fi

echo "==> 5/5 提示"
cat <<'EOF'

下一步(任选):
  a) 启动服务端: openviking-server            # 127.0.0.1:1933
  b) DSH 装配插件: dsh plugin --profile web add <vendor/dsh-memory-plugin 路径>
  c) 随 DSH 启动:   见 plugins/dsh-plugin-ov-server/README.md
验收: curl http://127.0.0.1:1933/health
EOF
