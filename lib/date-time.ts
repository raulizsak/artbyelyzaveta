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
