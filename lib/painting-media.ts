const POSITION_TOKEN = /^position:(\d+)$/;

export const mediaPositionToken = (position: number) =>
  `position:${Math.max(0, Math.trunc(position))}`;

export const parseMediaPositionToken = (value: string) => {
  const match = POSITION_TOKEN.exec(value);
  if (!match) return null;
  const position = Number(match[1]);
  return Number.isSafeInteger(position) ? position : null;
};
