import React from "react";
import { avatars } from "../lib/avatars.mjs";
const silhouettes = [
  "M9 55V31a23 23 0 0 1 46 0v24Z",
  "M8 20 48 12l9 33-42 10Z",
  "M5 52 32 8q2-3 4 1l23 43q1 3-3 3H9q-5 0-4-3Z",
  "M5 27q9-28 24-8t29 0v25q-12 25-28 8T5 53Z",
  "M32 4 39 18l16-5-5 15 12 8-15 7 1 15-16-7-12 9-3-16-15-4 10-13-4-14 17 4Z",
  "M32 5 55 18v27L32 59 9 45V18Z",
];
export function Avatar({ id }: { id?: string }) {
  const i = Math.max(
      0,
      avatars.findIndex((a) => a.id === id),
    ),
    item = avatars[i];
  return (
    <svg aria-hidden="true" className="quiz-avatar" viewBox="0 0 64 64">
      <g stroke="#18263c" strokeWidth="2.8" strokeLinejoin="round">
        <path d={silhouettes[i]} fill={item.color} />
        {i === 5 && (
          <path
            d="m10 18 22 13 22-13M32 31v25"
            strokeOpacity=".28"
            fill="none"
          />
        )}
      </g>
      <g fill="#172537">
        <ellipse cx="24" cy={i === 2 ? 38 : 32} rx="2.8" ry="4" />
        <ellipse cx="39" cy={i === 2 ? 38 : 32} rx="2.8" ry="4" />
      </g>
      <path
        d={i === 2 ? "M28 45q4 3 8-1" : "M27 40q5 4 10-1"}
        stroke="#172537"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
const fmt = new Intl.NumberFormat("cs-CZ");
export function Score({ value }: { value: number }) {
  return (
    <span className="quiz-score">
      {fmt.format(value)} <small>b.</small>
    </span>
  );
}
export function Ranks({
  rows,
  own,
  start = 1,
}: {
  rows: any[];
  own?: string;
  start?: number;
}) {
  return (
    <ol start={start} className="quiz-ranks">
      {rows.map((r, i) => (
        <li key={r.name} className={r.name === own ? "mine" : ""}>
          <b className="rank-place">{i + start}.</b>
          <Avatar id={r.avatar} />
          <strong>
            {r.name}
            {r.name === own && <small> (ty)</small>}
          </strong>
          <Score value={r.points} />
        </li>
      ))}
    </ol>
  );
}
export function Podium({ rows, revealed }: { rows: any[]; revealed: number }) {
  const top = rows.slice(0, 3);
  return (
    <ol className="quiz-podium" aria-label="Stupně vítězů">
      {top.map((r, i) => (
        <li
          key={r.name}
          className={"place-" + (i + 1)}
          style={{
            visibility: revealed >= top.length - i ? "visible" : "hidden",
          }}
        >
          <Avatar id={r.avatar} />
          <strong>{r.name}</strong>
          <Score value={r.points} />
          <b>
            {i + 1}.<small> místo</small>
          </b>
        </li>
      ))}
    </ol>
  );
}
