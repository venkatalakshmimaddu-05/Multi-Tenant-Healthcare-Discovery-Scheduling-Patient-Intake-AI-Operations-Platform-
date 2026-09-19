import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    await execPromise("npx tsx prisma/seed.ts");
    return NextResponse.json({ success: true, message: "Database successfully reseeded" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}