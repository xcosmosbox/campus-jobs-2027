# 27届秋招筛选站 · campus-jobs-2027

互联网、央国企、金融、银行四类招聘机会的筛选与投递跟进站。行业、公司、岗位、地点、资格、状态和截止日期组合筛选；来源确认、日期确认、当前可投独立展示。

同一份代码支持 Sites／D1 托管和 Docker／SQLite 自托管。两种部署支持游客保存、恢复码、浏览器本地副本、投递进度、待办、优先级、修改历史及备份。Sites 提供可选 ChatGPT 登录，自托管默认使用游客与恢复码。

## 快速自托管

```bash
cp .env.example .env
docker compose up --build -d
```

打开 http://localhost:3000。首次启动自动建表，个人数据保存到持久卷。域名、备份、更新和 Node 启动方式见 [自托管说明](docs/self-hosting.md)。

## 公共岗位库

JSON 为可核对的数据源。生成等价 SQLite 与 SQL 快照：

```bash
pnpm install --frozen-lockfile
pnpm run export:jobs
```

输出 exports/public-data/jobs.sqlite、jobs.sql 和哈希清单。仓库 [datasets](datasets) 提供可直接解压使用的公共数据库快照。当前收录 28,819 条岗位，203 家公司均有扫描记录；部分机构与批次无法完整读取，不能当成全部岗位均已获取。见 [核验口径](docs/catalog-verification.md) 与 [数据模型](docs/data-model.md)。

## 发布源码

```bash
pnpm run export:source
```

生成带文件哈希清单的公共源码目录与 tar.gz 包，包含 JSON、SQL 建表迁移、Docker 配置及测试。不复制运行数据库、会话、恢复凭证、环境文件、Sites 项目身份或 Git 历史。可从导出目录建立 GitHub 仓库。

## 开发与验证

Node.js 24、pnpm 11.25.0。用 pnpm run dev:selfhost 开发，pnpm run build:selfhost 构建，pnpm run start:selfhost 启动，pnpm run check:selfhost 验证真实 HTTP 与 SQLite 持久化。Sites 继续使用 pnpm run build 和原有部署流程。已执行的检查及验证边界见 [验证记录](docs/selfhost-verification.md)。

代码采用 MIT 许可证，第三方组件保留其原许可；数据出处与使用说明见 [DATA_NOTICE.md](DATA_NOTICE.md)。
