export type FontId = 'gluten' | 'bricolage' | 'fredoka' | 'bebas'
export const displayStack = '"Gluten Variable", "Nunito Variable", sans-serif'
export const bodyStack = '"Nunito Variable", sans-serif'
export const fonts = [
  { id: 'gluten' as FontId, name: 'Gluten', free: true, stack: displayStack },
  { id: 'bricolage' as FontId, name: 'Bricolage', free: false, stack: '"Bricolage Grotesque Variable", sans-serif' },
  { id: 'fredoka' as FontId, name: 'Fredoka', free: false, stack: '"Fredoka", sans-serif' },
  { id: 'bebas' as FontId, name: 'Bebas Neue', free: false, stack: '"Bebas Neue", sans-serif' }
]
