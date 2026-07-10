import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { processRouterSetup } from "@/lib/router-setup";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getLatestRouterProfile(user.id);
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await processRouterSetup(await request.formData(), user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save router profile." },
      { status: 400 }
    );
  }
}
