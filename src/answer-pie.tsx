import React from "react";

type Slice = { label: string; count: number; correct?: boolean };
const colors = ["#408ab5", "#f2ac45", "#50b49a", "#ac87d4", "#e47a79", "#819951"];
const percent = new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 });

export function AnswerPie({ rows, multiple }: { rows: Slice[]; multiple: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const color = (i: number) => colors[i] ?? `hsl(${(i * 137.508) % 360} 57% 57%)`;
  let count = 0;
  const stops = rows.flatMap((row, i) => {
    if (!row.count) return [];
    const start = count;
    count += row.count;
    return [`${color(i)} ${100 * start / total}% ${100 * count / total}%`];
  });
  return <>
    {total > 0 && <p className="pie-caption">{multiple ? "Podíl ze všech označených možností" : "Podíl z odevzdaných odpovědí"}</p>}
    <div className="answer-pie">
      {total > 0 && <div className="pie-disc" aria-hidden="true" style={{background: `conic-gradient(${stops.join(", ")})`}} />}
      <ul>{rows.map((row, i) => <li key={i}>
        <i aria-hidden="true" style={{background: color(i)}} />
        <span>{row.label} {row.correct && <small className="frequency-correct">✓ správně</small>}</span>
        <strong>{row.count}× {total > 0 && <small>({percent.format(row.count / total)})</small>}</strong>
      </li>)}</ul>
    </div>
  </>;
}
