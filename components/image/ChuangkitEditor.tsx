'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { signChuangkitRequest } from '@/actions/chuangkit'

// 声明全局类型
declare global {
  interface Window {
    chuangkitComplete?: (result: ChuangkitCompleteResult) => void
    chuangkitClose?: () => void
  }
}

interface ChuangkitCompleteResult {
  cktMessage?: boolean
  page_thumb_urls?: string[]
  design_id?: string
  [key: string]: unknown
}

interface ChuangkitEditorProps {
  /** 是否显示编辑器 */
  open: boolean
  /** 要编辑的图片 URL */
  imageUrl?: string
  /** 用户标识 */
  userFlag?: string
  /** 编辑完成回调，返回编辑后的图片 URL 列表 */
  onComplete?: (imageUrls: string[], designId?: string) => void
  /** 关闭回调 */
  onClose?: () => void
  /** 错误回调 */
  onError?: (error: string) => void
}

export function ChuangkitEditor({
  open,
  imageUrl,
  userFlag = 'anonymous',
  onComplete,
  onClose,
  onError,
}: ChuangkitEditorProps) {
  const editorInstanceRef = useRef<unknown>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // 清理编辑器实例
  const cleanupEditor = useCallback(() => {
    if (editorInstanceRef.current) {
      try {
        (editorInstanceRef.current as { close?: () => void }).close?.()
      } catch (e) {
        console.error('Failed to close editor:', e)
      }
      editorInstanceRef.current = null
    }
    // 清理全局回调
    delete window.chuangkitComplete
    delete window.chuangkitClose
  }, [])

  // 初始化编辑器
  const initEditor = useCallback(async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      // 动态导入 SDK - chuangkit-design 是 UMD 模块
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - chuangkit-design 没有正确的类型导出
      const CktModule = await import('@chuangkit/chuangkit-design')
      // UMD 模块可能在 default 或直接导出
      const CktDesign = CktModule.default || CktModule

      console.log('CktDesign loaded:', CktDesign)

      // 获取签名和参数
      const signResult = await signChuangkitRequest({
        userFlag,
        mode: 'create',
        uploadImgUrl: imageUrl,
      })

      if (!signResult.success || !signResult.params) {
        throw new Error(signResult.error || '获取签名失败')
      }

      const params = signResult.params
      console.log('Chuangkit params:', params)

      // 设置全局回调
      window.chuangkitComplete = (result: ChuangkitCompleteResult) => {
        console.log('chuangkitComplete:', result)
        if (result.cktMessage && result.page_thumb_urls && result.page_thumb_urls.length > 0) {
          onComplete?.(result.page_thumb_urls, result.design_id)
        }
      }

      window.chuangkitClose = () => {
        console.log('chuangkitClose')
        onClose?.()
      }

      // 创建编辑器实例
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editorInstance = new (CktDesign as any)(params)
      editorInstanceRef.current = editorInstance
      console.log('Editor instance created:', editorInstance)

      // 打开编辑器
      if (editorInstance.open) {
        editorInstance.open()
        console.log('Editor opened')
      }

      setIsLoading(false)
    } catch (err) {
      console.error('Chuangkit init error:', err)
      const errorMessage = err instanceof Error ? err.message : '编辑器初始化失败'
      setError(errorMessage)
      setIsLoading(false)
      onError?.(errorMessage)
    }
  }, [open, imageUrl, userFlag, onComplete, onClose, onError])

  // 监听 open 状态变化
  useEffect(() => {
    if (open) {
      initEditor()
    } else {
      cleanupEditor()
    }

    return () => {
      cleanupEditor()
    }
  }, [open, initEditor, cleanupEditor])

  // 监听 iframe 销毁来检测编辑器关闭
  useEffect(() => {
    if (!open) return

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            const isIframeRemoved =
              element.matches?.('iframe[id*="chuangkit"], iframe[src*="chuangkit.com"]') ||
              element.querySelector?.('iframe[id*="chuangkit"], iframe[src*="chuangkit.com"]')

            if (isIframeRemoved) {
              onClose?.()
            }
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center">
      {/* 关闭按钮 */}
      <button
        onClick={() => {
          cleanupEditor()
          onClose?.()
        }}
        className="absolute top-4 right-4 z-[210] p-2 bg-white/90 text-gray-700 rounded-full hover:bg-white transition-colors shadow-lg"
        title="关闭编辑器"
      >
        <X className="h-6 w-6" />
      </button>

      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[205]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-gray-600">正在加载编辑器...</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[205]">
          <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null)
                initEditor()
              }}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 编辑器容器 - 创客贴会自动创建 iframe */}
      <div
        ref={containerRef}
        id="ckt-design-page"
        className="w-full h-full"
      />
    </div>
  )
}
