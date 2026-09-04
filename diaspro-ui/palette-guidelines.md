# Rules for UI Design & Color Palette in Diaspro Viboard

Whenever creating or modifying React components or UI elements for Diaspro Viboard, you MUST strictly adhere to the official color palette and design system defined in `src/index.css`. NEVER use generic dark purples, blacks, or arbitrary Tailwind gradients outside of the official tokens.

## Official Palette Tokens & Colors

- **Canvas Background (`--bg-canvas`)**: `#1e1333`
- **Card Background (`--bg-canvas-card`)**: `#2b1c47`
- **Sidebar Purple (`--sidebar-purple`)**: `#6B5887`
- **Lavender Accent (`--palette-lavender`)**: `#9D85C6`
- **Plum Accent (`--palette-plum`)**: `#7A3F67`
- **Terracotta Accent (`--palette-terracotta`)**: `#8F5A5A`
- **Warm Sand Accent (`--palette-warm-sand`)**: `#BC957D`
- **Sand Accent (`--palette-sand`)**: `#E8D19E`
- **Blue Accent (`--palette-blue`)**: `#A5C4DC`
- **Sage Accent (`--palette-sage`)**: `#98A78A`

## Design System Guidelines

1. **Background Contrast**: Use `#1e1333` for main canvas backgrounds and `#2b1c47` for containers/cards.
2. **Borders & Highlights**: Use `#7A3F67` or `#9D85C6` with transparency (e.g., `border-[#7A3F67]/50` or `border-[#9D85C6]/40`).
3. **Primary Accent Text**: Use `#E8D19E` (Sand) for highlighted titles, pills, badges, and primary callouts.
4. **Secondary Text**: Use `#A5C4DC` (Blue) or `#9D85C6` (Lavender) for subtitles and descriptive text.
5. **Success / Confirmation Elements**: Use `#98A78A` (Sage) for success badges and approved action buttons.
6. **Typography**: Headings must use `font-heading` (`Outfit`), body uses `font-sans` (`Inter`), and code snippets use `font-mono` (`JetBrains Mono`).
