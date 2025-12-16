'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
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

  // 创客贴 SDK 会自己创建弹窗和遮罩，我们只需要在加载/错误时显示提示
  return (
    <>
      {/* 加载状态 */}
      {isLoading && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-lg shadow-lg">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-gray-600">正在加载编辑器...</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
            <p className="text-red-500 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setError(null)
                  onClose?.()
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                关闭
              </button>
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
        </div>
      )}
    </>
  )
}
