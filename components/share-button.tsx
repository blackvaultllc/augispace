'use client'

import { useState } from 'react'

type ShareButtonProps = { title?: string; text?: string; className?: string }

export function ShareButton({ title, text, className }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function share() {
    const url = window.location.href
    const data = { title: title ?? document.title, text: text ?? 'Take a look at this on AUGI', url }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(data)
        return
      }
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      setState('error')
    }
    window.setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this page"
      className={className ?? 'inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/10'}
    >
      {state === 'copied' ? 'Link copied' : state === 'error' ? 'Copy failed' : 'Share'}
    </button>
  )
}