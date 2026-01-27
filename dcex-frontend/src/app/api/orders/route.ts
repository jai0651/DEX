import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.MATCHING_ENGINE_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to place order:', error)
    return NextResponse.json(
      { error: 'Failed to place order' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    const marketId = searchParams.get('market_id')

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 })
    }

    let url = `${API_URL}/api/users/${wallet}/orders`
    if (marketId) {
      url += `?market_id=${marketId}`
    }

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to get orders:', error)
    return NextResponse.json(
      { error: 'Failed to get orders' },
      { status: 500 }
    )
  }
}
