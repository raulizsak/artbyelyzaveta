export const MELBOURNE_TIME_ZONE = "Australia/Melbourne";

type DateInput = Date | string | number;

function toDate(input: DateInput) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date input");
  return date;
}

export function formatMelbourneDateTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
) {
  return new Intl.DateTimeFormat("en-AU", {
    ...options,
    timeZone: MELBOURNE_TIME_ZONE,
  }).format(toDate(input));
}

export function formatMelbourneDate(
  input: DateInput,
  dateStyle: "full" | "long" | "medium" | "short" = "medium",
) {
  return formatMelbourneDateTime(input, { dateStyle });
}

export function toMelbourneDateTimeLocal(input: DateInput) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(input));
  const value = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export function melbourneDateTimeLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid Melbourne date and time");
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = toMelbourneDateTimeLocal(guess);
    const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)!;
    const represented = Date.UTC(
      Number(localMatch[1]),
      Number(localMatch[2]) - 1,
      Number(localMatch[3]),
      Number(localMatch[4]),
      Number(localMatch[5]),
    );
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}
