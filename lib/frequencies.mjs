// Each group represents one submitted answer, possibly containing several choices.
export function frequencies(question, groups, players) {
  const answered = groups.reduce((sum, group) => sum + group.n, 0);
  let rows;
  if (question.type === "number") {
    const format = new Intl.NumberFormat("cs-CZ", {
      maximumSignificantDigits: 17,
    });
    rows = [...groups]
      .sort((a, b) => a.value - b.value)
      .map(({ value, n }) => ({
        label: [format.format(value), question.unit].filter(Boolean).join(" "),
        count: n,
        correct: Math.abs(value - question.value) <= question.tolerance,
      }));
  } else {
    const counts = new Map();
    for (const { value, n } of groups) {
      for (const id of value) counts.set(id, (counts.get(id) || 0) + n);
    }
    rows = question.options.map((option, i) => ({
      label: option.text || "Obrázek " + (i + 1),
      count: counts.get(option.id) || 0,
      correct: question.correct.includes(option.id),
    }));
  }
  return { answered, players, multiple: question.type === "many", rows };
}
