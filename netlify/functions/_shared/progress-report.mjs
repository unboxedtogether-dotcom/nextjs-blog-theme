import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { describeCheckinAnswers, scoreCategories, scoreDisclaimer, submissionTitle } from '../../../utils/progress-checkin.mjs';
import { formatChange, weekLabel } from '../../../utils/progress-timeline.mjs';

// Server-generated PDF progress report. Built on demand for the signed-in
// member (or an authorised admin) and streamed straight back; nothing is stored.

const hex = (value) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const colors = { blue: hex('#1843f4'), orange: hex('#f29a1f'), line: hex('#d97a00'), ink: hex('#2a2c31'), muted: hex('#5b5f68'), rule: hex('#dfe4fa'), pale: hex('#fff5e8') };
const page = { width: 595.28, height: 841.89, margin: 48 };

// Standard PDF fonts only cover Latin-1; swap common punctuation and drop the rest.
const clean = (value) => String(value ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[•·]/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : '-');
const score = (value) => (value === null || value === undefined ? '-' : String(Math.round(value)));

class Writer {
  constructor(doc, fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([page.width, page.height]);
    this.y = page.height - page.margin;
  }

  ensure(space) {
    if (this.y - space < page.margin + 20) this.newPage();
  }

  wrap(text, size, width, font = this.fonts.regular) {
    const lines = [];
    for (const paragraph of clean(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
      }
      lines.push(line);
    }
    return lines;
  }

  text(value, { size = 10, bold = false, color = colors.ink, x = page.margin, width = page.width - page.margin * 2, gap = 4 } = {}) {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    for (const line of this.wrap(value, size, width, font)) {
      this.ensure(size + gap);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= size + gap;
    }
  }

  heading(value) {
    this.ensure(40);
    this.y -= 12;
    this.page.drawRectangle({ x: page.margin, y: this.y - 16, width: 4, height: 16, color: colors.orange });
    this.page.drawText(clean(value), { x: page.margin + 12, y: this.y - 14, size: 14, font: this.fonts.bold, color: colors.blue });
    this.y -= 26;
  }

  rule() {
    this.page.drawLine({ start: { x: page.margin, y: this.y }, end: { x: page.width - page.margin, y: this.y }, thickness: 0.5, color: colors.rule });
    this.y -= 6;
  }

  table(columns, rows) {
    const width = page.width - page.margin * 2;
    const total = columns.reduce((sum, column) => sum + column.share, 0);
    const xs = [];
    let x = page.margin;
    for (const column of columns) { xs.push(x); x += (column.share / total) * width; }
    const drawRow = (cells, bold) => {
      const heights = cells.map((cell, index) => this.wrap(cell, 8.5, (columns[index].share / total) * width - 6, bold ? this.fonts.bold : this.fonts.regular).length);
      const height = Math.max(...heights) * 11 + 6;
      this.ensure(height);
      cells.forEach((cell, index) => {
        this.wrap(cell, 8.5, (columns[index].share / total) * width - 6, bold ? this.fonts.bold : this.fonts.regular).forEach((line, lineIndex) => {
          this.page.drawText(line, { x: xs[index], y: this.y - 10 - lineIndex * 11, size: 8.5, font: bold ? this.fonts.bold : this.fonts.regular, color: bold ? colors.blue : colors.ink });
        });
      });
      this.y -= height;
      this.rule();
    };
    drawRow(columns.map((column) => column.label), true);
    rows.forEach((row) => drawRow(row, false));
  }

  chart(weeks) {
    const height = 170;
    this.ensure(height + 30);
    const left = page.margin + 24;
    const right = page.width - page.margin;
    const top = this.y - 8;
    const bottom = top - height;
    for (const value of [0, 25, 50, 75, 100]) {
      const y = bottom + (value / 100) * height;
      this.page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.4, color: colors.rule });
      this.page.drawText(String(value), { x: page.margin, y: y - 3, size: 7, font: this.fonts.regular, color: colors.muted });
    }
    const step = weeks.length > 1 ? (right - left - 10) / (weeks.length - 1) : 0;
    const points = weeks.map((week, index) => ({ week, x: left + 5 + index * step, y: week.status === 'complete' ? bottom + (week.overall / 100) * height : null }));
    let previous = null;
    for (const point of points) {
      if (point.y !== null && previous) this.page.drawLine({ start: { x: previous.x, y: previous.y }, end: { x: point.x, y: point.y }, thickness: 2, color: colors.line });
      if (point.y !== null) previous = point;
      else if (point.week.status === 'missed') previous = null;
    }
    const labelEvery = Math.ceil(weeks.length / 12);
    points.forEach((point, index) => {
      if (point.y !== null) this.page.drawCircle({ x: point.x, y: point.y, size: 3, color: colors.line, borderColor: rgb(1, 1, 1), borderWidth: 1 });
      if (index % labelEvery === 0 || index === points.length - 1) {
        const label = point.week.weekNumber === 0 ? 'Base' : `W${point.week.weekNumber}`;
        this.page.drawText(label, { x: point.x - 8, y: bottom - 12, size: 7, font: this.fonts.regular, color: colors.muted });
      }
    });
    this.y = bottom - 24;
    this.text('Missed weeks are shown as breaks in the line, not as zero. Incomplete check-ins are not plotted.', { size: 8, color: colors.muted });
  }
}

export async function buildProgressReport({ memberName, audience, timeline, submissions, adminNotes = [] }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Unboxed Together progress report - ${clean(memberName)}`);
  doc.setAuthor('Unboxed Together');
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const w = new Writer(doc, fonts);

  w.page.drawText('UNBOXED', { x: page.margin, y: w.y - 18, size: 20, font: fonts.bold, color: colors.blue });
  w.page.drawText('TOGETHER', { x: page.margin + fonts.bold.widthOfTextAtSize('UNBOXED ', 20), y: w.y - 18, size: 20, font: fonts.bold, color: colors.orange });
  w.y -= 30;
  w.page.drawRectangle({ x: page.margin, y: w.y, width: page.width - page.margin * 2, height: 3, color: colors.orange });
  w.y -= 18;
  w.text('Personal progress report', { size: 18, bold: true });
  w.text(`${memberName} - generated ${formatDate(new Date())}${audience === 'admin' ? ' by an authorised Unboxed Together administrator' : ''}`, { size: 10, color: colors.muted });
  w.text('Confidential. Contains personal health and wellbeing information. Store securely and do not share without the member\'s agreement.', { size: 9, bold: true, color: hex('#a85400') });
  w.text(scoreDisclaimer, { size: 9, color: colors.muted });

  const { summary, weeks } = timeline;
  w.heading('Summary');
  w.table([{ label: 'Measure', share: 2 }, { label: 'Value', share: 3 }], [
    ['Current weekly score', summary.currentScore === null ? 'No completed weekly check-in yet' : `${score(summary.currentScore)}/100 (${weekLabel(summary.currentWeekNumber)})`],
    ['Previous score', summary.previousScore === null ? '-' : `${score(summary.previousScore)}/100 (${weekLabel(summary.previousWeekNumber)})`],
    ['Change in points', summary.change === null ? '-' : formatChange(summary.change)],
    ['Baseline score', summary.baselineScore === null ? 'Not available' : `${score(summary.baselineScore)}/100`],
    ['Total change from baseline', summary.changeFromBaseline === null ? '-' : formatChange(summary.changeFromBaseline)],
    ['Last completed check-in', formatDate(summary.lastCheckInAt)],
    ['Weeks completed / missed / incomplete', `${summary.completedCount} / ${summary.missedCount} / ${summary.incompleteCount}`],
  ]);

  if (weeks.length) {
    w.heading('Overall score over time');
    w.chart(weeks);
    w.heading('Week by week');
    w.table([
      { label: 'Week', share: 1.3 }, { label: 'Submitted', share: 1.6 }, { label: 'Overall', share: 1 }, { label: 'Change', share: 1 },
      ...scoreCategories.map((category) => ({ label: category.label, share: 1.1 })),
    ], weeks.slice().reverse().map((week) => (week.status === 'missed' || week.status === 'due' ? [
      weekLabel(week.weekNumber), week.status === 'due' ? 'Due this week' : 'No check-in', '-', '-', ...scoreCategories.map(() => '-'),
    ] : [
      weekLabel(week.weekNumber), formatDate(week.submittedAt), week.status === 'complete' ? score(week.overall) : 'Incomplete',
      week.change === null ? '-' : formatChange(week.change),
      ...scoreCategories.map((category) => score(week.categories?.[category.key]?.score)),
    ])));

    for (const week of weeks.filter((item) => item.status === 'complete' || item.status === 'incomplete')) {
      w.heading(`${weekLabel(week.weekNumber)} - original answers`);
      w.text(`Submitted ${formatDate(week.submittedAt)}${week.revisionNumber ? ` (correction ${week.revisionNumber}; original ${formatDate(week.originalSubmittedAt)})` : ''}. Scoring ${week.scoringVersion || '-'}.`, { size: 8.5, color: colors.muted });
      w.table([{ label: 'Question', share: 3 }, { label: 'Answer', share: 2 }], describeCheckinAnswers(week.answers).map((row) => [row.label, row.value ?? 'Not answered']));
      for (const note of week.notes || []) {
        w.text(`${note.authorRole === 'admin' ? 'Private team note' : 'Member note'} (${formatDate(note.createdAt)}): ${note.body}`, { size: 9 });
      }
    }
  }

  w.heading('Forms and assessments on record');
  w.table([{ label: 'Form', share: 4 }, { label: 'Submitted', share: 1.6 }, { label: 'Status', share: 2 }], submissions.map((item) => [
    submissionTitle(item),
    formatDate(item.submitted_at),
    [item.source === 'backfill' ? 'Recorded from earlier answers' : item.status === 'incomplete' ? 'Incomplete (not scored)' : 'Submitted', item.revision_number ? `revision ${item.revision_number}` : ''].filter(Boolean).join(', '),
  ]));

  if (audience === 'admin' && adminNotes.length) {
    w.heading('Private team notes');
    for (const note of adminNotes) w.text(`${formatDate(note.createdAt)}: ${note.body}`, { size: 9 });
  }

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    item.drawText(clean(`Unboxed Together - confidential - page ${index + 1} of ${pages.length}`), { x: page.margin, y: 24, size: 7.5, font: fonts.regular, color: colors.muted });
  });
  return doc.save();
}
