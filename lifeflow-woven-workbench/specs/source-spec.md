# LifeFlow "织光者的工作台" 完整设计规范

产品名称：LifeFlow
定位：单人全场景人生管理工具
设计语言名称：织光者的工作台
核心隐喻：人生是一团乱线，用户在织出秩序
IP形象：小织（一只拿着毛线针的小狐狸）

## 色彩系统

### 桌面/背景色
- --surface-desk: #D4C5B5（木桌底色）
- --surface-desk-light: #E8DDD4（浅木色）
- --surface-fabric: #F5F0E8（布料底色）
- --surface-fabric-hover: #EDE7DB（布料悬停色）

### 品牌色
- --brand-primary: #E88D67（毛线橙）
- --brand-primary-hover: #D97A54
- --brand-primary-light: #FDE8E0
- --brand-secondary: #8B6F5E（编织棕）
- --brand-secondary-hover: #7A6050

### 语义色
- --success: #7CA982（松叶绿）
- --success-light: #E8F0EA
- --warning: #D4736E（蜡线红）
- --warning-light: #F9E5E3
- --info: #7BA3C7（线团蓝）
- --info-light: #E3EDF5

### 文字色
- --text-primary: #3D342E
- --text-secondary: #6B5E54
- --text-tertiary: #A39E99
- --text-inverse: #FAF6F0

### 边框/分割线
- --border: #D4C5B5
- --border-light: #E8DDD4
- --border-dashed: #C4B5A5

### 编织进度条专用色
- --knit-thread: #E88D67
- --knit-thread-completed: #7CA982
- --knit-thread-partial: #F5C542
- --knit-bg: #E8DDD4
- --knit-grid: #C4B5A5

## 字体系统
- 标题/装饰：ZCOOL KuaiLe 或 LXGW WenKai
- 正文：-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- 代码/数据：ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace

字号: display 36px / h1 24px / h2 20px / h3 18px / body 16px / body-sm 14px / caption 12px
字重: normal 400 / medium 500 / semibold 600 / bold 700
行高: tight 1.25 / normal 1.5 / relaxed 1.75

## 间距系统
4px基数: xs 4px / sm 8px / md 12px / lg 16px / xl 24px / 2xl 32px / 3xl 48px

## 圆角系统
none 0 / sm 4px / md 8px / lg 12px / xl 16px / full 9999px

## 阴影系统
shadow-sm: 0 1px 2px rgba(61,52,46,0.05)
shadow-md: 0 4px 6px rgba(61,52,46,0.08)
shadow-lg: 0 8px 16px rgba(61,52,46,0.12)
shadow-knit: 0 2px 0 #C4B5A5

## 组件
- Button (4 variants)
- Card (3 variants: GoalCard, TaskCard, StatCard)
- KnittingProgress
- MascotIllustration (5 states)
- EmptyState
- BottomNavigation (5 tabs + FAB)
- CheckInPanel

## 动画
- 织一针动画
- 布料完成动画
- 页面过渡动画
- 空状态入场动画
