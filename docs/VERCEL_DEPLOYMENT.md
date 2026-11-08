# Vercel 适配交付与部署说明

基线：`706566f16c94a5dda8fc6fb1de6b5b772e3f3399`。工作分支：`deployment/vercel-nitro`。
目标域名：`yuqing-lab.top`。本改造不自动修改DNS，不改旧站、不迁移或清理真实数据。

## 1 当前完成范围与重要缺口

当前源码的实际实验流程是：培训→38题固定AI建议与一次七点评分→三项个人信息→五道知识测验。仓库没有“初始判断、初始信心、最终判断、最终信心”四步测量，也没有这些对应字段。本次保持原状，没有擅自新增研究变量。若该序列是正式方案的必要条件，需要研究者先确定题型与编码，再单独实现；不能将其列为本次已通过验收的功能。

原版没有单被试完整详情页面；本分支补充受主试口令保护的只读详情，列表新增“查看”按钮。它不修改实验或历史作答。

恢复保留离线SQLite工具，并增加PostgreSQL隔离schema恢复。没有添加覆盖线上数据库的一键按钮。当前依然是测试模式 `test`、批次 `pilot-01`；正式收数配置、正式知情同意和材料标签定稿属于独立事项。

## 2 构建兼容性与配置

经过本地实际构建验证的版本：Vinext `1.0.0-beta.5`、Vite `8.0.13`、Nitro `3.0.261029-rc`，使用 `nitro/vite`。保留原Vinext，未为部署升级实验框架；选择已超过仓库七天发布等待期的固定Nitro RC，保留原依赖等待策略；Nitro当前固定RC版本，不能把预发布版本的兼容测试等同于长期稳定承诺。

Vercel配置：

- Node.js：24.x。
- Framework Preset：**Other**，不要选Next.js。
- Root Directory：仓库根目录。
- Install Command：`npm ci --no-audit --no-fund`。
- Build Command：`npm run build`。
- Output Directory：`.vercel/output`，必须清除旧的 `.next` Dashboard override。
- 不运行 `next build`，不手工创建伪造的 `.next/routes-manifest.json`。
- 本项目 `vercel.json` 的 `framework: null` 显式禁用Next.js检测。

`vite.config.ts` 使用Vinext与Nitro插件，后者明确使用 `vercel` preset。本地构建已产生 `.vercel/output/config.json`、静态资源和Node.js函数入口；函数配置为Node.js 24、流式响应及300秒上限。实际执行时长仍取决于Vercel账户、项目与套餐限制。

上游Vinext README中通用的output建议与不同Nitro版本可能有差异；这里采用本次实际生成的Build Output API目录，不根据旧教程填 `.next` 或不存在的目录。

Cloudflare：`vite.cloudflare.config.ts` 保留原配置与Sites插件，`npm run build:cloudflare` 走独立配置。原 `.openai/hosting.json`、`worker/index.ts`、SQLite schema及drizzle迁移保留。Vercel与Cloudflare分别解析 `#runtime`，不共享服务端凭据。

## 3 PostgreSQL 配置

推荐Neon托管PostgreSQL，Vercel使用与数据库接近的区域。也可使用支持标准TLS PostgreSQL连接和事务的托管服务。应用使用 `pg` 有界连接池（每个函数实例最多3连接）与 Drizzle node-postgres 驱动；生产使用提供商的池化连接地址，迁移使用独立直连/迁移角色。

1. 创建独立Preview数据库或分支，勿连接已有正式数据库。
2. 通过提供商控制台把池化URL设为Preview环境的 `DATABASE_URL`，保持证书验证，通常使用 `sslmode=require`。不要设置 `rejectUnauthorized: false`。
3. 在授权的本地终端，设置 `DATABASE_MIGRATION_URL` 并运行 `npm run db:migrate:postgres`。脚本使用事务、迁移锁和SHA校验；重复已应用迁移会核对哈希。它不会在Vercel构建时自动执行。
4. 新建Production环境及独立凭据，正式切换前另行初始化并检查。Preview不能复用Production URL或备份桶。

`db/schema.postgres.ts` 保留字段编码，原0/1标记仍为integer，JSON仍为text，ISO日期仍为text，避免改变导出和恢复语义。毫秒时间戳、时长与大小使用bigint，读取时检查JS安全整数。流水号使用bigserial；participants额外rowid只用于稳定排序，不作为新的研究变量。

`lib/runtime/postgres.ts` 提供原有prepare/bind/first/all/run/batch调用形状，继续参数绑定，并将已审计查询里的`?`转为`$n`、`INSERT OR IGNORE`转为`ON CONFLICT DO NOTHING`。不是通用SQLite兼容层；新增SQL必须增加测试。未将SQLite迁移直接送进PostgreSQL。

并发与快照：分组用全局事务级advisory lock；单被试写流程按内部ID串行；材料发布串行；batch原子执行。完整备份在REPEATABLE READ事务中读取六表，避免跨表快照时点不一致。连接池及托管服务总连接配额仍需在远端验收。

## 4 私有对象存储配置

推荐AWS S3或其他经过兼容性验证的独立S3服务；数据库、网站与备份可分属不同服务。Vercel不再读取R2绑定或依赖 `cloudflare:workers`。

- 新建私有桶，启用Block Public Access；不要设置公开ACL或公开桶策略。
- 应用角色仅授予指定桶/前缀的PutObject、GetObject权限，不授予管理桶和公开权限。
- 可启用版本控制、服务端加密与合适保留策略。当前程序不自动删除历史快照。
- 备份始终通过受主试口令保护的API下载，不给浏览器暴露对象存储凭据或公开URL。
- `BACKUP_S3_*`为主备份。可配置另一个服务/账户的 `SECONDARY_S3_*`：配置后只有两份写入都成功才标记备份完成；第二份失败会记录失败并允许重试，已有副本不删除。
- 存储SDK测试使用本地签名HTTP夹具，**尚未代表真实云桶的权限、网络和加密验证通过**。

## 5 服务端环境变量

所有密钥只设置在Vercel服务端环境或授权本地终端，禁止加 `VITE_` / `NEXT_PUBLIC_` 前缀。示例见 `.env.vercel.example`，没有真实凭据。

| 变量 | 用途 | 环境 |
| --- | --- | --- |
| DATABASE_URL | 应用池化PostgreSQL连接 | Preview与Production分别设置 |
| ADMIN_TOKEN | 主试口令，建议长随机值 | 各环境独立 |
| BACKUP_S3_BUCKET | 主私有桶 | 各环境独立 |
| BACKUP_S3_REGION | S3区域 | 必填 |
| BACKUP_S3_ACCESS_KEY_ID | 最小权限访问密钥ID | 服务端必填 |
| BACKUP_S3_SECRET_ACCESS_KEY | 密钥 | 服务端必填 |
| BACKUP_S3_ENDPOINT | 非AWS兼容服务地址 | 可选 |
| BACKUP_S3_FORCE_PATH_STYLE | 需要path-style时设true | 可选 |
| BACKUP_S3_ENCRYPTION | AWS使用AES256服务端加密 | 可选，按提供商验证 |
| SECONDARY_S3_BUCKET / REGION / ACCESS_KEY_ID / SECRET_ACCESS_KEY | 第二份独立私有备份 | 整组可选，启用必须完整配置 |
| SECONDARY_S3_ENDPOINT / FORCE_PATH_STYLE | 第二服务地址与寻址 | 可选 |
| DATABASE_MIGRATION_URL | 执行迁移的连接 | 仅受控迁移终端，不要求给函数 |
| RESTORE_DATABASE_URL | 恢复演练目标库 | 仅受控恢复终端，默认不用正式库 |

`DB` / `BUCKET` 是旧Cloudflare绑定，不作为Vercel环境变量设置。安装和构建不需要真实数据库、桶密钥；缺少运行时配置时应返回失败，不能改用临时内存库假装保存成功。

## 6 备份与无覆盖恢复

自动备份仍在完成测验或发布材料成功后触发，十分钟内最多成功一次；Vercel使用 `@vercel/functions.waitUntil`，替代Workers的ctx.waitUntil。没有把任务改成客户端发起，也不是每题备份。失败可在后台查看并手动重试，收数结束应立即手动备份下载。函数异常终止仍可能留下处理中记录，不能宣称后台任务绝不丢失；十分钟锁租约到期后可重试。

新包仍包含原始六表与材料基线，以及SQLite恢复工具、PostgreSQL恢复工具、清单与哈希；支持校验旧四文件D1恢复包。原始作答时长、超时空值、编号映射和材料版本都保留。

PostgreSQL恢复流程：

1. 从旧后台创建备份并下载，另存独立副本；从可信后台记录取得SHA-256。
2. 使用Node.js24，安装pg依赖；运行 `node scripts/restore-postgres.mjs /路径/backup.zip`，默认只校验，不连库、不写入。
3. 在专门的恢复数据库设置 `RESTORE_DATABASE_URL`；运行 `node scripts/restore-postgres.mjs /路径/backup.zip --apply --schema restore_trial --expected-sha256 可信哈希`。
4. 只允许全新、以restore_开头的schema；已有同名schema会拒绝并回滚。工具不执行压缩包提供的任意SQL，而使用当前工具内/项目内已审计的PostgreSQL初始结构。
5. 校验表数量、原文、时长、空值、编号与材料版本；恢复工具保存基线材料到recovery_metadata，原始schema不被修改。
6. 线上切换是另一步：冻结旧入口、处理增量与未完成会话、核对后选择导入目标应用schema或明确配置搜索路径。此适配没有自动执行该步骤；不要以“隔离恢复成功”代替完整生产切换。

Vercel上传请求存在平台大小限制，因此本分支在线ZIP校验限制为4MiB，保留大包下载、SHA校验和最多100MiB的离线校验/恢复。Excel及备份下载使用流式响应；流式输出解决响应缓冲限制，但仍需在真实Vercel上验收大文件与函数内存。原Cloudflare线上校验上限保持100MiB。

## 7 本地验证与远端验收

本地执行记录见 `docs/VERCEL_TEST_REPORT.md`，不能将本地生产产物测试当作Vercel Preview已成功。

真实Preview步骤：

1. 在Vercel导入仓库，选择本适配分支，按第2节清除旧Next.js设置。
2. 只设置Preview数据库、私有桶与主试口令。先完成目标库迁移。
3. 发布Preview，保留部署保护；用主试授权进行全流程试测。
4. 逐项检查六种条件、原题序、刷新续答、断网后重试、重复提交、30秒时限、后台详情和筛选、Excel一人一行、自动及手动备份、下载校验和隔离恢复。
5. 检查日志有无Cloudflare运行时导入错误；检查桶确实拒绝未授权GET，Preview不会写Production。
6. 通过后才将 `yuqing-lab.top` 绑定目标Production项目，并按Vercel实际提供的DNS记录配置。不要先改DNS再找数据库。

当前大陆网络可达性尚未实测；使用自有域名和Vercel并不等于所有大陆运营商、地区和设备都稳定可访问。正式招募500—1000人前应从目标网络试测。

## 8 修改文件与原因

| 文件 | 修改原因 |
| --- | --- |
| package.json / package-lock.json / pnpm-lock.yaml | 固定Nitro与pg、S3、Vercel运行时依赖，添加构建/迁移/测试命令 |
| vite.config.ts / vercel.json / scripts/build-vercel.mjs | 生成Vercel Build Output，避免Next.js自动检测 |
| vite.cloudflare.config.ts / scripts/run-framework.mjs / scripts/build-verified.sh | 独立保留Cloudflare配置，构建时明确选择文件 |
| lib/runtime/cloudflare.ts / vercel.ts | 分离环境来源、事务边界与后台任务生命周期 |
| lib/runtime/postgres.ts / db/index.ts | PostgreSQL驱动、Drizzle实例、占位符/冲突语法与事务适配 |
| db/schema.postgres.ts / drizzle-postgres/0000_initial.sql / drizzle.postgres.config.ts | 独立PG结构与迁移，不改原SQLite迁移 |
| scripts/migrate-postgres.mjs / postgres-schema-generator.py | 显式迁移、哈希校验；从原迁移构建初始方言结构 |
| lib/runtime/storage.ts | 独立私有S3上传与流式下载，使用服务端凭据 |
| app/api/experiment/route.ts | 运行时抽象、只读详情、流式Excel；原分配/题目顺序/评分逻辑保留 |
| app/api/materials/route.ts | 运行时抽象与材料发布事务边界 |
| app/api/backups/route.ts / app/researcher/backups/route.ts | 运行时抽象，按平台约束提示在线上传限额 |
| app/researcher/route.ts | 补充单被试只读详情入口 |
| lib/backups.ts / lib/backup-assets.ts | 一致性快照、可选第二份备份、附PG工具，兼容原恢复格式 |
| scripts/restore-postgres.mjs | 无覆盖校验与新schema恢复，重置短编号序列 |
| scripts/test-experiment.mjs / test-postgres.mjs / test-storage.mjs / test-built-vercel.mjs / test-volume.mjs / test-native-local.sh | 原回归、PG实际SQL与并发、S3协议、生产产物与容量检查 |
| .gitignore / .env.vercel.example | 排除输出与秘密，提供无真实值的服务端环境样例 |
| DEPLOYMENT.md / docs/VERCEL_DEPLOYMENT.md / docs/VERCEL_TEST_REPORT.md | 部署步骤、环境清单、缺口与真实验收状态 |

原实验HTML、materials.json、量表、题序、题目文字和研究变量未修改。主分支没有合并该适配。

## 官方参考

- https://github.com/cloudflare/vinext#other-platforms-via-nitro
- https://nitro.build/deploy/providers/vercel
- https://vercel.com/docs/frameworks/backend/nitro
- https://neon.com/docs/guides/vercel-overview
- https://neon.com/docs/guides/node
- https://orm.drizzle.team/docs/connect-neon
- https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
