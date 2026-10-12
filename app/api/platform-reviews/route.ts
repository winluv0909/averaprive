import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPlatformReviews } from "@/lib/reviews/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadPlatformReviews(
      await createClient(),
      1,
      2,
    );

    return NextResponse.json(
      data ?? { error: "Reviews are temporarily unavailable." },
      {
        status: data ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}