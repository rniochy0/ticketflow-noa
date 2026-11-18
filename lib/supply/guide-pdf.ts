import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type GuideLine = { name: string; ref: string | null; unit: string; qty: number };

export type GuideData = {
  number: string;
  requestNumber: string;
  issuedAt: string; // ISO
  issuedByName: string;
  receivedByName: string;
  requesterName: string;
  storeName: string;
  notes: string | null;
  lines: GuideLine[];
  logoPng?: Uint8Array;
};

// As fontes padrão do PDF só aceitam Latin-1 (cobre o português). Qualquer outro
// carácter (emoji, etc.) faria o pdf-lib lançar erro: substituímos por "?".
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxWidth) t = t.slice(0, -1);
  return t + "...";
}

const W = 595.28;
const H = 841.89;
const M = 48;

export async function buildGuidePdf(data: GuideData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Guia de entrega ${data.number}`);
  doc.setProducer("NOA HelpDesk");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.42, 0.46);
  const line = rgb(0.8, 0.82, 0.85);

  let logo: Awaited<ReturnType<typeof doc.embedPng>> | undefined;
  if (data.logoPng) {
    try {
      logo = await doc.embedPng(data.logoPng);
    } catch {
      logo = undefined;
    }
  }

  const text = (page: PDFPage, s: string, x: number, y: number, size = 10, f = font, color = ink) =>
    page.drawText(clean(s), { x, y, size, font: f, color });

  const header = (page: PDFPage) => {
    if (logo) {
      const h = 38;
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: M, y: H - M - h, width: Math.min(w, 150), height: h });
    } else {
      text(page, "NOA Óticas", M, H - M - 18, 20, bold);
    }
    const title = "GUIA DE ENTREGA";
    text(page, title, W - M - bold.widthOfTextAtSize(title, 16), H - M - 14, 16, bold);
    const num = clean(data.number);
    text(page, num, W - M - font.widthOfTextAtSize(num, 11), H - M - 32, 11, font, muted);
    page.drawLine({ start: { x: M, y: H - M - 52 }, end: { x: W - M, y: H - M - 52 }, thickness: 1, color: line });
  };

  let page = doc.addPage([W, H]);
  header(page);
  let y = H - M - 76;

  const issued = new Date(data.issuedAt).toLocaleString("pt-PT", {
    timeZone: "Africa/Luanda",
    dateStyle: "short",
    timeStyle: "short",
  });

  // metadados em duas colunas
  const meta: [string, string][] = [
    ["Data", issued],
    ["Pedido", data.requestNumber],
    ["Site", data.storeName],
    ["Solicitante", data.requesterName],
    ["Entregue por", data.issuedByName],
    ["Recebido por", data.receivedByName],
  ];
  const colW = (W - 2 * M) / 2;
  meta.forEach(([label, value], i) => {
    const x = M + (i % 2) * colW;
    const yy = y - Math.floor(i / 2) * 36;
    text(page, label.toUpperCase(), x, yy, 8, bold, muted);
    text(page, fit(value || "-", font, 11, colW - 12), x, yy - 14, 11);
  });
  y -= Math.ceil(meta.length / 2) * 36 + 12;

  // tabela
  const cols = { ref: M, name: M + 110, qty: W - M - 90, unit: W - M - 40 };
  const tableHeader = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: M, y: yy - 6, width: W - 2 * M, height: 22, color: rgb(0.95, 0.96, 0.97) });
    text(p, "Referência", cols.ref + 6, yy, 9, bold);
    text(p, "Descrição", cols.name, yy, 9, bold);
    text(p, "Qtd", cols.qty, yy, 9, bold);
    text(p, "Un.", cols.unit, yy, 9, bold);
  };
  tableHeader(page, y);
  y -= 26;

  for (const l of data.lines) {
    if (y < M + 170) {
      page = doc.addPage([W, H]);
      header(page);
      y = H - M - 76;
      tableHeader(page, y);
      y -= 26;
    }
    text(page, fit(l.ref ?? "-", font, 10, 100), cols.ref + 6, y);
    text(page, fit(l.name, font, 10, cols.qty - cols.name - 12), cols.name, y);
    text(page, String(l.qty), cols.qty, y, 10, bold);
    text(page, fit(l.unit, font, 10, 40), cols.unit, y);
    page.drawLine({ start: { x: M, y: y - 8 }, end: { x: W - M, y: y - 8 }, thickness: 0.5, color: line });
    y -= 22;
  }

  if (data.notes) {
    y -= 6;
    text(page, "NOTAS", M, y, 8, bold, muted);
    y -= 14;
    // quebra simples por largura, no máximo 4 linhas
    const words = clean(data.notes).split(/\s+/);
    let cur = "";
    let n = 0;
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, 10) > W - 2 * M && cur) {
        text(page, cur, M, y);
        y -= 13;
        cur = w;
        if (++n >= 4) break;
      } else cur = next;
    }
    if (n < 4 && cur) {
      text(page, cur, M, y);
      y -= 13;
    }
  }

  // assinaturas (sempre na última página, com espaço garantido)
  const sigY = Math.min(y - 50, M + 90);
  const sigW = (W - 2 * M - 40) / 2;
  [
    ["Entregue por", data.issuedByName],
    ["Recebido por", data.receivedByName],
  ].forEach(([label, name], i) => {
    const x = M + i * (sigW + 40);
    page.drawLine({ start: { x, y: sigY }, end: { x: x + sigW, y: sigY }, thickness: 0.8, color: ink });
    text(page, label, x, sigY - 13, 9, bold);
    text(page, fit(name, font, 9, sigW), x, sigY - 25, 9, font, muted);
  });

  const footer = `Documento emitido pelo NOA HelpDesk em ${issued}. Conferir os artigos no ato da receção.`;
  text(page, footer, M, M - 14, 8, font, muted);

  return doc.save();
}
