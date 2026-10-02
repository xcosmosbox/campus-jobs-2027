# 所有者提交身份

本仓库所有者为 GitHub 用户 xcosmosbox。所有者要求助手代写、代提交的工作使用其身份，不附加 Codex／GPT／OpenAI 联合作者或生成署名。

在所有者工作副本中执行：

```bash
node scripts/configure-owner-git.mjs
```

它只修改本仓库的 Git 配置，设置作者与提交者为 xcosmosbox，使用 56502269+xcosmosbox@users.noreply.github.com，并启用提交／推送前检查。脚本检查 origin 是否为此仓库，普通自托管用户不需要运行。

AGENTS.md 为后续助手保存同一约定。通过连接器提交时，本地 Git 配置不会改变远端 API 的行为；必须核对 GitHub 返回的 author 与 committer 账号。GitHub 应用审计、认证身份与 push 执行者由平台和实际授权决定，不能用 git user.name 伪造或删除。

真实第三方贡献者仍保留自己的作者信息。
