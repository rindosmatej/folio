import React from "react";
import { AnswerPie } from "./answer-pie";
type Row = { label: string; count: number; correct: boolean };
type Frequencies = {
  answered: number;
  players: number;
  multiple: boolean;
  rows: Row[];
};
export function FrequencyChart({ data }: { data: Frequencies }) {
  const { answered, players, multiple, rows } = data;
  return (
    <figure className="frequency-chart">
      <figcaption>
        <strong>Četnost odpovědí</strong>
        <span>
          Odpovědělo {answered} z {players} hráčů
        </span>
      </figcaption>
      <AnswerPie rows={rows} multiple={multiple} />
      {answered === 0 && <p>Žádná odpověď nebyla odeslána.</p>}
      {players > answered && (
        <p className="frequency-missing">
          Bez odpovědi: <strong>{players - answered}</strong>
        </p>
      )}
    </figure>
  );
}
