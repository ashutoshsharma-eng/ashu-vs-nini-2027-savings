import { connection } from "next/server";
import { getSessionPlayer } from "@/lib/auth";
import { ensureDbInitialized, loadBoxes, loadBucketItems, loadMoneyDates, loadPlan } from "@/lib/db";
import { buildWorkbook } from "@/lib/excel";

export async function GET() {
  await connection();
  const me = await getSessionPlayer();
  if (!me) return new Response("Please log in first.", { status: 401 });

  try {
    await ensureDbInitialized();
    const [boxes, dates, bucket, plan] = await Promise.all([
      loadBoxes(),
      loadMoneyDates(),
      loadBucketItems(),
      loadPlan(),
    ]);
    const file = await buildWorkbook({ boxes, dates, bucket, plan });
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="husband-vs-wife-2027-${day}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Excel export failed", err);
    return new Response("Export failed — please try again.", { status: 500 });
  }
}
