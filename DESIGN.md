# AtApp — Design (v2)
### Visual identity: "Hall Pass v2"

## 0. The Thesis

Every part of this app is really about one small paper ritual: the moment a teacher hands you permission to be counted as present. A hall pass. A punch card. A stamp in a passport.

**Hall Pass v2** simplifies and updates this visual system. It moves away from the multi-colored pastel rainbow to a strict **3-color palette** (Primary, Secondary, Background) backed by crisp monochrome iconography. Layout structures rely on sharp, highly visible clickable items and dynamic collapsible containers to streamline the desktop user experience.

## 1. Token System

### Color — "3-Color Palette"

| Token | Hex | Role |
|---|---|---|
| **Background** | `#06080E` | Foundational obsidian canvas — dark, structured grid background |
| **Secondary** | `#121620` | Card surfaces, container cards, table cells, inactive panels, and input boxes |
| **Primary** | `#4F46E5` | Active states, primary interactive focus, buttons, active highlights, and indicators |

- **Contrast Divider**: `#F8F6F0` (Off-white) is used as a sharp, high-contrast border line on outer panels (like sidebar dividers) to demarcate active workspaces.
- **Thick Outlines**: All interactive elements feature a solid near-black or sharp contrast border to retain a tactile, hand-drawn paper quality.

### Typography

| Role | Face | Why |
|---|---|---|
| Display / headlines | **Fraunces** (bold, serif) | Ceremonial, stamped weight, avoided for body copy |
| Body | **IBM Plex Sans** | Clean, legible, quietly institutional |
| Codes / numbers | **IBM Plex Mono** | Standard width alignment, legible from a distance |

### Iconography — "Monochrome & Premium"

- **No Colored Emojis**: Emojis are completely banned.
- **Single-Color Icons**: All icons render in monochrome (either primary accent, text color, or muted slate grey) to keep visual attention focused on dashboard data metrics rather than competing colored graphics.
- **Consistent Scaling**: Icons are set to standard sizes (16px, 20px, or 24px) inside uniform containment circles.

## 2. Interaction Guidelines

### Collapsible Sidebar
- The layout adapts to the administrator's viewport preference.
- A dedicated toggle button slides the sidebar panel between **Expanded** (280px) and **Collapsed** (80px) modes.
- Text labels fade out smoothly when collapsed, leaving centered monochrome icons.

### Visible Clickables
- Buttons must clearly look like buttons: they feature a solid border, high-contrast text, and a distinct flat drop-shadow.
- Hover states translate elements slightly up-left (simulating hover height), while active press states translate down-right (flattening the shadow to indicate a successful click).
