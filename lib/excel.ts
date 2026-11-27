import "server-only";
import ExcelJS from "exceljs";
import {
  PLAYER_KEYS,
  PLAYERS,
  monthOf,
  type Player,
} from "./constants";
import { lastBox, planTarget, type Plan } from "./plan";
import { chaiVerdict, computeStats, leaderOf } from "./stats";
import type { BoxRow, BucketItem, MoneyDateRow } from "./types";

// Indian digit grouping: ₹1,37,800 / ₹12,34,567
const INR = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
const PCT = "0.0%";
const DATE_TIME = "dd-mmm-yyyy hh:mm AM/PM";
const DATE = "ddd, dd-mmm-yyyy";

const COLORS = {
  ink: "FF18181B",
  white: "FFFFFFFF",
  title: "FF1E1B4B",
  husband: "FF0284C7",
  husbandLight: "FFE0F2FE",
  wife: "FFDB2777",
  wifeLight: "FFFCE7F3",
  combined: "FF059669",
  combinedLight: "FFD1FAE5",
  done: "FFDCFCE7",
  doneText: "FF166534",
  pending: "FFF4F4F5",
  pendingText: "FF71717A",
  amber: "FFFEF3C7",
  amberText: "FF92400E",
  border: "FFD4D4D8",
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Excel has no time zones: shift so the sheet shows Indian time. */
const toIST = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS);
const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

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

const playerColor = (p: Player) => (p === "husband" ? COLORS.husband : COLORS.wife);
const playerLight = (p: Player) => (p === "husband" ? COLORS.husbandLight : COLORS.wifeLight);
const boxesSheetName = (p: Player) => `${PLAYERS[p].name} Boxes`;
const bucketSheetName = "Bucket Lists";

export async function buildWorkbook(data: {
  boxes: BoxRow[];
  dates: MoneyDateRow[];
  bucket: BucketItem[];
  plan: Plan;
}): Promise<Buffer> {
  const { boxes, dates, bucket, plan } = data;
  const BOX_COUNT = plan.count;
  const INDIVIDUAL_TARGET = planTarget(plan);
  const COMBINED_TARGET = INDIVIDUAL_TARGET * 2;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const stats = computeStats(boxes);
  const leader = leaderOf(stats);
  const exportedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Husband vs Wife 2027";
  wb.created = new Date();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const sum = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.title } },
  });
  sum.columns = [{ width: 30 }, { width: 22 }, { width: 22 }, { width: 22 }];
  addTitle(
    sum,
    "Husband 🆚 Wife — 2027 Savings",
    `Plan: ${inr(plan.start)} → ${inr(lastBox(plan))} in steps of ${inr(plan.step)} · ${BOX_COUNT} boxes each · exported ${exportedAt} IST`,
    "D",
  );
  sum.addRow([]);

  const head = sum.addRow(["", PLAYERS.husband.name, PLAYERS.wife.name, "Combined"]);
  styleHeader(head, COLORS.title);
  head.getCell(2).fill = fill(COLORS.husband);
  head.getCell(3).fill = fill(COLORS.wife);
  head.getCell(4).fill = fill(COLORS.combined);

  const ref = (p: Player, col: string) => `'${boxesSheetName(p)}'!${col}:${col}`;
  const savedF = (p: Player) => `SUMIFS(${ref(p, "B")},${ref(p, "C")},"Done")`;
  const countF = (p: Player) => `COUNTIFS(${ref(p, "C")},"Done")`;

  const metric = (label: string, cells: ExcelJS.CellValue[], numFmt?: string, bold = false) => {
    const row = sum.addRow([label, ...cells]);
    styleBody(row);
    row.getCell(1).font = { bold: true };
    for (let c = 2; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: "right", vertical: "middle" };
      if (numFmt) cell.numFmt = numFmt;
      if (bold) cell.font = { bold: true };
    }
    row.getCell(2).fill = fill(COLORS.husbandLight);
    row.getCell(3).fill = fill(COLORS.wifeLight);
    row.getCell(4).fill = fill(COLORS.combinedLight);
    return row;
  };

  const savedRow = metric(
    "Total saved",
    [
      { formula: savedF("husband"), result: stats.husband.total },
      { formula: savedF("wife"), result: stats.wife.total },
      { formula: "", result: stats.husband.total + stats.wife.total },
    ],
    INR,
    true,
  );
  savedRow.getCell(4).value = {
    formula: `B${savedRow.number}+C${savedRow.number}`,
    result: stats.husband.total + stats.wife.total,
  };

  const targetRow = metric("Target", [INDIVIDUAL_TARGET, INDIVIDUAL_TARGET, COMBINED_TARGET], INR);
  const pctRow = metric(
    "Progress",
    ["B", "C", "D"].map((col, i) => ({
      formula: `IFERROR(${col}${savedRow.number}/${col}${targetRow.number},0)`,
      result:
        i === 0
          ? stats.husband.total / INDIVIDUAL_TARGET
          : i === 1
            ? stats.wife.total / INDIVIDUAL_TARGET
            : (stats.husband.total + stats.wife.total) / COMBINED_TARGET,
    })),
    PCT,
    true,
  );
  // Progress bars right in the cells
  sum.addConditionalFormatting({
    ref: `B${pctRow.number}:D${pctRow.number}`,
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

  const doneRow = metric("Boxes completed", [
    { formula: countF("husband"), result: stats.husband.count },
    { formula: countF("wife"), result: stats.wife.count },
    { formula: "", result: stats.husband.count + stats.wife.count },
  ]);
  doneRow.getCell(4).value = {
    formula: `B${doneRow.number}+C${doneRow.number}`,
    result: stats.husband.count + stats.wife.count,
  };
  metric("Boxes remaining", [
    { formula: `${BOX_COUNT}-B${doneRow.number}`, result: BOX_COUNT - stats.husband.count },
    { formula: `${BOX_COUNT}-C${doneRow.number}`, result: BOX_COUNT - stats.wife.count },
    {
      formula: `${BOX_COUNT * 2}-D${doneRow.number}`,
      result: BOX_COUNT * 2 - stats.husband.count - stats.wife.count,
    },
  ]);
  const lastRow = metric(
    "Last active",
    [
      stats.husband.lastActive ? toIST(stats.husband.lastActive) : "—",
      stats.wife.lastActive ? toIST(stats.wife.lastActive) : "—",
      "",
    ],
    DATE_TIME,
  );
  lastRow.getCell(4).value = null;

  const planned = (p: Player) =>
    bucket.filter((b) => b.player === p).reduce((a, b) => a + (b.estCost ?? 0), 0);
  const bref = (col: string) => `'${bucketSheetName}'!${col}:${col}`;
  const plannedRow = metric(
    "Bucket list — planned spend",
    PLAYER_KEYS.map((p) => ({
      formula: `SUMIFS(${bref("C")},${bref("A")},"${PLAYERS[p].name}")`,
      result: planned(p),
    })),
    INR,
  );
  plannedRow.getCell(4).value = {
    formula: `B${plannedRow.number}+C${plannedRow.number}`,
    result: planned("husband") + planned("wife"),
  };
  metric(
    "Bucket list — items done",
    [
      ...PLAYER_KEYS.map((p) => ({
        formula: `COUNTIFS(${bref("A")},"${PLAYERS[p].name}",${bref("D")},"Done")`,
        result: bucket.filter((b) => b.player === p && b.isDone).length,
      })),
      bucket.filter((b) => b.isDone).length,
    ],
  );

  sum.addRow([]);
  const leadRow = sum.addRow([
    "🏆 Current leader",
    leader ? `${PLAYERS[leader].name} (by ₹${Math.abs(stats.husband.total - stats.wife.total).toLocaleString("en-IN")})` : "Tied",
  ]);
  sum.mergeCells(`B${leadRow.number}:D${leadRow.number}`);
  leadRow.getCell(1).font = { bold: true };
  leadRow.getCell(2).font = { bold: true, color: { argb: COLORS.amberText } };
  leadRow.getCell(2).fill = fill(COLORS.amber);

  const stakes = sum.addRow(["✈️ Whoever quits first sponsors the other's 2028 trip"]);
  sum.mergeCells(`A${stakes.number}:D${stakes.number}`);
  stakes.getCell(1).font = { italic: true, color: { argb: COLORS.title } };

  // -------------------------------------------------------------------------
  // One sheet per player's boxes
  // -------------------------------------------------------------------------
  for (const p of PLAYER_KEYS) {
    const ws = wb.addWorksheet(boxesSheetName(p), {
      views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
      properties: { tabColor: { argb: playerColor(p) } },
    });
    ws.columns = [
      { key: "n", width: 8 },
      { key: "amount", width: 14 },
      { key: "status", width: 13 },
      { key: "at", width: 24 },
      { key: "running", width: 18 },
    ];
    addTitle(
      ws,
      `${PLAYERS[p].emoji} ${PLAYERS[p].name}'s ${BOX_COUNT} boxes`,
      `${inr(plan.start)} → ${inr(lastBox(plan))} · target ${inr(INDIVIDUAL_TARGET)}`,
      "E",
    );
    const h = ws.addRow(["Box #", "Amount", "Status", "Ticked on (IST)", "Saved so far"]);
    styleHeader(h, playerColor(p));

    const mine = boxes.filter((b) => b.player === p).sort((a, b) => a.amount - b.amount);
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
    const last = first + mine.length - 1;
    const tot = ws.addRow([
      "Total",
      { formula: `SUBTOTAL(109,B${first}:B${last})`, result: INDIVIDUAL_TARGET },
      { formula: `COUNTIF(C${first}:C${last},"Done")&" / ${mine.length} done"`, result: `${stats[p].count} / ${mine.length} done` },
      "",
      { formula: `SUMIFS(B${first}:B${last},C${first}:C${last},"Done")`, result: stats[p].total },
    ]);
    styleBody(tot, playerLight(p));
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
  md.columns = [
    { width: 7 },
    { width: 20 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
    { width: 34 },
    { width: 40 },
  ];
  addTitle(md, "☕ Sunday Money Dates — 2027", "Every Sunday: review the boxes together. Fewer ticks that week buys the chai.", "G");
  const mh = md.addRow(["Week", "Sunday", "Month", "Done?", "Chai paid by", "Why", "Notes"]);
  styleHeader(mh, "FFD97706");
  for (const d of dates) {
    const v = chaiVerdict(boxes, d.weekIndex);
    const r = md.addRow([
      d.weekIndex,
      dateOnly(d.sundayDate),
      monthOf(d.sundayDate),
      d.isCompleted ? "✅ Yes" : "No",
      v.payer ? PLAYERS[v.payer].name : "Split 🤝",
      v.reason,
      d.notes,
    ]);
    styleBody(r, d.isCompleted ? COLORS.done : undefined);
    r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).numFmt = DATE;
    r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(4).font = { bold: d.isCompleted, color: { argb: d.isCompleted ? COLORS.doneText : COLORS.pendingText } };
    const payer = r.getCell(5);
    payer.font = { bold: true, color: { argb: v.payer ? playerColor(v.payer) : COLORS.ink } };
    payer.alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(6).font = { color: { argb: COLORS.pendingText } };
    r.getCell(7).alignment = { wrapText: true, vertical: "middle" };
  }
  md.autoFilter = { from: { row: mh.number, column: 1 }, to: { row: mh.number + dates.length, column: 7 } };

  // -------------------------------------------------------------------------
  // Bucket lists
  // -------------------------------------------------------------------------
  const bl = wb.addWorksheet(bucketSheetName, {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    properties: { tabColor: { argb: "FF7C3AED" } },
  });
  bl.columns = [{ width: 14 }, { width: 42 }, { width: 16 }, { width: 12 }, { width: 18 }];
  addTitle(bl, "🎯 What the money is for", "Each person's own bucket list", "E");
  const bh = bl.addRow(["Owner", "Item", "Est. cost", "Status", "Added on"]);
  styleHeader(bh, "FF7C3AED");
  const ordered = [...bucket].sort((a, b) =>
    a.player === b.player ? a.createdAt.localeCompare(b.createdAt) : a.player.localeCompare(b.player),
  );
  for (const item of ordered) {
    const r = bl.addRow([
      PLAYERS[item.player].name,
      item.title,
      item.estCost ?? "",
      item.isDone ? "Done" : "Planned",
      toIST(item.createdAt),
    ]);
    styleBody(r, item.isDone ? COLORS.done : playerLight(item.player));
    r.getCell(1).font = { bold: true, color: { argb: playerColor(item.player) } };
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
  for (const p of PLAYER_KEYS) {
    const r = bl.addRow([`${PLAYERS[p].name} total`, "", planned(p)]);
    r.font = { bold: true };
    r.getCell(3).numFmt = INR;
    styleBody(r, playerLight(p));
  }

  // Print nicely: one page wide, as many pages tall as needed.
  wb.eachSheet((ws) => {
    ws.pageSetup = { ...ws.pageSetup, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
