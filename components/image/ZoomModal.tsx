'use client'

import Image from 'next/image'
import { X } from 'lucide-react'

interface ZoomModalProps {
  imageUrl: string
  imageType: 'cover' | 'content'
  onClose: () => void
}

export function ZoomModal({ imageUrl, imageType, onClose }: ZoomModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <Image
          src={imageUrl}
          alt={imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'}
          width={800}
          height={1067}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
          unoptimized
        />
      </div>
    </div>
  )
}
