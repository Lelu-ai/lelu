import { NextRequest, NextResponse } from 'next/server';

const PLATFORM_URL = process.env.PLATFORM_URL ?? 'http://platform:9090';
const API_KEY = process.env.PLATFORM_API_KEY ?? 'platform-dev-key';

export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PLATFORM_URL}/api/v1/policies/${params.name}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Platform API error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Policy update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update policy' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const response = await fetch(`${PLATFORM_URL}/api/v1/policies/${params.name}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Platform API error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Policy fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch policy' },
      { status: 500 }
    );
  }
}
