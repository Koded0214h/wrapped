export type ThemeId = 'sunset' | 'lagos' | 'detty' | 'bubblegum' | 'midnight' | 'mint'

export type StoryTheme = {
  id: ThemeId
  name: string
  vibe: string
  free: boolean
  variables: Record<string, string>
}

// Every theme is light: a soft two-tone gradient with one warm and one strong accent.
export const themes: StoryTheme[] = [
  { id: 'sunset', name: 'Sunset Pop', vibe: 'Sweet heat', free: true, variables: { '--bg-from': '#fff4e8', '--bg-to': '#ffd8c4', '--surface': '#fffdf8', '--text': '#2a1611', '--muted': '#76503f', '--accent': '#ffd23f', '--accent-2': '#f2552f' } },
  { id: 'lagos', name: 'Lagos Lime', vibe: 'Fresh out', free: false, variables: { '--bg-from': '#f6fce6', '--bg-to': '#d8f1ae', '--surface': '#fffff7', '--text': '#16240e', '--muted': '#4c603c', '--accent': '#c6f04d', '--accent-2': '#1f8a50' } },
  { id: 'detty', name: 'Detty Gold', vibe: 'Big energy', free: false, variables: { '--bg-from': '#fff8de', '--bg-to': '#ffe08f', '--surface': '#fffdf5', '--text': '#2b1e05', '--muted': '#6d5626', '--accent': '#ffc928', '--accent-2': '#1f6f54' } },
  { id: 'bubblegum', name: 'Bubblegum', vibe: 'Soft chaos', free: false, variables: { '--bg-from': '#fff1f8', '--bg-to': '#ffcfe4', '--surface': '#fffcfe', '--text': '#3a1f48', '--muted': '#71557a', '--accent': '#ffe36e', '--accent-2': '#d8337a' } },
  { id: 'midnight', name: 'Sky Blue', vibe: 'Low-key loud', free: false, variables: { '--bg-from': '#eef5ff', '--bg-to': '#cbdcff', '--surface': '#fdfeff', '--text': '#13203f', '--muted': '#46557a', '--accent': '#ffd84d', '--accent-2': '#3360dd' } },
  { id: 'mint', name: 'Mint Fresh', vibe: 'Clean gist', free: false, variables: { '--bg-from': '#ecfbf3', '--bg-to': '#c2eed6', '--surface': '#fcfffd', '--text': '#0f382b', '--muted': '#46695c', '--accent': '#ffd36b', '--accent-2': '#d9572f' } }
]

export const getTheme = (id: ThemeId) => themes.find((theme) => theme.id === id) ?? themes[0]
