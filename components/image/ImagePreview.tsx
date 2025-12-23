'use client'

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, Check, Pencil, ZoomIn } from 'lucide-react'

interface ImagePreviewProps {
  imageUrl: string
  imageType: 'cover' | 'content'
  isUploading: boolean
  uploadComplete: boolean
  compact?: boolean
  onEdit: () => void
  onZoom: () => void
}

export function ImagePreview({
  imageUrl,
  imageType,
  isUploading,
  uploadComplete,
  compact = false,
  onEdit,
  onZoom,
}: ImagePreviewProps) {
  const alt = imageType === 'cover' ? 'AI 生成的封面图' : 'AI 生成的配图'

  if (compact) {
    return (
      <div className="relative aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden group">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-contain"
          unoptimized
        />
        {/* 上传进度指示器 */}
        {isUploading && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 px-2 flex items-center gap-1.5">
            <Upload className="h-3 w-3 animate-pulse" />
            <span>上传中...</span>
          </div>
        )}
        {uploadComplete && !isUploading && (
          <div className="absolute bottom-0 left-0 right-0 bg-green-600/80 text-white text-xs py-1 px-2 flex items-center gap-1.5">
            <Check className="h-3 w-3" />
            <span>已保存</span>
          </div>
        )}
        {/* 操作按钮 */}
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
            title="编辑图片"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onZoom}
            className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
            title="查看大图"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative group aspect-auto min-h-[200px]">
          <Image
            src={imageUrl}
            alt={alt}
            width={400}
            height={533}
            className="w-full h-auto rounded-lg"
            unoptimized
          />
          {/* 上传进度指示器 */}
          {isUploading && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-sm py-1.5 px-3 rounded flex items-center gap-2">
              <Upload className="h-4 w-4 animate-pulse" />
              <span>正在上传到云端...</span>
            </div>
          )}
          {uploadComplete && !isUploading && (
            <div className="absolute bottom-2 left-2 right-2 bg-green-600/80 text-white text-sm py-1.5 px-3 rounded flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>已保存到云端</span>
            </div>
          )}
          {/* 操作按钮 */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              title="编辑图片"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onZoom}
              className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              title="查看大图"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
