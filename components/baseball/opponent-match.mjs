export function normalizeOpponent(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function opponentsMatch(left, right) {
  const a = normalizeOpponent(left);
  const b = normalizeOpponent(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length >= 8 && longer.includes(shorter);
}
