export type ThemeId = 'sunset' | 'lagos' | 'detty' | 'bubblegum' | 'midnight' | 'mint'

export type StoryTheme = {
  id: ThemeId
  name: string
  vibe: string
  free: boolean
  variables: Record<string, string>
}

// Every theme is light and flat, so the cards and the app agree.
export const themes: StoryTheme[] = [
  { id: 'sunset', name: 'Sunset Pop', vibe: 'Sweet heat', free: true, variables: { '--bg-from': '#fff1e8', '--bg-to': '#fff1e8', '--surface': '#ffffff', '--text': '#201411', '--muted': '#6e5146', '--accent': '#ffd84d', '--accent-2': '#e8502d' } },
  { id: 'lagos', name: 'Lagos Lime', vibe: 'Fresh out', free: false, variables: { '--bg-from': '#f2f8e4', '--bg-to': '#f2f8e4', '--surface': '#ffffff', '--text': '#18220f', '--muted': '#4f5f41', '--accent': '#cdee5a', '--accent-2': '#2f7d4f' } },
  { id: 'detty', name: 'Detty Gold', vibe: 'Big energy', free: false, variables: { '--bg-from': '#fff5d6', '--bg-to': '#fff5d6', '--surface': '#ffffff', '--text': '#2a1f08', '--muted': '#6f5a2a', '--accent': '#ffcf3f', '--accent-2': '#1f6f54' } },
  { id: 'bubblegum', name: 'Bubblegum', vibe: 'Soft chaos', free: false, variables: { '--bg-from': '#ffeaf3', '--bg-to': '#ffeaf3', '--surface': '#ffffff', '--text': '#352342', '--muted': '#735b7b', '--accent': '#ffe27a', '--accent-2': '#c93d77' } },
  { id: 'midnight', name: 'Sky Blue', vibe: 'Low-key loud', free: false, variables: { '--bg-from': '#e9f1ff', '--bg-to': '#e9f1ff', '--surface': '#ffffff', '--text': '#14213d', '--muted': '#4a5878', '--accent': '#ffd84d', '--accent-2': '#2f5fd0' } },
  { id: 'mint', name: 'Mint Fresh', vibe: 'Clean gist', free: false, variables: { '--bg-from': '#e6f7ee', '--bg-to': '#e6f7ee', '--surface': '#ffffff', '--text': '#12372c', '--muted': '#4c6f62', '--accent': '#ffd36b', '--accent-2': '#c9512f' } }
]

export const getTheme = (id: ThemeId) => themes.find((theme) => theme.id === id) ?? themes[0]
