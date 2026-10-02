# 公共数据库快照

`public-data-2026-10-02.tar.gz` 含 `jobs.sqlite`、`jobs.sql` 与 `manifest.json`。其中有 28,819 条岗位、203 家公司与扫描记录，以及原岗位／别名。可直接下载或克隆后解压：

```bash
mkdir -p public-data
tar -xzf datasets/public-data-2026-10-02.tar.gz -C public-data
```

压缩包 SHA-256：`2c88a4e9f6fd84e8afc08a5a6c3b09fde910bae9f5ebc789f0aaef66f6ee1891`。独立文件哈希在 `manifest-2026-10-02.json` 和包内清单中。

快照只由仓库公共 JSON 生成，未读取运行数据库，不含个人空间、投递记录、笔记、待办、会话或恢复凭证。不要将这个公开快照导入私人的 `workspace.sqlite`。

更新快照使用 `pnpm run export:jobs`。部分／受阻覆盖和未确认日期仍然保留，记录数不代表 203 家公司的全部岗位均已获得。
