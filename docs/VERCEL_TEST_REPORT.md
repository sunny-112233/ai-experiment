# Vercel 适配验证记录

日期：2026-11-08。分支：deployment/vercel-nitro；仅合成数据和本地临时数据库。未访问、迁移或覆盖真实被试数据。

## 已完成的本地检查

| 检查 | 结果与范围 |
| --- | --- |
| 依赖安装 | npm install成功；npm ci锁文件解析检查成功；pnpm锁文件同步，保留七天发布等待策略 |
| TypeScript | npm run typecheck通过 |
| Vercel生产构建 | Vinext + Vite + Nitro vercel preset成功，生成.vercel/output，而非.next |
| Cloudflare生产构建 | 独立配置构建成功，仍生成原Workers产物；未发布旧站 |
| 原功能回归 | npm run test:legacy通过原SQLite/API与前端状态测试 |
| PostgreSQL SQL与事务 | 本地真实PostgreSQL 18.6 TCP通过；另有PGlite回归。六种条件、6人完整38题共228次作答、时长/超时NULL、续答、去重、权限、筛选、材料版本固定均通过 |
| 并发 | 36个并发分配保持六组平衡；同一答案并发提交仅保存一条；事务失败回滚 |
| 生产函数产物 | 直接加载生成的Node函数：首页、研究者/材料/备份页面、字段CSV、创建与续答、错误口令拒绝均通过 |
| SSR与动态路由 | 使用临时React动态路由夹具生成生产产物，SSR返回对应slug通过；夹具随后删除，不发布测试页面 |
| 对象存储协议 | 实际AWS SDK对本地S3签名协议夹具：上传、流式下载、404、拒绝覆盖通过；这不是远端S3权限测试 |
| 自动与手动备份 | 完成实验触发备份、手动备份、下载校验、上传校验通过；第二份副本失败记录失败，重试双写成功通过 |
| 恢复 | 完整包在全新PostgreSQL隔离schema恢复，数量、原文、时长、空值核对通过；拒绝覆盖已有schema；保留SQLite工具 |
| 容量 | 1049名合成被试、38229条作答导出与完整备份通过。Excel为22861219字节，主表1050行（1行表头+1049人）、517列；备份492338字节。一次本地导出+备份约3422ms，不能作为云端耗时承诺 |
| 保留原材料 | lib/experiment-html.ts、lib/materials.json和原drizzle迁移未改；题序、题文、原量表与研究变量保持原状 |

## 未完成，不能标为通过

- Vercel Preview真实部署及公网端到端：尚未获得可操作的Vercel项目、Preview PostgreSQL及私有S3凭据。本地生成并调用Vercel产物不等于真实部署成功。
- Neon/其他托管PostgreSQL的TLS、池化、区域与连接配额；真实S3两份独立存储的权限和未授权读取拒绝；均需云端实测。
- 真实浏览器六套流程逐一人工试测、研究三30秒墙钟计时、断网重试、刷新恢复、后台Excel下载、大文件流式响应；当前只有状态/API与本地产物测试，不能替代这些验收。
- 生产真实数据迁移、增量切换和回退演练；本次没有执行。
- yuqing-lab.top DNS、TLS及中国大陆多网络可达性；没有修改DNS，不能承诺任何网络均可打开。
- 原仓库缺少初始判断/初始信心/最终判断/最终信心四阶段。当前是固定AI建议后一次七点评分，按要求未擅自增加研究变量。正式方案需单独确认实现。
- 原仓库为test/pilot-01模式；正式收数配置和材料定稿尚未完成。

## 注意与复现

`npm run test:legacy`、`npm run test:postgres`、`npm run test:storage`、`npm run typecheck`可单独运行。

生产产物与真实PG联测：先`npm run build`，准备本机PostgreSQL binaries，运行`PG_BIN=/绝对路径/bin npm run test:native`。此脚本仅用于隔离测试：临时initdb、loopback 55439端口、临时测试库、退出关闭进程；不要连接生产实例。测试会生成合成记录。PGlite测试默认不需外部数据库。

Nitro为固定RC；构建仍有nf3可选traceInclude依赖提示，未通过屏蔽错误处理。已显式打包S3/pg依赖，并实际加载生产备份页面，解决了最初SDK文件遗漏的运行时错误。未接通的云端项目仍需检查完整日志与可选追踪依赖在目标环境中的影响。

真实Preview请按VERCEL_DEPLOYMENT.md第7节逐项验收，通过后再合并主分支与切换域名。
