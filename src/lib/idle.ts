/** Waits for a quiet moment, so background work never lands in the middle of a swipe. */
export const whenIdle = () => new Promise<void>((resolve) => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 1500 })
  else setTimeout(resolve, 60)
})
