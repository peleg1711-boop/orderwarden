import { NextResponse } from 'next/server';

const LEMON_SQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const LEMON_SQUEEZY_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;
const LEMON_SQUEEZY_VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID;

export async function POST(request: Request) {
  const userId = request.headers.get('x-clerk-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 401 });
  }

  if (!LEMON_SQUEEZY_API_KEY || !LEMON_SQUEEZY_STORE_ID || !LEMON_SQUEEZY_VARIANT_ID) {
    return NextResponse.json({ error: 'LemonSqueezy configuration missing' }, { status: 500 });
  }

  const origin =
    request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const checkoutPayload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          custom: {
            clerkUserId: userId
          }
        },
        checkout_options: {
          redirect_url: `${origin}/?checkout=success`
        }
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: LEMON_SQUEEZY_STORE_ID
          }
        },
        variant: {
          data: {
            type: 'variants',
            id: LEMON_SQUEEZY_VARIANT_ID
          }
        }
      }
    }
  };

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LEMON_SQUEEZY_API_KEY}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json'
    },
    body: JSON.stringify(checkoutPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: 'Failed to create checkout', details: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();
  const checkoutUrl = data?.data?.attributes?.url;

  if (!checkoutUrl) {
    return NextResponse.json({ error: 'Checkout URL missing from response' }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl });
}
