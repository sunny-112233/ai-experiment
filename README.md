# AI建议判断实验平台

心理学研究实验平台，包含被试端、研究者后台、材料编辑与版本管理、逐题保存、Excel导出及完整数据备份。

## 研究条件

六套施测程序：研究一为医学/户外常识培训，研究二为医学/户外专业知识培训，研究三为研究一两套材料的时间压力版。系统自动分配条件并尽量平衡人数，题序按材料规定保留。

## 页面

- `/`：被试实验入口。
- `/researcher`：记录筛选、分页和多被试Excel导出，每名被试一行。
- `/researcher/materials`：草稿编辑、预览和版本发布。
- `/researcher/backups`：完整备份、下载与校验。
- `/researcher/fields`：字段说明。

## 技术与运行

当前版本采用 TypeScript、Vinext、Cloudflare Workers、D1数据库及R2备份存储。源码推送到GitHub不会自动迁移数据库，也不会自动上线。

本地开发可使用Node.js 24及项目锁文件安装依赖，运行 `npm run dev`。本地D1需先执行 `drizzle/` 下的全部迁移，按编号顺序执行；后台需要在本地 `.dev.vars` 设置 `ADMIN_TOKEN`。不要提交该文件。测试命令：`node scripts/test-experiment.mjs`，测试使用内存数据库，不操作线上记录。构建命令：`npm run build`。

部署与迁移前请阅读 [DEPLOYMENT.md](DEPLOYMENT.md)。框架原始说明见 [STARTER_NOTES.md](STARTER_NOTES.md)，变量说明见 [DATA_DICTIONARY.md](DATA_DICTIONARY.md)。

## 数据与访问口令

仓库仅包含程序、问卷材料、数据库结构和测试代码，不包含现有被试记录、云端备份包、后台实际口令或云服务密钥。测试文件中的固定口令仅供内存测试。

建议仓库保持私有，防止未公开的实验材料提前泄露。已有数据请通过后台备份功能单独保留，勿放入Git仓库。
