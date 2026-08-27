import { formatMoney, formatDuration } from "@/lib/format";

describe("formatMoney", () => {
  it("shows whole pounds with no decimals", () => {
    expect(formatMoney(9500)).toBe("£95");
    expect(formatMoney(0)).toBe("£0");
  });

  it("shows 2 decimal places when there are pence", () => {
    expect(formatMoney(8360)).toBe("£83.60");
    expect(formatMoney(1140)).toBe("£11.40");
    expect(formatMoney(9550)).toBe("£95.50");
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(210)).toBe("3h 30m");
    expect(formatDuration(240)).toBe("4h");
  });
});
