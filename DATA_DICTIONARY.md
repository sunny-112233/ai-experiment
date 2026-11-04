# 实验数据字段

| participant_id | 匿名被试编号 | 服务端随机生成，不含姓名 |
| study | 研究编号 | 1=常识；2=专业知识；3=常识时间压力 |
| training_domain | 培训领域 | medical=医学；outdoor=户外 |
| training_type | 培训类型 | common_sense=常识；professional=专业知识 |
| questionnaire_version | 问卷版本 | A=医学培训；B=户外培训；固定题序 |
| time_pressure | 时间压力 | none=不限时；high=高压力；研究三仅high |
| time_limit_ms | 单题时限 | 研究三30000；其他为空 |
| material_version | 材料版本 | 当前2026-11-03-v5 |
| recruitment_batch | 招募批次 | 当前pilot-01，测试阶段 |
| mode | 数据模式 | 当前test；不用于正式分析 |
| started_at | 会话开始时间 | UTC ISO8601 |
| training_duration_ms | 培训阅读时长 | 毫秒；首次提交阅读时长 |
| completion_status | 完成状态 | training/tasks/quiz/completed |
| demographics | 个人信息 | JSON：sex、age、education |
| knowledge_quiz | 知识测验 | JSON数组，依次为最后五题的A/B/C/D |
| completed_at | 完成时间 | UTC ISO8601；未完成为空 |
| task_id | 统一题号 | MEDICAL_01至19；OUTDOOR_01至19 |
| source_question_no | 问卷内题号 | 1至38，保留原卷顺序 |
| task_domain | 任务领域 | medical/outdoor |
| task_position | 呈现位置 | 1至38 |
| scenario | 情境原文 | 第一人称情境 |
| ai_advice | AI建议原文 | 固定材料，未实时调用AI |
| advice_correctness | 建议正确性 | 尚无研究者编码表，暂为空；不得当成错误建议 |
| adoption_score | 采纳评分 | 1至7；超时为空，不能按0分处理 |
| response_time_ms | 本次页面作答时长 | 毫秒，浏览器计时；刷新后从重新呈现开始 |
| server_elapsed_ms | 服务器题目经过时长 | 毫秒，从首次请求该题至收到提交，包含网络和刷新间隔 |
| timeout | 是否超时 | 1=超时；0=未超时 |
| missing | 是否缺失 | 1=评分缺失；0=评分有效 |
| task_presented_at | 本次页面呈现时间 | 客户端UTC ISO8601 |
| advice_fully_visible_at | 回复完全显示时间 | 客户端UTC ISO8601；动画未结束为空 |
| client_submitted_at | 客户端提交时间 | UTC ISO8601 |
| server_saved_at | 服务器保存时间 | UTC ISO8601 |
| animation_duration_ms | 预设动画时长 | 900毫秒；计入30秒时限 |

按研究1/2/3等概率分配，各研究内A/B等概率分配。服务器开始题目后，研究三30秒到时评分为空；传输接收容差2秒，客户端仍严格30秒。未提交的题目不生成评分记录。当前mode=test，批次pilot-01。管理员口令仅在服务端环境中保存。
