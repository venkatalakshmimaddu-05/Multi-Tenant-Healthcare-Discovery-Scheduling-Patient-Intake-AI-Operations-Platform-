import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const authResult = await AuthService.authenticate(email, password);

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Authentication failed" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      token: authResult.token,
      session: authResult.session,
    });

    // Set secure cookie for browser sessions
    response.cookies.set({
      name: "auracare_auth_token",
      value: authResult.token!,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 3600, // 24 hours
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
