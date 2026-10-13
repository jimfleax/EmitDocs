import type { TextTransformMode } from "@/components/templates/mapping/types";

export function applyTextTransform(
  text: string,
  transform?: TextTransformMode,
): string {
  if (!text || !transform || transform === "none") return text;
  switch (transform) {
    case "uppercase":
      return text.toLocaleUpperCase();
    case "lowercase":
      return text.toLocaleLowerCase();
    case "capitalize":
      return text.replace(/\b[\p{L}\p{N}]/gu, (c) => c.toLocaleUpperCase());
    default:
      return text;
  }
}

export function formatDate(
  val: string | number | Date,
  pattern: string,
): string {
  let d: Date;
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    d = new Date(val + "T00:00:00");
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return String(val);

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  const monthNamesShort = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthNamesLong = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  switch (pattern) {
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MMMM D, YYYY":
      return `${monthNamesLong[d.getMonth()]} ${d.getDate()}, ${year}`;
    case "MMM D, YYYY":
      return `${monthNamesShort[d.getMonth()]} ${d.getDate()}, ${year}`;
    case "YYYY-MM-DD HH:mm:ss":
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    default:
      return d.toLocaleDateString();
  }
}

export function formatNumber(val: string | number, pattern: string): string {
  const num =
    typeof val === "number"
      ? val
      : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return String(val);

  if (pattern.startsWith("currency:")) {
    const currency = pattern.split(":")[1]?.toUpperCase() || "USD";
    const isZeroDecimal = currency === "JPY";
    const locale = currency === "GBP" ? "en-GB" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(num);
  }

  if (pattern.startsWith("decimal:")) {
    const decimals = parseInt(pattern.split(":")[1], 10) || 0;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  if (pattern.startsWith("percent:")) {
    const decimals = parseInt(pattern.split(":")[1], 10) || 0;
    const factor = num > 1 || num < -1 ? num / 100 : num;
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(factor);
  }

  return new Intl.NumberFormat("en-US").format(num);
}

export function formatFieldValue(
  value: string | number | undefined | null,
  type?: "text" | "date" | "number",
  formatPattern?: string,
  textTransform?: TextTransformMode,
): string {
  if (value === undefined || value === null) return "";
  const strValue = String(value);

  // If placeholder token like {{fullName}}, only apply textTransform
  if (/^\{\{.*\}\}$/.test(strValue.trim())) {
    return applyTextTransform(strValue, textTransform);
  }

  let formatted = strValue;
  if (type === "date" && formatPattern) {
    formatted = formatDate(strValue, formatPattern);
  } else if (type === "number" && formatPattern) {
    formatted = formatNumber(strValue, formatPattern);
  }

  return applyTextTransform(formatted, textTransform);
}
