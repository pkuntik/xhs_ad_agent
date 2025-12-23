'use client'

import { useState } from 'react'

interface PromptDisplayProps {
  prompt: string
}

export function PromptDisplay({ prompt }: PromptDisplayProps) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <div className="text-xs bg-blue-50 border border-blue-200 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-blue-700">AI 生成的提示词:</span>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-blue-600 hover:text-blue-800"
        >
          {showPrompt ? '隐藏' : '显示'}
        </button>
      </div>
      {showPrompt && (
        <p className="text-blue-600 leading-relaxed">{prompt}</p>
      )}
    </div>
  )
}
