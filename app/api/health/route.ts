import { NextResponse } from 'next/server';

// Reports whether the optional integrations are configured. Returns
// booleans only — never echoes the keys themselves. The Settings page
// uses this to label each data source as "Active" or "Not configured".

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      airnow: !!process.env.AIRNOW_API_KEY,
      synoptic: !!process.env.SYNOPTIC_TOKEN,
      // Nominatim is keyless; the contact email override is optional and
      // doesn't affect functionality. Reported for completeness.
      nominatimContactSet: !!process.env.NOMINATIM_CONTACT,
    },
    { status: 200 },
  );
}
