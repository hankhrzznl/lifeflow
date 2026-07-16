// ============================================================
// 模板入口 — 统一注册所有模板
// 在应用启动时导入此文件即可注册所有模板
// ============================================================

import './exam';
import './fitness';
import './habit';
import './savings';

export { templateEngine, TemplateEngine } from '../TemplateEngine';
export type { TemplateDefinition, TemplateBlueprint, ParameterSchema } from '../TemplateEngine';
