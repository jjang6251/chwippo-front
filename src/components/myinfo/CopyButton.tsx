import { useState } from 'react'

interface CopyButtonProps {
  value?: string
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const isEmpty = !value?.trim()

  const handleCopy = async () => {
    if (isEmpty || copied) return
    await navigator.clipboard.writeText(value!)
    setCopied(true)
    setTimeout(() => setCopied(false), 800)
  }

  return (
    <button
      onClick={handleCopy}
      disabled={isEmpty}
      title="복사"
      className={`flex-none w-7 h-7 flex items-center justify-center rounded-md transition-colors
        ${isEmpty ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/8 cursor-pointer'}`}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-success">
          <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-text-quaternary">
          <rect x="4.5" y="1" width="7.5" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M1 4.5h3M1 4.5v7.5h7.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
