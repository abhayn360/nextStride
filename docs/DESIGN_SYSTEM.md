# NEXT STRIDE Design System

**Every Run. A Step Forward.** The look is premium, minimal, athletic and technology-driven. Dark is the primary brand experience; light is fully supported.

All tokens live in [`apps/mobile/src/theme`](../apps/mobile/src/theme). Screens never hardcode colours, spacing or type. They use `useTheme()` and `useThemedStyles()`, and get components from `@/components/ui`.

```tsx
const styles = useThemedStyles((t) => ({
  card: { backgroundColor: t.colors.card, borderRadius: t.radius.card, padding: t.spacing.lg },
}));
```

## Colour

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `background` | `#111820` | `#F3F4EF` | Screen background |
| `backgroundSecondary` | `#1A232C` | `#E9ECE6` | Inputs, tab bar, chips |
| `card` | `#252F39` | `#FFFFFF` | Cards, list groups |
| `elevated` | `#202B35` | `#FFFFFF` | Modals, sheets |
| `border` | `#303C47` | `#DCE2D9` | Hairlines, outlines |
| `textPrimary` | `#FFFFFF` | `#111820` | Body and headings |
| `textSecondary` | `#AAB4BE` | `#64748B` | Supporting text |
| `accent` | `#D7FF64` | `#83A92E` | Primary actions, progress, selection |
| `accentText` | `#D7FF64` | `#56731A` | Accent used as text (contrast-tuned in light) |
| `onAccent` | `#111820` | `#111820` | Content on accent surfaces |
| `success` / `warning` / `error` / `info` | `#22C55E` / `#F59E0B` / `#EF4444` / `#38BDF8` | same | Semantic states |

Brand palette (`palette`): Midnight `#111820`, Electric Lime `#D7FF64`, Slate `#252F39`, Off White `#F3F4EF`, White `#FFFFFF`.

> Light-mode accent `#83A92E` is only about 2.6:1 against Off White, so text in that colour uses `accentText` (`#56731A`, about 5:1). Text on accent surfaces always uses Midnight.

## Typography

Inter, loaded in the root layout. Weight is set through the font family, not `fontWeight`, so it renders correctly on Android.

| Variant | Size / weight | Use |
| --- | --- | --- |
| `hero` | 32 bold | Onboarding and hero headings |
| `title` | 26 bold | Screen headings |
| `section` | 20 semibold | Section headings |
| `cardTitle` | 16 semibold | Card headings |
| `bodyLarge` | 16 regular | Lead paragraphs |
| `body` | 14 regular | Body text |
| `label` | 14 medium | Form labels, list values |
| `button` | 15 semibold | Button labels |
| `caption` | 12 regular | Secondary text |
| `overline` | 12 semibold, uppercase, tracked | Eyebrows, section labels |
| `statSmall` / `stat` / `statLarge` | 36 / 40 / 48 bold, **tabular numerals** | Running statistics |

Use `<Text tabular>` or the `stat*` variants for any distance, duration or pace.

## Spacing, radius, elevation

- **Spacing:** a 4px grid. `xxs` 4 · `xs` 8 · `sm` 12 · `md` 16 · `lg` 20 · `xl` 24 · `2xl` 32 · `3xl` 40 · `4xl` 48. Screen gutters use `xl`.
- **Radius:** button 10 · input 12 · card 16 · cardLarge 20 · modal 24 · pill 999.
- **Shadows:**
  - Dark mode relies on tonal surfaces and borders. Only floating layers (`lg`) cast a shadow.
  - Light mode uses a subtle `sm` on cards.

## Motion

Motion is restrained: `fast` 150 ms, `base` 250 ms, `slow` 400 ms, `reveal` 700 ms, eased with `standard` (cubic-bezier 0.2, 0, 0, 1).

- **Presses:** a 0.97 scale.
- **Screens:** enter with a short fade-up.
- **Illustrations and progress:** animate once, when they come into view.

## Components (`@/components/ui`)

| Component | Notes |
| --- | --- |
| `Button` | `primary` (lime), `secondary` (outline), `text`, `danger`. Sizes `lg` / `md`, plus loading and icons. Haptic feedback on primary |
| `IconButton` | `ghost` / `filled` |
| `TextField` | Label, helper, error, leading icon, trailing slot, password reveal. Lime focus ring |
| `Card` | `filled` / `outline` / `accent`; `size="large"`; pressable |
| `StatCard` | Statistic with label, unit and icon, using tabular numerals |
| `Chip` / `ChipGroup` | Selectable pills, or static tags |
| `OptionCard` | Radio-style option with a description |
| `SegmentedControl` | Animated thumb |
| `ProgressBar` / `ProgressRing` | Animated, accessible (`progressbar` role) |
| `ListSection` / `ListItem` | Grouped settings rows, with value, chevron or toggle |
| `Avatar` | Image or initials, with edit badge and loading overlay |
| `AppModal` / `BottomSheet` | Confirmation dialog and contextual action sheet |
| `Skeleton`, `LoadingState` | Loading states |
| `EmptyState`, `ErrorState`, `Banner` | Empty, error and inline notice states |
| `Screen` | Safe areas, scroll, keyboard avoidance, pinned footer |
| `ScreenHeader`, `TabBar` | Navigation chrome, identical on iOS and Android |

Running components (`@/components/run`, `@/components/map`):

| Component | Notes |
| --- | --- |
| `RouteMap` | MapLibre map with route line, start (green) and finish markers, and live position. Dark or light tiles follow the theme |
| `RouteSketch` | Tile-free SVG route for list thumbnails and the no-MapLibre fallback |
| `GpsBadge` | Signal bars and label: strong / fair / weak / lost |
| `HoldButton` | Press-and-hold confirmation with a filling ring. Screen readers get a dialog instead |
| `RunCard` | Activity row: route thumbnail, title, date, distance, time, pace, upload state |
| `BarChart` | Daily, weekly and monthly distance bars. The current period is in lime |

Live statistics use `statLarge` with tabular numerals, so digits don't shift as they tick.

Brand components (`@/components/brand`) are `LogoMark`, `Wordmark`, `Logo`, `BrandRings` and the onboarding illustrations.

> Achievement and goal cards are deliberately left for the phases that introduce those features. They should be built from `Card`, `StatCard`, `ProgressRing` and `Chip` so the system stays consistent.

## Rules

1. Dark theme first; every screen must also work in light.
2. Electric Lime marks important actions and progress, and nothing else.
3. No gradients and almost no shadows. Use surfaces and hairlines.
4. Generous whitespace, one primary action per screen, pinned to the bottom.
5. Every interactive element has an accessibility role and label, and a touch target of at least 40px.
