import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// 预定义的渐变色
const gradients = [
  { from: '#FF6B6B', to: '#FFE66D' },  // 红-黄
  { from: '#4ECDC4', to: '#44CF8A' },  // 青-绿
  { from: '#667EEA', to: '#764BA2' },  // 蓝-紫
  { from: '#F093FB', to: '#F5576C' },  // 粉-红
  { from: '#4FACFE', to: '#00F2FE' },  // 蓝-青
  { from: '#FA709A', to: '#FEE140' },  // 粉-黄
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || '小红书笔记'
  const colorIndex = parseInt(searchParams.get('color') || '0', 10) % gradients.length
  const gradient = gradients[colorIndex]

  // 小红书推荐的图片尺寸 3:4
  const width = 1080
  const height = 1440

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          position: 'relative',
        }}
      >
        {/* 装饰圆圈 */}
        <div
          style={{
            position: 'absolute',
            top: 150,
            left: 50,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 150,
            right: 50,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />

        {/* 标题文字 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 60px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              color: 'white',
              textShadow: '2px 2px 10px rgba(0, 0, 0, 0.3)',
              lineHeight: 1.3,
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </p>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  )
}
