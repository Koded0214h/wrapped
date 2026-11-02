export type ThemeId = 'sunset' | 'lagos' | 'detty' | 'bubblegum' | 'midnight' | 'mint'

export type StoryTheme = {
  id: ThemeId
  name: string
  vibe: string
  free: boolean
  variables: Record<string, string>
}

export const themes: StoryTheme[] = [
  { id: 'sunset', name: 'Sunset Pop', vibe: 'Sweet heat', free: true, variables: { '--bg-from': '#ff4f5e', '--bg-to': '#ff8a37', '--surface': '#fff4d8', '--text': '#26110e', '--muted': '#6f4035', '--accent': '#ffe45c', '--accent-2': '#ff4fa7' } },
  { id: 'lagos', name: 'Lagos Neon', vibe: 'After dark', free: false, variables: { '--bg-from': '#0a0b09', '--bg-to': '#25103a', '--surface': '#161713', '--text': '#f7ffe9', '--muted': '#b3c5aa', '--accent': '#a8ff35', '--accent-2': '#ff3bbd' } },
  { id: 'detty', name: 'Detty Gold', vibe: 'Big energy', free: false, variables: { '--bg-from': '#003f31', '--bg-to': '#0c1d18', '--surface': '#174c3d', '--text': '#fff8e1', '--muted': '#c9ded4', '--accent': '#ffda66', '--accent-2': '#ff7d52' } },
  { id: 'bubblegum', name: 'Bubblegum', vibe: 'Soft chaos', free: false, variables: { '--bg-from': '#ffb8d9', '--bg-to': '#a7d7ff', '--surface': '#fff7fc', '--text': '#352342', '--muted': '#735b7b', '--accent': '#ffea77', '--accent-2': '#9b5cff' } },
  { id: 'midnight', name: 'Midnight', vibe: 'Low-key loud', free: false, variables: { '--bg-from': '#081735', '--bg-to': '#162a52', '--surface': '#173f59', '--text': '#f2fcff', '--muted': '#badbe7', '--accent': '#57edf5', '--accent-2': '#ff7aa3' } },
  { id: 'mint', name: 'Mint Fresh', vibe: 'Clean gist', free: false, variables: { '--bg-from': '#bdf5d4', '--bg-to': '#ecffcf', '--surface': '#f7fff3', '--text': '#12372c', '--muted': '#507466', '--accent': '#ff7a59', '--accent-2': '#6f5bff' } }
]

export const getTheme = (id: ThemeId) => themes.find((theme) => theme.id === id) ?? themes[0]
