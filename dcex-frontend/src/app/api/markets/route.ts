import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.MATCHING_ENGINE_URL || 'http://localhost:3001'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('market_id')

    const url = marketId
      ? `${API_URL}/api/markets/${marketId}`
      : `${API_URL}/api/markets`

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get markets:', error)
    return NextResponse.json(
      { error: 'Failed to get markets' },
      { status: 500 }
    )
  }
}
