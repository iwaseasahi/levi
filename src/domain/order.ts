export function moveTo<T>(items: T[], item: T, target: T) {
  const from = items.indexOf(item);
  const destination = items.indexOf(target);
  if (from < 0 || destination < 0 || from === destination) return null;
  const next = [...items];
  next.splice(from, 1);
  next.splice(destination, 0, item);
  return next;
}

export function moveBy<T>(items: T[], item: T, offset: -1 | 1) {
  const from = items.indexOf(item);
  const destination = from + offset;
  if (from < 0 || destination < 0 || destination >= items.length) return null;
  const next = [...items];
  [next[from], next[destination]] = [next[destination]!, next[from]!];
  return next;
}
