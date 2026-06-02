import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const report = await request.json()
    console.warn('CSP violation report:', JSON.stringify(report))
  } catch {
    console.warn('CSP report received with invalid payload')
  }

  return NextResponse.json({}, { status: 204 })
}
