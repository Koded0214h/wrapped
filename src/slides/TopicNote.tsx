export function TopicNote({ label, text }: { label: string; text?: string }) {
  return text ? <div className="topic-note"><small>{label}</small><p>{text}</p></div> : null
}
