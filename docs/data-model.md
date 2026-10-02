# 数据模型与公开范围

公共源包括 data/opportunities.json、data/positions.json 清单与 data/positions/*.json、data/position-scans.json、旧岗位和别名。岗位 ID 稳定，来源、日期、当前可投独立保存；缺失信息不补写日期或资格。

jobs.sqlite／jobs.sql 包含 companies、positions、position_scans、legacy_positions、position_aliases、catalog_metadata。payload 保存原始 JSON 的全部字段，另有岗位名称、机构、性质、学历、日期和来源的 SQL 列。此快照不含任何个人空间表。

私人数据库包含 workspace_records、workspace_events、workspace_spaces、workspace_sessions、workspace_accounts、workspace_mutations、workspace_rates。Sites 使用 D1；自托管使用独立 SQLite 文件。空间 ID 隔离用户，版本号检测冲突，保存请求幂等，记录与历史事务一致。

浏览器 IndexedDB 保存空间副本和待同步队列。恢复码及访问令牌原文不写入数据库，只保留哈希；访问令牌由 HttpOnly Cookie 承载。Sites 登录可选，自托管默认未配置。

源码导出采用白名单，剥离 Sites 项目身份，排除环境文件、Git 历史、运行数据库、浏览器缓存、研究原始归档和可能含个人进度的截图。SOURCE_EXPORT.json 列出各文件哈希。
