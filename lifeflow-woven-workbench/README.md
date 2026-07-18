# LifeFlow Design System — 织光者的工作台

A design system for **LifeFlow** — a personal life management tool that turns goals into woven fabric. The "Weaver's Workbench" visual language is warm, handcrafted, and deliberately imperfect, as if every interface element was stitched together on a wooden desk by lamplight.

## Source

User-provided structured design specification, covering 9 components and a complete CSS token system. No Figma source file was provided — the system is reconstructed from explicit design directives, brand constraints, and component anatomy definitions.

## What this covers

- **Foundations** — a 6-group color palette anchored to warm earth tones, a three-font typography stack with handwritten display, 4px-base spacing with page-level breakpoints, a 6-stop radius scale from 4px to pill, and 4 elevation shadows including the signature knit-card solid-bottom style.
- **Components** — 9 documented components including the signature knitting-progress bar, check-in panel, goal/task/stat cards, empty state, button system, bottom nav, and mascot illustration. Each has live preview HTML and a JSON contract.
- **Mobile app kit** — components and patterns optimized for a mobile-first Chinese-language productivity app, with weaving metaphors woven into every interaction.

---

## Content Fundamentals

### Voice & tone

LifeFlow speaks in warm, encouraging, handcrafted Chinese. The voice is personal and intimate — it addresses the user as "你" and frames every action through weaving and knitting metaphors. Scheduling becomes "织" (weaving), tasks are "针" (stitches), and completed goals emerge as "布料" (fabric). The mascot "小织" — a small fox holding knitting needles — is the brand's narrative anchor, speaking in a playful, slightly imperfect tone that makes goal-tracking feel like companionship rather than chore. No corporate or cold language. No detached third-person. Everything reads like a note from a friend sitting across the workbench.

### Concrete copy examples

- 按钮: "织完这一针" (complete this stitch) instead of "提交"
- 空状态: "还没开始织呢" "点击下方的线团，开始你的第一块布料吧"
- 进度: "35%" with handwritten font
- 完成: "这块布料织完了！"

### When generating copy

Use knitting/textile metaphors consistently — every UI surface is an opportunity to reinforce the weaving narrative. Keep every message encouraging and personal. Address the user as "你". Use the handwritten/imperfect tone for headings and key numbers. Never use "提交/确认/取消" as standalone button labels — always contextualize within the weaving metaphor. Progress numbers and completion stamps should feel handwritten, not mechanical.

---

## Visual Foundations

### Color

The palette is built entirely from warm earth tones — no cool blues or cyans appear anywhere in the system. The defining color is primary 毛线橙 `#E88D67`, a warm terracotta-orange that anchors the brand on buttons, active states, progress fills, and the mascot's fur. Its hover darkens to `#D97A54`. Secondary 编织棕 `#8B6F5E` provides grounding depth for borders and ghost text, with a darker `#7A6050` hover.

Three semantic colors serve status communication: 松叶绿 `#7CA982` for success and completion states, 蜡线红 `#D4736E` for warnings and overdue indicators, and 线团蓝 `#7BA3C7` for informational cues. Each has a corresponding light tint (`#E8F0EA`, `#F9E5E3`, `#E3EDF5`) used as card and badge backgrounds.

Surfaces follow a warm gradient of wood and fabric: 木桌 `#D4C5B5` as the deepest working surface, 浅木 `#E8DDD4` as the lighter base, 布料 `#F5F0E8` as the primary card background (with `#EDE7DB` hover). Brand primary-light `#FDE8E0` serves as the soft orange wash for active badges and hover states.

Text runs a warm brown hierarchy: `#3D342E` for primary, stepping down through `#6B5E54` secondary to `#A39E99` (针尖灰) tertiary. Inverse text is `#FAF6F0`, a warm off-white. Borders mirror the surface tones — `#D4C5B5` solid, `#E8DDD4` light, `#C4B5A5` dashed.

A dedicated knit color group powers the signature progress bar: `#E88D67` for active thread, `#7CA982` for completed, `#F5C542` for partial/paused, with `#E8DDD4` as the knit background grid and `#C4B5A5` as the grid lines.

### Typography

The display face is **ZCOOL KuaiLe** — a playful, slightly irregular handwritten Chinese font from Google Fonts that turns every heading and stat number into a personal, crafted mark. It falls back to **LXGW WenKai** and then to `cursive` when fonts are unavailable. All headings from h1 to h2 use this display face; h3 switches to the body stack for readability at smaller sizes. Body text runs on the standard system sans-serif stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. A mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`) is reserved for code and data.

The scale spans 7 stops: display at 36px, h1 at 24px, h2 at 20px, h3 at 18px, body at 16px, body-sm at 14px, caption at 12px. Weight usage is deliberate and restrained — normal 400 for body text, medium 500 on buttons for a touch of emphasis without feeling heavy, semibold 600 for h2 and h3 headings, and bold 700 reserved exclusively for display-size numbers and h1. Line heights are tight at 1.25 for display and headings (preserving the handwritten compactness), normal at 1.5 for body and caption, relaxed at 1.75 for mono.

### Spacing

A 4px base unit drives the entire spacing system. The token scale runs: 4px (xs), 8px (sm), 12px (md), 16px (lg), 24px (xl), 32px (2xl), 48px (3xl). Card padding sits at 16-24px, card gaps at 12-16px. Page margins follow device breakpoints: 16px on mobile, 24px on tablet, 32px on desktop. Controls default to 40px height (btn-md) with a compact 32px size and an expanded 48px for primary actions.

### Radius

Six deliberate stops, no accidental values: 0 (sharp, unused in practice), 4px for tags and small controls, 8px for buttons and inputs — soft but structured, 12px for cards, 16px for large cards and modals, and 9999px for avatars and the floating action button. The progression from 4px through 16px creates a clear visual hierarchy: tighter radii feel more functional and interactive, larger radii feel more spacious and content-focused. The pill radius is exclusive to circular elements — it is never applied to rectangular controls.

### Shadow / Elevation

Four elevation levels, all using warm brown shadows that reinforce the "lit-from-above" workspace metaphor. Shadow-1 (`0 1px 2px rgba(61,52,46,0.05)`) provides barely-there lift for subtle separation. Shadow-2 (`0 4px 6px rgba(61,52,46,0.08)`) is the standard card shadow — enough depth to separate from the fabric surface without feeling heavy. Shadow-3 (`0 8px 16px rgba(61,52,46,0.12)`) creates modal and overlay depth with a noticeable but warm drop. Shadow-4 is the system's signature: `0 2px 0 #C4B5A5` — not a blur shadow at all, but a solid 2px bottom edge in dashed-border brown that gives knit cards the physical feel of stacked fabric layers on a wooden desk. This is the only elevation level that uses a solid color instead of a blur, and it is reserved exclusively for cards that contain knitting progress content.

---

## Component Patterns

| Component | Key Facts | Key Insight |
|---|---|---|
| **button** / 按钮 | 4 variants: primary (毛线橙 fill), secondary (编织棕 border), ghost (transparent), icon (circular). 3 sizes: sm-32px, md-40px, lg-48px. Success state replaces fill with 松叶绿. | Buttons never use radius-full — even the icon variant stays in the 4-8px radius range, keeping the feel handcrafted rather than pill-shaped generic. |
| **goal-card** / 目标卡片 | 布料底卡片, embeds knitting-progress bar inline, 手写体标题, 底部操作栏 with icon buttons, 3 state badges (active/已完成/暂停) with corresponding light-tint backgrounds. | The card itself is a piece of "布料" — the surface-fabric background and shadow-2 elevation give it a physical textile quality that the knit progress bar completes. |
| **task-card** / 任务卡片 | Compact list row, 编织网格 checkbox with grid-pattern fill, overdue state adds a dashed red warning border. Checkbox cycles through pending/in-progress/completed with distinct visual treatments. | The checkbox is not a standard tick box — it mimics the knit grid texture in its intermediate state, visually tying the smallest interaction to the weaving metaphor. |
| **stat-card** / 统计卡片 | Three background tints (primary-light, success-light, warning-light) for active/已完成/暂停 states. Large handwritten display numbers paired with small caption labels. | The handwritten number font makes stats feel personal and hand-counted rather than dashboard-analytical. The card coloring follows the same semantic scheme as goal-card badges. |
| **knitting-progress** / 编织进度条 | Core differentiator. CSS grid overlay (repeating 6px columns with 1px lines) on a knit-bg track. Fill color varies by state: active (毛线橙), partial (暖黄), done (松叶绿), overdue (蜡线红). A circular yarn ball indicator tracks the fill edge. Right-aligned handwritten percentage or completion stamp. | The grid is not decorative — it is the weave pattern itself. The yarn ball at the fill edge and the handwritten percent create the illusion of a physical knitting project being measured, not a digital progress bar. |
| **check-in-panel** / 打卡面板 | Sticky-note-style overlay panel. Features a tape strip at the top-left corner (rotated -3deg), 10-step mood rating with circular buttons, divider, input field for notes, and dual action buttons including the primary "织完这一针". Completed state shows a success checkmark and completion message. | The tape graphic and paper-like shadow-3 create a physical sticky-note metaphor. The 10-step mood rating is deliberately tactile — each step is a tap-able circle that fills with primary orange, turning emotional check-in into a small ritual. |

---

## Index

- `colors_and_type.css` — complete CSS variable system, drop-in ready with `@import` for ZCOOL KuaiLe
- `css.json` — machine-readable token extraction
- `components.css` — aggregated component CSS with anatomy comments for all 9 components
- `components/` — 9 component JSON contracts (schema v2)
- `preview/` — 9 component preview HTML pages with live rendering
- `SKILL.md` — agent skill manifest and quick-reference entry point

---

## Caveats / known substitutions

1. **ZCOOL KuaiLe** is a Google Font loaded via CDN `@import`. When loading offline or in environments without internet access, the font falls back to LXGW WenKai and then to browser cursive — handwriting quality degrades gracefully but the personal tone is preserved. For offline-first builds, bundle the font file locally.

2. **Mascot illustrations** (小织 the fox) are built entirely from CSS — `div` elements with borders, transforms, and dashed outlines approximating hand-drawn art. These are functional placeholders for layout and interaction testing. For production, replace with actual illustrator-drawn SVG or raster assets. The CSS mascot does not scale well beyond 120x120px and has no animation states beyond idle/confused/celebrating CSS transforms.

3. **Knitting grid texture** on the progress bar uses CSS `repeating-linear-gradient` with fine 1px lines on a 6px repeat. This performs well on modern mobile browsers but may cause repaint overhead during high-frequency progress animations. For smooth 60fps yarn-ball animation on lower-end devices, consider a canvas-based or WebGL implementation of the knit pattern.

4. **No dark mode** is defined. The "织光者的工作台" metaphor fundamentally assumes a warm, well-lit workspace — the beige fabric surfaces, wood-tone borders, and warm brown text depend on a light background. A dark mode would require rethinking the entire surface hierarchy (the warm gradient from desk to fabric has no natural dark-mode equivalent) and validating that brand-primary #E88D67 retains its warmth against dark backgrounds.

5. **Status colors** (松叶绿 `#7CA982`, 蜡线红 `#D4736E`, 线团蓝 `#7BA3C7`) are tuned to sit harmoniously within the warm earth palette. They were designed alongside the brand colors and surface tones, not as standalone semantic tokens. Using them against cool gray or pure white backgrounds will produce unintended contrast mismatches — always pair with the designated light tints or fabric surfaces.

6. **Component completeness**: Bottom navigation, mascot illustration, and empty state components exist in `components.css` and `preview/` but are not exhaustively documented in this README's component patterns section. Refer to their preview HTML pages and JSON contracts for full variant coverage. The component count is correct (9 total); the section above highlights the 6 most architecturally significant components.
