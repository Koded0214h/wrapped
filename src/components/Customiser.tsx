import { useRef, type ReactNode } from 'react'
import { Award, Check, LockKeyhole, Stamp, X } from 'lucide-react'
import { Button } from './Button'
import { fonts } from '../themes/fonts'
import { themes, type ThemeId } from '../themes/themes'
import { useApp, type Purchase } from '../store/useApp'
import { useDialogFocus } from './useDialogFocus'
import { appConfig } from '../config/appConfig'

export function Customiser({ onClose, buy, preview }: { onClose: () => void; buy: (purchase: Purchase) => void; preview: ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(dialogRef, onClose)
  const { theme, setTheme, font, setFont, savage, setSavage, hideNames, setHideNames, owned } = useApp()
  const has = (item: Purchase) => appConfig.freeAccess ? item !== 'watermark' : owned.includes(item) || owned.includes('everything')
  const selectedTheme = themes.find((item) => item.id === theme) ?? themes[0]
  const selectedFont = fonts.find((item) => item.id === font) ?? fonts[0]
  const themePreview = !selectedTheme.free && !has('theme')
  const fontPreview = !selectedFont.free && !has('font')
  const savagePreview = savage && !has('savage')
  const pickTheme = (id: ThemeId) => setTheme(id)
  return <aside ref={dialogRef} className="customiser" role="dialog" aria-modal="true" aria-labelledby="customiser-title">
    <div className="customiser__head"><div><h2 id="customiser-title">Make it yours</h2><p>Changes preview live.</p></div><button className="icon-button" onClick={onClose} aria-label="Close customiser"><X /></button></div>
    <div className="customiser-preview">
      <div className="customiser-preview__card">{preview}</div>
      <div className="customiser-preview__copy"><span>{themePreview || fontPreview || savagePreview ? 'Preview only' : 'Ready to share'}</span><strong>{selectedTheme.name} · {selectedFont.name}</strong><small>{themePreview || fontPreview || savagePreview ? 'See the final look now. Export and sharing unlock after purchase.' : 'This selection is owned and export-ready.'}</small>
        {themePreview && <button onClick={() => buy('theme')}>Unlock theme · $0.99</button>}
        {fontPreview && <button onClick={() => buy('font')}>Unlock font · $0.99</button>}
        {savagePreview && <button onClick={() => buy('savage')}>Unlock Savage · $0.99</button>}
      </div>
    </div>
    <div className="customiser__section"><h3>Themes</h3><div className="theme-list">{themes.map((item) => <button key={item.id} className={theme === item.id ? 'theme-option is-active' : 'theme-option'} onClick={() => pickTheme(item.id)}>
      <i style={{ background: `linear-gradient(135deg, ${item.variables['--bg-from']}, ${item.variables['--bg-to']})` }} />
      <span><strong>{item.name}</strong><small>{item.vibe}</small></span>
      {theme === item.id && (item.free || has('theme')) ? <Check /> : !item.free && !has('theme') ? <b>{theme === item.id ? 'Preview' : <><LockKeyhole size={13} /> $0.99</>}</b> : null}
    </button>)}</div></div>
    <div className="customiser__section"><h3>Display type</h3><div className="font-list">{fonts.map((item) => <button key={item.id} className={font === item.id ? 'is-active' : ''} style={{ fontFamily: item.stack }} onClick={() => setFont(item.id)}>{item.name}{!item.free && !has('font') && (font === item.id ? <small>Preview</small> : <LockKeyhole size={14} />)}</button>)}</div></div>
    <div className="customiser__section customiser__switches">
      <label><span><strong>Hide names</strong><small>Show Member 1, 2, 3 instead.</small></span><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /><i /></label>
      <label><span><strong>Savage mode</strong><small>{savagePreview ? 'Previewing · export locked' : 'Turn the roast up one notch.'}</small></span><input type="checkbox" checked={savage} onChange={(e) => setSavage(e.target.checked)} /><i /></label>
    </div>
    {!appConfig.freeAccess && <div className="customiser__section"><h3>More upgrades</h3><div className="upgrade-list">
      <button onClick={() => !has('watermark') && buy('watermark')}><Stamp /><span><strong>Remove watermark</strong><small>Clean cards without the footer link.</small></span>{has('watermark') ? <Check /> : <b>$0.99</b>}</button>
      <button onClick={() => !has('awards') && buy('awards')}><Award /><span><strong>Bonus award cards</strong><small>Extra member superlatives for sharing.</small></span>{has('awards') ? <Check /> : <b>$0.99</b>}</button>
    </div></div>}
    {appConfig.freeAccess && <div className="bundle"><span>Free launch</span><h3>Everything is open</h3><p>Use every theme, font, roast and export. Shared cards keep the site link so your people can make theirs.</p></div>}
    {!appConfig.freeAccess && !has('everything') && <div className="bundle"><span>Best value</span><h3>Everything pack</h3><p>Full story, every theme and font, Savage mode, and no watermark.</p><Button wide onClick={() => buy('everything')}>Get everything · $3.99</Button></div>}
  </aside>
}
