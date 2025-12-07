# 🎨 OSYS Theme Standardization

## Theme Rules (UPDATED December 2025)

### Light Mode = Purple
- Primary: `#9333ea` (purple-600)
- Hover: `#7c3aed` (purple-700) 
- Light: `#a855f7` (purple-500)
- Text: `#9333ea`
- Background light: `#f3e8ff` (purple-100)
- Background lighter: `#faf5ff` (purple-50)
- Border: `#d8b4fe` (purple-300)

### Dark Mode = Orange
- Primary: `#ea580c` (orange-600)
- Hover: `#f97316` (orange-500)
- Light: `#fb923c` (orange-400)
- Text: `#f97316`
- Background: `rgba(249, 115, 22, 0.1)`

### Implementation
CSS overrides in `styles/osys-design-system.css` automatically convert `orange-*` classes to purple equivalents in light mode.

### Coding Pattern
Use the dual-theme pattern with Tailwind:
```tsx
className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
```
This will render as purple in light mode (via CSS override) and orange in dark mode.

### CSS Override Coverage (Light Mode → Purple)
- `bg-orange-50` → `#faf5ff` (purple-50)
- `bg-orange-100` → `#f3e8ff` (purple-100)
- `bg-orange-200` → `#e9d5ff` (purple-200)
- `bg-orange-500` → `#a855f7` (purple-500)
- `bg-orange-600` → `#9333ea` (purple-600)
- `bg-orange-700` → `#7c3aed` (purple-700)
- `text-orange-300` → `#d8b4fe` (purple-300)
- `text-orange-400` → `#c084fc` (purple-400)
- `text-orange-500` → `#a855f7` (purple-500)
- `text-orange-600` → `#9333ea` (purple-600)
- `text-orange-700` → `#7c3aed` (purple-700)
- `border-orange-300` → `#d8b4fe` (purple-300)
- `border-orange-500` → `#a855f7` (purple-500)
- `border-orange-600` → `#9333ea` (purple-600)
- `ring-orange-500` → `#a855f7` (purple-500)
- `focus:ring-orange-500` → `#a855f7` (purple-500)

## Color Standards Applied

