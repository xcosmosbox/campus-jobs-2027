# 自托管

需要 Docker Engine 与 Docker Compose，或 Node.js 24 和 pnpm 11.25.0。克隆仓库后使用相同公共岗位库，个人数据保存在自己的实例中。

## Docker

```bash
cp .env.example .env
docker compose up --build -d
```

打开 http://localhost:3000。首次启动自动应用 drizzle 中的 SQL 迁移。匿名空间、投递记录、恢复凭证和修改历史保存在命名卷 autumn27-private-data 的 workspace.sqlite 中；重建镜像及普通停止不会删除此卷。不要用 docker compose down -v 删除需要保留的数据。

修改端口时，同时修改 .env 的 AUTUMN27_PORT 和 PUBLIC_ORIGIN。通过域名与 HTTPS 反向代理访问时，把 PUBLIC_ORIGIN 设置为完整外部源，例如 https://jobs.example.com。它决定保存请求的来源校验和 Secure Cookie；不能附带路径、查询或凭据。数据库目录不能作为公共静态目录提供。

自托管版默认启用游客保存与恢复码，关闭 Sites 专属 ChatGPT 登录，不接受客户端传来的 Sites 用户身份头。默认按直连客户端／代理的 socket 地址限制游客创建与恢复频率。

## Node

```bash
pnpm install --frozen-lockfile
pnpm run build:selfhost
pnpm run start:selfhost
```

默认在 storage/workspace.sqlite 保存个人数据。AUTUMN27_DATABASE_PATH 设置持久化路径，PUBLIC_ORIGIN 设置访问源，PORT 设置监听端口。迁移按文件名执行，已应用文件的哈希若改变则拒绝启动。

## 更新与备份

拉取源码与公共岗位数据更新后，重新构建、启动即可。公开岗位 JSON 和运行数据库独立，更新不会覆盖个人记录。Git 忽略 storage、SQLite 文件及 .wrangler 数据。

恢复码只对应生成它的实例。同一实例内换设备可以找回；官网与自建站之间请在“保存与账号”下载 JSON 备份，在目标实例导入并逐项处理冲突。备份不包含会话令牌或恢复码，不给目标实例访问原数据库的权限。

浏览器 IndexedDB 副本按网站源隔离。断网修改先保留本机，联网后同步到当前实例；清除浏览器数据可能删除尚未同步的内容。

## 公共快照

```bash
pnpm run export:jobs
```

在 exports/public-data 生成 jobs.sqlite、jobs.sql 和哈希清单。默认应用仍读取同一份 JSON 岗位源，SQLite／SQL 是等价的公开数据快照。用 sqlite3 new-jobs.sqlite < exports/public-data/jobs.sql 可导入；不要把公共快照导入个人 workspace.sqlite。

## Sites

相同页面、筛选、备份和保存逻辑继续支持 Sites／D1。Sites 构建不设置 AUTUMN27_TARGET=sqlite，由 Sites 配置逻辑绑定 DB、项目身份和登录入口，使用原有私密部署流程。独立 Node 构建不加载 Cloudflare Workers 或 Sites 登录接口。

## 检查

```bash
node scripts/check-catalog.mjs
node scripts/check-catalog-delivery.mjs
node scripts/check-workspace.mjs
node scripts/check-guest-storage.mjs
pnpm run build:selfhost
pnpm run check:selfhost
```

自托管检查使用临时数据库与真实生产 HTTP 服务，验证保存、重启、恢复、隔离、备份和岗位修改历史。不会访问托管站点数据库。缺少 Docker 引擎时不能将 Node 测试描述为容器构建实测。
