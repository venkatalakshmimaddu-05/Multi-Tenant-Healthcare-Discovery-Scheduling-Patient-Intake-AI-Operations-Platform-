import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const cookieToken = req.cookies.get("auracare_auth_token")?.value;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const session = AuthService.verifyToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
