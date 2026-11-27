import "server-only";
import ExcelJS from "exceljs";
import { monthOf } from "./constants";
import { colorOf } from "./members";
import { lastBox, planTarget, type Plan } from "./plan";
import { chaiVerdict, computeStats, groupTotal, leaderOf, stakesLine } from "./stats";
import type { BoxRow, BucketItem, Member, MoneyDateRow } from "./types";

// Indian digit grouping: ₹1,37,800 / ₹12,34,567
const INR = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
const PCT = "0.0%";
const DATE_TIME = "dd-mmm-yyyy hh:mm AM/PM";
const DATE = "ddd, dd-mmm-yyyy";

const COLORS = {
  ink: "FF18181B",
  white: "FFFFFFFF",
  title: "FF1E1B4B",
  combined: "FF059669",
  combinedLight: "FFD1FAE5",
  done: "FFDCFCE7",
  doneText: "FF166534",
  pendingText: "FF71717A",
  amber: "FFFEF3C7",
  amberText: "FF92400E",
  border: "FFD4D4D8",
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Excel has no time zones: shift so the sheet shows Indian time. */
const toIST = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS);
const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const solid = (m: Member) => `FF${colorOf(m.color).hex}`;
const light = (m: Member) => `FF${colorOf(m.color).lightHex}`;

/** A → 1, B → 2 … (enough for 1 + 8 members + combined). */
const col = (n: number) => String.fromCharCode(64 + n);

function styleHeader(row: ExcelJS.Row, argb: string) {
  row.height = 22;
  row.eachCell((c) => {
    c.fill = fill(argb);
    c.font = { bold: true, color: { argb: COLORS.white } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = thin;
  });
}

function styleBody(row: ExcelJS.Row, bg?: string, color?: string) {
  row.eachCell({ includeEmpty: true }, (c) => {
    if (bg) c.fill = fill(bg);
    c.border = thin;
    c.alignment = { vertical: "middle", ...(c.alignment ?? {}) };
    if (color) c.font = { ...(c.font ?? {}), color: { argb: color } };
  });
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, lastCol: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: COLORS.white } };
  t.fill = fill(COLORS.title);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell("A2");
  s.value = subtitle;
  s.font = { italic: true, color: { argb: COLORS.pendingText } };
  s.alignment = { indent: 1 };
}

/** Excel sheet names: ≤31 chars, no []:*?/\ and unique. */
function sheetNames(members: Member[]): Map<number, string> {
  const used = new Set<string>(["summary", "money dates", "bucket lists"]);
  const out = new Map<number, string>();
  for (const m of members) {
    const base = m.name.replace(/[[\]:*?/\\']/g, "").trim().slice(0, 24) || `Member ${m.id}`;
    let name = `${base} Boxes`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 21)} ${i} Boxes`;
    used.add(name.toLowerCase());
    out.set(m.id, name);
  }
  return out;
}

const BUCKET_SHEET = "Bucket Lists";

export async function buildWorkbook(data: {
  groupName: string;
  members: Member[];
  boxes: BoxRow[];
  dates: MoneyDateRow[];
  bucket: BucketItem[];
  plan: Plan;
}): Promise<Buffer> {
  const { groupName, members, boxes, dates, bucket, plan } = data;
  const solo = members.length === 1;
  const each = planTarget(plan);
  const goal = each * members.length;
  const stats = computeStats(boxes, members);
  const total = groupTotal(stats, members);
  const leader = leaderOf(stats, members);
  const names = sheetNames(members);
  const exportedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const wb = new ExcelJS.Workbook();
  wb.creator = groupName;
  wb.created = new Date();

  // -------------------------------------------------------------------------
  // Summary: one column per person (+ a Combined column for groups)
  // -------------------------------------------------------------------------
  const sum = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.title } },
  });
  const memberCols = members.map((_, i) => i + 2); // B, C, …
  const combinedCol = solo ? null : members.length + 2;
  const lastCol = col(combinedCol ?? members.length + 1);
  sum.columns = [{ width: 30 }, ...members.map(() => ({ width: 20 })), ...(solo ? [] : [{ width: 20 }])];
  addTitle(
    sum,
    `${groupName} — 2027 Savings`,
    `Plan: ${inr(plan.start)} → ${inr(lastBox(plan))} in steps of ${inr(plan.step)} · ${plan.count} boxes each · exported ${exportedAt} IST`,
    lastCol,
  );
  sum.addRow([]);

  const head = sum.addRow(["", ...members.map((m) => `${m.name}${m.isAdmin ? " (admin)" : ""}`), ...(solo ? [] : ["Combined"])]);
  styleHeader(head, COLORS.title);
  members.forEach((m, i) => (head.getCell(memberCols[i]).fill = fill(solid(m))));
  if (combinedCol) head.getCell(combinedCol).fill = fill(COLORS.combined);

  const ref = (m: Member, c: string) => `'${names.get(m.id)}'!${c}:${c}`;
  const sumAcross = (rowNum: number) =>
    `SUM(${col(memberCols[0])}${rowNum}:${col(memberCols[memberCols.length - 1])}${rowNum})`;

  /** Adds a metric row; `combined` is the formula/value for the Combined column (groups only). */
  const metric = (
    label: string,
    perMember: ExcelJS.CellValue[],
    combined: (rowNum: number) => ExcelJS.CellValue,
    numFmt?: string,
    bold = false,
  ) => {
    const row = sum.addRow([label, ...perMember]);
    if (combinedCol) row.getCell(combinedCol).value = combined(row.number);
    styleBody(row);
    row.getCell(1).font = { bold: true };
    members.forEach((m, i) => (row.getCell(memberCols[i]).fill = fill(light(m))));
    if (combinedCol) row.getCell(combinedCol).fill = fill(COLORS.combinedLight);
    for (let c = 2; c <= (combinedCol ?? members.length + 1); c++) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: "right", vertical: "middle" };
      if (numFmt) cell.numFmt = numFmt;
      if (bold) cell.font = { bold: true };
    }
    return row;
  };

  const savedRow = metric(
    "Total saved",
    members.map((m) => ({ formula: `SUMIFS(${ref(m, "B")},${ref(m, "C")},"Done")`, result: stats[m.id].total })),
    (r) => ({ formula: sumAcross(r), result: total }),
    INR,
    true,
  );
  const targetRow = metric("Target", members.map(() => each), () => goal, INR);
  const pctRow = metric(
    "Progress",
    members.map((m, i) => ({
      formula: `IFERROR(${col(memberCols[i])}${savedRow.number}/${col(memberCols[i])}${targetRow.number},0)`,
      result: each ? stats[m.id].total / each : 0,
    })),
    () => ({
      formula: `IFERROR(${col(combinedCol ?? 2)}${savedRow.number}/${col(combinedCol ?? 2)}${targetRow.number},0)`,
      result: goal ? total / goal : 0,
    }),
    PCT,
    true,
  );
  sum.addConditionalFormatting({
    ref: `B${pctRow.number}:${lastCol}${pctRow.number}`,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        minLength: 0,
        maxLength: 100,
        cfvo: [
          { type: "num", value: 0 },
          { type: "num", value: 1 },
        ],
        color: { argb: COLORS.combined },
        gradient: false,
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
  const doneRow = metric(
    "Boxes completed",
    members.map((m) => ({ formula: `COUNTIFS(${ref(m, "C")},"Done")`, result: stats[m.id].count })),
    (r) => ({ formula: sumAcross(r), result: members.reduce((a, m) => a + stats[m.id].count, 0) }),
  );
  metric(
    "Boxes remaining",
    members.map((m, i) => ({
      formula: `${plan.count}-${col(memberCols[i])}${doneRow.number}`,
      result: plan.count - stats[m.id].count,
    })),
    (r) => ({ formula: sumAcross(r), result: plan.count * members.length - members.reduce((a, m) => a + stats[m.id].count, 0) }),
  );
  metric(
    "Last active",
    members.map((m) => (stats[m.id].lastActive ? toIST(stats[m.id].lastActive as string) : "—")),
    () => null,
    DATE_TIME,
  );

  const bref = (c: string) => `'${BUCKET_SHEET}'!${c}:${c}`;
  const planned = (m: Member) => bucket.filter((b) => b.memberId === m.id).reduce((a, b) => a + (b.estCost ?? 0), 0);
  metric(
    "Bucket list — planned spend",
    members.map((m) => ({ formula: `SUMIFS(${bref("C")},${bref("A")},"${m.name}")`, result: planned(m) })),
    (r) => ({ formula: sumAcross(r), result: members.reduce((a, m) => a + planned(m), 0) }),
    INR,
  );
  metric(
    "Bucket list — items done",
    members.map((m) => ({
      formula: `COUNTIFS(${bref("A")},"${m.name}",${bref("D")},"Done")`,
      result: bucket.filter((b) => b.memberId === m.id && b.isDone).length,
    })),
    (r) => ({ formula: sumAcross(r), result: bucket.filter((b) => b.isDone).length }),
  );

  sum.addRow([]);
  if (!solo) {
    const leadRow = sum.addRow([
      "🏆 Current leader",
      leader ? `${leader.name} (${inr(stats[leader.id].total)})` : "Tied",
    ]);
    sum.mergeCells(`B${leadRow.number}:${lastCol}${leadRow.number}`);
    leadRow.getCell(1).font = { bold: true };
    leadRow.getCell(2).font = { bold: true, color: { argb: COLORS.amberText } };
    leadRow.getCell(2).fill = fill(COLORS.amber);
  }
  const stakes = sum.addRow([stakesLine(members.length)]);
  sum.mergeCells(`A${stakes.number}:${lastCol}${stakes.number}`);
  stakes.getCell(1).font = { italic: true, color: { argb: COLORS.title } };

  // -------------------------------------------------------------------------
  // One sheet per person's boxes
  // -------------------------------------------------------------------------
  for (const m of members) {
    const ws = wb.addWorksheet(names.get(m.id) as string, {
      views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
      properties: { tabColor: { argb: solid(m) } },
    });
    ws.columns = [{ width: 8 }, { width: 14 }, { width: 13 }, { width: 24 }, { width: 18 }];
    addTitle(
      ws,
      `${m.emoji} ${m.name}'s ${plan.count} boxes`,
      `${inr(plan.start)} → ${inr(lastBox(plan))} · target ${inr(each)}`,
      "E",
    );
    const h = ws.addRow(["Box #", "Amount", "Status", "Ticked on (IST)", "Saved so far"]);
    styleHeader(h, solid(m));

    const mine = boxes.filter((b) => b.memberId === m.id).sort((a, b) => a.amount - b.amount);
    const first = h.number + 1;
    mine.forEach((b, i) => {
      const r = ws.addRow([
        i + 1,
        b.amount,
        b.isChecked ? "Done" : "Remaining",
        b.isChecked && b.checkedAt ? toIST(b.checkedAt) : "",
        { formula: `SUMIFS($B$${first}:B${first + i},$C$${first}:C${first + i},"Done")` },
      ]);
      styleBody(r, b.isChecked ? COLORS.done : undefined, b.isChecked ? COLORS.doneText : undefined);
      r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(2).numFmt = INR;
      r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(4).numFmt = DATE_TIME;
      r.getCell(5).numFmt = INR;
      if (!b.isChecked) r.getCell(3).font = { color: { argb: COLORS.pendingText } };
    });
    const last = first + Math.max(mine.length, 1) - 1;
    const tot = ws.addRow([
      "Total",
      { formula: `SUBTOTAL(109,B${first}:B${last})`, result: each },
      { formula: `COUNTIF(C${first}:C${last},"Done")&" / ${mine.length} done"`, result: `${stats[m.id].count} / ${mine.length} done` },
      "",
      { formula: `SUMIFS(B${first}:B${last},C${first}:C${last},"Done")`, result: stats[m.id].total },
    ]);
    styleBody(tot, light(m));
    tot.font = { bold: true };
    tot.getCell(2).numFmt = INR;
    tot.getCell(5).numFmt = INR;
    ws.autoFilter = { from: { row: h.number, column: 1 }, to: { row: last, column: 5 } };
  }

  // -------------------------------------------------------------------------
  // Sunday Money Dates
  // -------------------------------------------------------------------------
  const md = wb.addWorksheet("Money Dates", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: "FFF59E0B" } },
  });
  md.columns = [{ width: 7 }, { width: 20 }, { width: 16 }, { width: 12 }, { width: 18 }, { width: 38 }, { width: 40 }];
  addTitle(
    md,
    solo ? "🗓️ Sunday check-ins — 2027" : "☕ Sunday Money Dates — 2027",
    solo
      ? "Every Sunday: look back at your week."
      : "Every Sunday: review the boxes together. Fewest ticks that week buys the chai.",
    "G",
  );
  const mh = md.addRow(["Week", "Sunday", "Month", "Done?", solo ? "—" : "Chai paid by", solo ? "Note" : "Why", "Notes"]);
  styleHeader(mh, "FFD97706");
  for (const d of dates) {
    const v = chaiVerdict(boxes, members, d.weekIndex);
    const r = md.addRow([
      d.weekIndex,
      dateOnly(d.sundayDate),
      monthOf(d.sundayDate),
      d.isCompleted ? "✅ Yes" : "No",
      solo ? "" : v.payer ? v.payer.name : "Split 🤝",
      solo ? "" : v.reason,
      d.notes,
    ]);
    styleBody(r, d.isCompleted ? COLORS.done : undefined);
    r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).numFmt = DATE;
    r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(4).font = { bold: d.isCompleted, color: { argb: d.isCompleted ? COLORS.doneText : COLORS.pendingText } };
    const payer = r.getCell(5);
    payer.font = { bold: true, color: { argb: v.payer ? solid(v.payer) : COLORS.ink } };
    payer.alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(6).font = { color: { argb: COLORS.pendingText } };
    r.getCell(7).alignment = { wrapText: true, vertical: "middle" };
  }
  md.autoFilter = { from: { row: mh.number, column: 1 }, to: { row: mh.number + dates.length, column: 7 } };

  // -------------------------------------------------------------------------
  // Bucket lists
  // -------------------------------------------------------------------------
  const bl = wb.addWorksheet(BUCKET_SHEET, {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: "FF7C3AED" } },
  });
  bl.columns = [{ width: 16 }, { width: 42 }, { width: 16 }, { width: 12 }, { width: 18 }];
  addTitle(bl, "🎯 What the money is for", solo ? "My bucket list" : "Each person's own bucket list", "E");
  const bh = bl.addRow(["Owner", "Item", "Est. cost", "Status", "Added on"]);
  styleHeader(bh, "FF7C3AED");
  const byId = new Map(members.map((m) => [m.id, m]));
  const order = new Map(members.map((m, i) => [m.id, i]));
  const ordered = [...bucket]
    .filter((b) => byId.has(b.memberId))
    .sort((a, b) => (order.get(a.memberId)! - order.get(b.memberId)!) || a.createdAt.localeCompare(b.createdAt));
  for (const item of ordered) {
    const m = byId.get(item.memberId) as Member;
    const r = bl.addRow([m.name, item.title, item.estCost ?? "", item.isDone ? "Done" : "Planned", toIST(item.createdAt)]);
    styleBody(r, item.isDone ? COLORS.done : light(m));
    r.getCell(1).font = { bold: true, color: { argb: solid(m) } };
    r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    r.getCell(3).numFmt = INR;
    r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(4).font = { color: { argb: item.isDone ? COLORS.doneText : COLORS.pendingText }, bold: item.isDone };
    r.getCell(5).numFmt = DATE;
  }
  if (ordered.length === 0) {
    const r = bl.addRow(["", "No bucket list items yet — add some in the app ✨"]);
    r.getCell(2).font = { italic: true, color: { argb: COLORS.pendingText } };
  }
  bl.addRow([]);
  for (const m of members) {
    const r = bl.addRow([`${m.name} total`, "", planned(m)]);
    r.font = { bold: true };
    r.getCell(3).numFmt = INR;
    styleBody(r, light(m));
  }

  // Print nicely: one page wide, as many pages tall as needed.
  wb.eachSheet((ws) => {
    ws.pageSetup = { ...ws.pageSetup, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
