import { Children, cloneElement, isValidElement, type CSSProperties, type ReactNode } from 'react'

/** Wraps each word of a line so it can arrive on its own. The text reads and wraps as before. */
export function Words({ children }: { children: ReactNode }) {
  let order = 0
  const split = (node: ReactNode): ReactNode => Children.map(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child).split(/(\s+)/).map((part, index) => part.trim() ? <span className="word" key={index} style={{ '--word': order++ } as CSSProperties}>{part}</span> : part)
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children !== undefined) return cloneElement(child, undefined, split(child.props.children))
    return child
  })
  return <>{split(children)}</>
}
