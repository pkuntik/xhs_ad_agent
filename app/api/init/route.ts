import { NextResponse } from 'next/server'
import { initializeAdmin } from '@/actions/admin'

export async function GET() {
  const result = await initializeAdmin()
  return NextResponse.json(result)
}
