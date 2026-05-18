import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domain, clientId, clientSecret } = body;

    if (!domain || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tokenUrl = `https://${domain}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.json({ 
        success: false, 
        error: tokenData.error_description || tokenData.error || 'Failed to authenticate with Shopify',
        status: tokenResponse.status
      }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      token: tokenData.access_token 
    });

  } catch (error: any) {
    console.error("Auth Route Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
