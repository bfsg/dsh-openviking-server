# @openviking/dsh-memory-plugin — 离线打包副本

- 版本:v0.3.0
- 来源:https://www.npmjs.com/package/@openviking/dsh-memory-plugin
- 上游源码:https://github.com/volcengine/OpenViking/tree/main/examples/dsh-memory-plugin
- License:Apache-2.0(见包内 LICENSE / package.json)

## 用途

供无 npm registry 访问的机器离线装配 DSH profile:

```bash
# 方案 A:整个目录作为本地包(需其自身 node_modules 已就绪,否则 peer 解析靠 DSH profile)
dsh plugin --profile web add ./vendor/dsh-memory-plugin

# 方案 B(推荐):打包成 tarball 再装
npm pack ./vendor/dsh-memory-plugin   # 生成 openviking-dsh-memory-plugin-0.3.0.tgz
dsh plugin --profile web add ./openviking-dsh-memory-plugin-0.3.0.tgz
```

## 本机已安装验证

此副本即本机 `profiles/web/node_modules/@openviking/dsh-memory-plugin` 的完整拷贝
(已去除无关文件,保留运行所需全部模块)。`dsh` CLI 在桌面应用捆绑目录
(`<安装目录>\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js`),
不在系统 PATH;完整装配 + 校验 + 重启流程见仓库根 **[INSTALL.md](../INSTALL.md)**。
