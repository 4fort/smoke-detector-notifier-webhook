export function setTextStyle(
  text: string | number,
  color:
    | "red"
    | "green"
    | "yellow"
    | "blue"
    | "magenta"
    | "cyan"
    | "reset"
    | "bold"
): string {
  if (typeof text !== "string") text = String(text);
  const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
  };
  return colors[color] + text + colors.reset;
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}.${pad(date.getMilliseconds())}`;
}

export function statusCodeDecorator(
  statusCode: number
): Record<"status" | "emoji", string> {
  let status;
  let emoji;
  if (statusCode >= 500) {
    // status = setTextStyle(statusCode, "yellow");
    emoji = "⚠️";
  } else if (statusCode >= 400) {
    // status = setTextStyle(statusCode, "red");
    emoji = "❌";
  } else if (statusCode >= 200) {
    // status = setTextStyle(statusCode, "green");
    emoji = "✅";
  } else {
    // status = setTextStyle(statusCode, "reset");
    emoji = "✅";
  }

  return { status: statusCode.toString(), emoji };
}
