export const icons = {
  book: "Kniha",
  monitor: "Počítač",
  camera: "Fotoaparát",
  ruler: "Trojúhelník",
  data: "Data",
  code: "Kód",
  chip: "Čip",
  network: "Síť",
  wood: "Dřevo",
  tools: "Nářadí",
  building: "Stavba",
  palette: "Paleta",
};
export const defaultIcon = (sid) =>
  ({ informatika: "monitor", grafika: "camera", kresleni: "ruler" })[sid] ||
  "book";
