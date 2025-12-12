# Wild Card Creative Co. Color Palette Reference

## Primary Brand Colors

### Deep Burgundy (Primary Background)
- **Name**: Deep Burgundy
- **Hex**: `#2d1818`
- **RGB**: `rgb(45, 24, 24)`
- **HSL**: `hsl(0, 30%, 14%)`
- **CMYK**: `C:0 M:47 Y:47 K:82`
- **Pantone**: Closest - Pantone 19-1337 TPX (Dark Burgundy)

**Usage**: 
- Primary website background
- Main brand color for dark applications
- Business card backgrounds
- Header/footer sections

**Accessibility**: 
- Use white text for WCAG AA compliance (contrast ratio 12.6:1)

---

### Rich Burgundy (Secondary Background)
- **Name**: Rich Burgundy
- **Hex**: `#3a1818`
- **RGB**: `rgb(58, 24, 24)`
- **HSL**: `hsl(0, 41%, 16%)`
- **CMYK**: `C:0 M:59 Y:59 K:77`
- **Pantone**: Closest - Pantone 19-1334 TPX (Burgundy)

**Usage**:
- Secondary background sections
- Alternating content areas
- Card backgrounds
- Section dividers

**Accessibility**:
- Use white text for WCAG AA compliance (contrast ratio 10.8:1)

---

### Warm Burgundy (Accent)
- **Name**: Warm Burgundy
- **Hex**: `#4a1c1c`
- **RGB**: `rgb(74, 28, 28)`
- **HSL**: `hsl(0, 45%, 20%)`
- **CMYK**: `C:0 M:62 Y:62 K:71`
- **Pantone**: Closest - Pantone 19-1331 TPX (Cordovan)

**Usage**:
- Accent backgrounds
- Hover states
- Button backgrounds
- Highlighted sections

**Accessibility**:
- Use white text for WCAG AA compliance (contrast ratio 8.9:1)

---

## Secondary Colors

### Pure White (Primary Text)
- **Name**: Pure White
- **Hex**: `#ffffff`
- **RGB**: `rgb(255, 255, 255)`
- **HSL**: `hsl(0, 0%, 100%)`
- **CMYK**: `C:0 M:0 Y:0 K:0`

**Usage**:
- Primary text color on dark backgrounds
- Logo color on dark backgrounds
- Clean, high-contrast applications
- Button text on dark buttons

---

### Soft White (Secondary Text)
- **Name**: Soft White
- **Hex**: `#ffffff` at 70% opacity
- **RGB**: `rgba(255, 255, 255, 0.7)`
- **Effective Color on #2d1818**: `#b8b8b8` (approximate)

**Usage**:
- Secondary text, descriptions
- Subtle UI elements
- Less prominent information
- Placeholder text

**Accessibility**:
- Contrast ratio 4.8:1 on #2d1818 (WCAG AA compliant for large text)

---

## Color Combinations

### High Contrast Combinations (WCAG AAA)
1. **White on Deep Burgundy**: `#ffffff` on `#2d1818` (12.6:1)
2. **White on Rich Burgundy**: `#ffffff` on `#3a1818` (10.8:1)
3. **White on Warm Burgundy**: `#ffffff` on `#4a1c1c` (8.9:1)

### Medium Contrast Combinations (WCAG AA)
1. **Soft White on Deep Burgundy**: `rgba(255,255,255,0.7)` on `#2d1818` (4.8:1)

---

## CSS Variables

For consistent color usage across the website, use these CSS custom properties:

```css
:root {
  /* Primary Brand Colors */
  --color-deep-burgundy: #2d1818;
  --color-rich-burgundy: #3a1818;
  --color-warm-burgundy: #4a1c1c;
  
  /* Text Colors */
  --color-white: #ffffff;
  --color-soft-white: rgba(255, 255, 255, 0.7);
  
  /* Tailwind CSS Variables (already defined) */
  --background: 16 12 12; /* #2d1818 in HSL */
  --foreground: 0 0% 100%; /* #ffffff in HSL */
}
```

---

## Tailwind CSS Classes

The brand colors are integrated into the Tailwind configuration:

```css
/* Background Colors */
.bg-deep-burgundy { background-color: #2d1818; }
.bg-rich-burgundy { background-color: #3a1818; }
.bg-warm-burgundy { background-color: #4a1c1c; }

/* Text Colors */
.text-white { color: #ffffff; }
.text-white/70 { color: rgba(255, 255, 255, 0.7); }
```

---

## Print Color Specifications

### CMYK Values for Professional Printing

1. **Deep Burgundy**: C:0 M:47 Y:47 K:82
2. **Rich Burgundy**: C:0 M:59 Y:59 K:77
3. **Warm Burgundy**: C:0 M:62 Y:62 K:71
4. **White**: C:0 M:0 Y:0 K:0

### Pantone Equivalents (Closest Matches)

1. **Deep Burgundy**: Pantone 19-1337 TPX (Dark Burgundy)
2. **Rich Burgundy**: Pantone 19-1334 TPX (Burgundy)
3. **Warm Burgundy**: Pantone 19-1331 TPX (Cordovan)

*Note: These are approximate matches. For exact color matching in professional printing, provide the hex values or request a custom Pantone match.*

---

## Color Psychology & Brand Meaning

### Burgundy/Maroon Associations
- **Sophistication**: Premium, high-end services
- **Reliability**: Stable, trustworthy business
- **Creativity**: Rich, artistic sensibility
- **Professionalism**: Serious, business-focused
- **Warmth**: Approachable, human-centered

### White Associations
- **Clarity**: Clear communication, transparency
- **Simplicity**: Clean, uncluttered design
- **Professionalism**: Modern, sophisticated
- **Trust**: Honest, straightforward approach

---

## Usage Guidelines

### Do:
- Use exact hex values for digital applications
- Maintain high contrast ratios for accessibility
- Use CMYK values for professional printing
- Test colors on various devices and screens
- Consider color blindness accessibility

### Don't:
- Modify or alter brand colors
- Use colors outside the approved palette
- Ignore contrast ratio requirements
- Use low-quality color reproductions
- Mix with competing color schemes

---

## Accessibility Compliance

All color combinations meet or exceed WCAG 2.1 AA standards:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **UI elements**: Minimum 3:1 contrast ratio

The primary combinations (white on burgundy variations) exceed AAA standards for enhanced accessibility.

---

## Contact

For color matching questions or print specifications:
- **Email**: dev@wildcardcreativeco.com
- **Website**: https://www.wildcardcreativeco.com/
