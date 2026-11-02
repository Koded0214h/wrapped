---
name: Chat Wrapped
description: A house-party confession deck that turns private chat patterns into saturated, share-ready reveals.
colors:
  ink: "#201411"
  paper: "#fffaf0"
  action: "#ff5b36"
  hot-pink: "#ff4e91"
  celebration-yellow: "#ffe45c"
  trust-green: "#123f34"
  focus-blue: "#3b63ff"
  story-shell: "#17100e"
  story-shell-raised: "#2b211e"
  story-shell-text: "#f8eee0"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "clamp(4.4rem, 7.7vw, 7.1rem)"
    fontWeight: 800
    lineHeight: 0.83
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "clamp(2.8rem, 7vw, 4.7rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  story-title:
    fontFamily: "Bricolage Grotesque Variable, sans-serif"
    fontSize: "2.35rem"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  compact: "9px"
  sm: "12px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "52px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "52px"
  selection-card:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "19px"
  story-frame:
    backgroundColor: "{colors.story-shell-raised}"
    textColor: "{colors.story-shell-text}"
    rounded: "{rounded.lg}"
    width: "360px"
---

# Design System: Chat Wrapped

## Overview

**Creative North Star: "The House-Party Confession Deck"**

Chat Wrapped feels dealt across a table at a lively house party: saturated card stock, stacked 9:16 scorecards, compact stamps, unapologetically chunky type, and sharp social observations. It is playful and Nigerian-flavoured without becoming unserious; privacy language and conventional controls keep the experience trustworthy while the deck makes every result feel screenshot-worthy.

The application shell is warm paper and dark ink with a single hot action colour. Story cards are a louder world inside that shell: six complete theme sets govern every visible story colour, while directional blur and travel make navigation feel like dealing the next confession. Utility surfaces stay literal, compact, and accessible instead of imitating paper props everywhere.

**Key Characteristics:**

- A house-party confession deck carried through landing, setup, processing, story, paywall, customisation, and sharing.
- Warm application paper, near-black brown ink, and a restrained orange action colour.
- Saturated 9:16 story cards with theme-disciplined colour and oversized evidence-led typography.
- Compact 12–16px corners; pills are reserved for short statuses, toggles, and segmented controls.
- Directional blur and horizontal travel are the signature interaction, used only when changing story cards.
- Privacy, focus visibility, ownership state, and export eligibility remain explicit at conversion points.

## Colors

The application palette is warm, tactile, and high-energy; the story palette becomes theme-specific without borrowing stray application colours.

### Primary

- **Application Ink:** The near-black brown used for primary text, strong buttons, brand marks, and high-confidence selection states.
- **Action Orange:** The conversion and progress colour used for the landing call to action, paywall action, selected switches, and share emphasis.

### Secondary

- **Hot Pink:** A celebratory deck layer and processing accent, paired with orange rather than used for routine controls.
- **Celebration Yellow:** A high-contrast stamp, chip, lock, selection, and moment-of-delight colour.

### Tertiary

- **Trust Green:** Reserved for privacy and reassurance contexts, not general decoration.
- **Focus Blue:** The consistent keyboard focus outline across buttons, links, inputs, and custom switches.

### Neutral

- **Application Paper:** The warm cream canvas for landing, setup, modals, and the customiser.
- **Story Shell:** The near-black surround that lets the active story card dominate.
- **Story Shell Raised:** The quieter dark control surface used around story utilities.
- **Story Shell Text:** The warm off-white for navigation and supporting copy on the story shell.

### Story Theme Sets

Each story theme supplies exactly seven colour roles: two gradient endpoints, surface, text, muted, accent, and second accent. The shipped sets are Sunset Pop, Lagos Neon, Detty Gold, Bubblegum, Midnight, and Mint Fresh; their exact source values are recorded in `.impeccable/design.json` under `extensions.themeVariableSets`.

**The Closed Theme Rule.** A story slide uses only its active theme variables: background endpoints, surface, text, muted text, accent, and second accent. Application orange, pink, yellow, ink, and paper must never leak into slide content.

**The Evidence Contrast Rule.** Every theme must keep headlines, supporting text, and surface content readable against both gradient endpoints and its own surface colour.

## Typography

**Display Font:** Bricolage Grotesque Variable (with sans-serif fallback)  
**Body Font:** Manrope Variable (with sans-serif fallback)  
**Optional Story Display Fonts:** Fredoka 600 and Bebas Neue, available as paid live previews

**Character:** Bricolage is broad, compressed, and a little unruly—the voice of a confession card being read aloud. Manrope keeps instructions, privacy copy, labels, and commerce clear enough that the joke never obscures the task.

### Hierarchy

- **Display** (800, fluid 4.4–7.1rem, 0.83 line-height): Landing promise and other singular campaign-scale statements.
- **Headline** (800, fluid 2.8–4.7rem, 0.98 line-height): Setup and flow titles.
- **Story Title** (800, 2.35rem, 0.94 line-height): Primary reveal on a 360 × 640 story card.
- **Body** (400–700, 1rem base, 1.55 line-height): Instructions, trust copy, and supporting product language.
- **Label** (800–900, 0.7rem, 0.04em tracking): Stamps, chips, progress labels, and compact story metadata.

Numbers and rankings use heavy display weight and tabular-feeling alignment. Story display options may change the display face, but Manrope remains the body face and the application pairing remains Bricolage plus Manrope.

**The Two-Voice Rule.** Use display type for the reveal and body type for the explanation. Never stack several decorative faces in one card.

## Layout

The main application uses bounded desktop canvases from 1040px to 1300px and a mobile-first story artifact. Landing pages place offer and working proof side by side at desktop widths; below 900px they become one column with the offer first and proof immediately after. Setup tasks center within a 620px working column.

The story screen uses a three-column desktop composition: contextual metadata, a centered 360 × 640 card, and sharing controls. Below 900px the metadata recedes; below 700px the page becomes a vertical composition with the story card first and controls below. The card always preserves 9:16 geometry and becomes narrower instead of shorter. Desktop story corners are 16px; mobile corners are 14px.

Spacing follows an 8px-biased rhythm with compact 4px gaps and recurring 12px, 16px, 24px, and 28px steps. Story interiors use 23px padding, while application cards generally use 14–24px. Export frames remain exactly 360 × 640 CSS pixels and render at 3× for 1080 × 1920 output.

**The Unbroken Card Rule.** Never compress, crop, or reflow the story into a non-9:16 dashboard tile. Move supporting controls below it.

## Elevation & Depth

Depth is structural and theatrical rather than constant. Application cards are mostly defined by warm tonal separation and borders; selection and modal states earn soft brown shadows. The proof deck uses rotated yellow and pink sheets behind a deep card shadow, while the story card floats above a dark shell.

### Shadow Vocabulary

- **Button lift** (`0 9px 20px rgba(56, 22, 12, .18)`): Resting depth for primary application buttons.
- **Action lift** (`0 12px 26px rgba(218, 71, 38, .27)`): Stronger landing conversion emphasis.
- **Card selection** (`0 10px 24px rgba(80, 45, 26, .11)`): Active selection card only.
- **Story float** (`0 28px 60px rgba(0, 0, 0, .34)`): The central story artifact against the dark shell.
- **Modal lift** (`0 28px 70px rgba(15, 8, 5, .35)`): Dialog separation over a blurred scrim.
- **Drawer edge** (`-20px 0 50px rgba(0, 0, 0, .3)`): Customiser separation from the story.

**The Earned Lift Rule.** Reserve the strongest shadows for the proof deck, central story, modal, and drawer. Routine cards stay flatter so the artifact remains dominant.

## Shapes

The form language is chunky and compact. Application containers and story frames use 12–16px radii; 14px is the default control/card corner and 16px marks larger cards, modals, and desktop story frames. Nine- to eleven-pixel radii are limited to dense micro-panels and paywall actions. Circles identify icons, ranks, avatars, and switch thumbs.

Pills are not the default container shape. They belong to short chips, preview labels, segmented controls, switches, and transient hints. Slight rotations are reserved for dealt layers, stamps, and expressive story motifs; ordinary utility surfaces stay aligned.

## Components

### Buttons

- **Shape:** Chunky compact rectangle with a 14px radius, 52px minimum height, and 22px horizontal padding.
- **Primary:** Ink on white for general actions; action orange replaces ink only at high-value conversion moments or inside the dark story shell.
- **Hover / Focus:** Hover lifts 2px over 160ms. Keyboard focus uses a 3px focus-blue outline with a 3px offset; active returns to rest.
- **Secondary / Quiet:** Secondary uses white with a 1.5px warm inset border; quiet is transparent and reserved for low-emphasis navigation.

### Chips

- **Style:** Compact, high-weight labels on celebration yellow or a low-contrast neutral surface.
- **State:** Use pills for preview, paid, best-value, filters, and segmented selections—never as a substitute for ordinary cards.

### Cards / Containers

- **Corner Style:** 14px for routine cards and 16px for large cards, modals, and story frames.
- **Background:** Warm white or application paper in utility flows; active story theme surfaces inside stories.
- **Shadow Strategy:** Flat by default, lifted only for active selection or artifact hierarchy.
- **Border:** Warm 1.5px borders communicate selectability; active selection shifts to ink.
- **Internal Padding:** 14–24px depending on density.

### Inputs / Fields

- **Style:** Warm white field or dropzone, 14–16px radius, literal labels, and generous touch targets.
- **Focus:** The global 3px focus-blue outline; dropzones may also shift to celebration yellow and action orange during drag.
- **Error / Disabled:** Errors use dark red on pale pink. Disabled actions retain their geometry, reduce opacity, and never animate.

### Navigation

The landing navigation is light and spacious; the story navigation is a compact dark strip with pill utilities. On narrow screens the brand wordmark and button labels may recede, but icons, accessible names, and 38–40px targets remain.

### Story Deck

The canonical card is a saturated 9:16 frame with progress bars above, 23px internal padding, a display-led reveal, supporting evidence, and a small provenance/watermark line. Ten reusable compositions—cover, big number, leaderboard, versus, quote, timeline, award, word cloud, heatmap, and verdict—share that frame without collapsing into one template. Horizontal navigation accepts taps, swipes, arrow keys, and optional six-second auto-play. Unlocked card changes travel 60px in the navigation direction while blurring 8px, resolving over 380ms with `cubic-bezier(0.16, 1, 0.3, 1)`; entry into a locked card changes directly so outgoing personal data does not linger in the DOM. Reduced-motion preferences collapse animation and transition durations to effectively instant.

### Modal & Customiser Drawer

Dialogs and the right-side customiser are real modal contexts: focus moves to the first control, Tab and Shift+Tab stay trapped, Escape closes, and focus returns to the opener. Scrim click may close, but it cannot be the only exit. On mobile the drawer becomes full-width and keeps its live preview sticky near the top.

### Locked Preview & Export Guard

Paid themes, alternate fonts, and Savage mode preview live on the story and customiser. The preview must plainly say “Preview only” and show the relevant purchase action. Every in-app save, download-all, Web Share, and share fallback path checks ownership before generating or releasing an asset; a locked style routes to its matching purchase flow. This guard is independent of the core story paywall.

A locked story card is a purpose-built dark sealed state, not a blurred real card. It may reveal the layout label and a redacted headline, but must not mount referenced facts, names, numbers, or an outgoing unlocked transition beneath the paywall.

**The Preview-Is-Not-Ownership Rule.** Let people see the final style before buying, but never allow any in-app export or share path to release an unowned theme, font, or Savage treatment.

## Do's and Don'ts

### Do:

- **Do** make the offer and a working-scale 9:16 proof coexist in the first desktop viewport.
- **Do** preserve the 360 × 640 story composition and 1080 × 1920 export result.
- **Do** use the active theme’s complete variable set for every story colour.
- **Do** keep privacy and name-visibility guidance visible near upload, purchase, customisation, and sharing.
- **Do** use directional blur and travel only to communicate story navigation.
- **Do** preserve visible focus, Escape, focus trapping/restoration, arrow-key navigation, and reduced-motion behavior.
- **Do** let locked themes, fonts, and Savage mode preview live while gating every in-app save, download, and share route until ownership.
- **Do** render placeholder-only locked cards; privacy is a data-rendering rule, not a blur effect.

### Don't:

- **Don't** turn the experience into a generic SaaS hero or analytics-dashboard grid.
- **Don't** leak application palette colours into theme-governed story slides.
- **Don't** shrink the story card vertically to make desktop controls fit.
- **Don't** use decorative motion on routine state changes; most states change directly.
- **Don't** use pills as the default shape for buttons, cards, or containers.
- **Don't** let a scrim click replace a labelled close control or complete keyboard behavior.
- **Don't** treat a visible locked preview as purchased, including browser download fallbacks after Web Share is unavailable.
- **Don't** mount real names, values, or hidden export content for a locked card.
