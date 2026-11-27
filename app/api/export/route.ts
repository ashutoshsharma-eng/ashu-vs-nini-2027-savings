import { connection } from "next/server";
import { getSessionMember } from "@/lib/auth";
import { ensureDbInitialized, loadBoxes, loadBucketItems, loadGroupName, loadMembers, loadMoneyDates, loadPlan } from "@/lib/db";
import { buildWorkbook } from "@/lib/excel";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "savings";

export async function GET() {
  await connection();
  const me = await getSessionMember();
  if (!me) return new Response("Please log in first.", { status: 401 });

  try {
    await ensureDbInitialized();
    const [members, groupName, boxes, dates, bucket, plan] = await Promise.all([
      loadMembers(),
      loadGroupName(),
      loadBoxes(),
      loadMoneyDates(),
      loadBucketItems(),
      loadPlan(),
    ]);
    const file = await buildWorkbook({ groupName, members, boxes, dates, bucket, plan });
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug(groupName)}-2027-${day}.xlsx"; filename*=UTF-8''${encodeURIComponent(`${groupName} 2027 ${day}.xlsx`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Excel export failed", err);
    return new Response("Export failed — please try again.", { status: 500 });
  }
}
