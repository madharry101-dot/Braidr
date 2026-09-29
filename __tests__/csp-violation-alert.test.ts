// R-04 follow-up — does anyone actually get told when the CSP blocks
// something?
//
// The failure this guards against is the quietest possible one: the table
// fills up, the cron runs green every day, and nobody hears anything. A
// version of this module that simply never sends would pass any test that
// only checked "did the cron return without throwing", so these check the
// send itself.

const mockSendEmail = jest.fn();
jest.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => mockSendEmail(...a) }));

import { runCspViolationAlert } from "@/lib/cron/csp-violation-alert";

const HOUR = 3_600_000;

type FakeOptions = {
  /** null = no state row yet (first ever run). */
  lastAlertedAt: string | null;
  newReports: number;
  sample?: Array<Record<string, unknown>>;
};

/**
 * Minimal stand-in for the service-role client: enough of the query builder
 * for this module, and a record of what was written.
 */
function fakeAdmin(options: FakeOptions) {
  const writes: Array<{ table: string; op: string; payload: unknown }> = [];

  const admin = {
    from(table: string) {
      if (table === "cron_alert_state") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data:
                    options.lastAlertedAt === null
                      ? null
                      : { last_alerted_at: options.lastAlertedAt },
                  error: null,
                }),
            }),
          }),
          insert: (payload: unknown) => {
            writes.push({ table, op: "insert", payload });
            return Promise.resolve({ error: null });
          },
          update: (payload: unknown) => ({
            eq: () => {
              writes.push({ table, op: "update", payload });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === "csp_violation_reports") {
        return {
          select: (_cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              return { gt: () => Promise.resolve({ count: options.newReports, error: null }) };
            }
            return {
              gt: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: options.sample ?? [], error: null }),
                }),
              }),
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  return { admin: admin as never, writes };
}

describe("daily CSP violation alert", () => {
  let consoleError: jest.SpyInstance;
  let consoleInfo: jest.SpyInstance;

  beforeEach(() => {
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue(undefined);
    process.env.CSP_ALERT_EMAIL = "founder@example.com";
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
    consoleInfo.mockRestore();
  });

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * HOUR).toISOString();

  // THE TEST A NEVER-ALERTING VERSION FAILS.
  it("emails when violations have been reported since the last alert", async () => {
    const { admin } = fakeAdmin({
      lastAlertedAt: daysAgo(2),
      newReports: 7,
      sample: [
        {
          effective_directive: "script-src",
          blocked_uri: "https://cdn.evil.test/x.js",
          document_uri: "https://braidr.netlify.app/blog/a",
        },
      ],
    });

    const result = await runCspViolationAlert(admin);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ alerted: true, reason: "sent", new_reports: 7 });

    const sent = mockSendEmail.mock.calls[0][0];
    expect(sent.to).toBe("founder@example.com");
    expect(sent.subject).toContain("7 Content-Security-Policy violations");
    expect(sent.text).toContain("script-src");
    expect(sent.text).toContain("https://cdn.evil.test/x.js");
    // The reader needs to know these were BLOCKED, not merely observed.
    expect(sent.text).toContain("blocked");
  });

  it("moves the watermark after sending, so the same reports are not re-sent", async () => {
    const { admin, writes } = fakeAdmin({ lastAlertedAt: daysAgo(2), newReports: 3 });
    await runCspViolationAlert(admin);

    const update = writes.find((w) => w.table === "cron_alert_state" && w.op === "update");
    expect(update).toBeDefined();
    const payload = update!.payload as { last_alerted_at: string };
    expect(new Date(payload.last_alerted_at).getTime()).toBeGreaterThan(
      new Date(daysAgo(2)).getTime()
    );
  });

  it("says nothing when nothing has been reported", async () => {
    const { admin } = fakeAdmin({ lastAlertedAt: daysAgo(2), newReports: 0 });
    const result = await runCspViolationAlert(admin);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.reason).toBe("nothing_new");
  });

  // ONE NOISY DAY, ONE EMAIL.
  it("holds off when it already alerted within the throttle window", async () => {
    const { admin } = fakeAdmin({
      lastAlertedAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      newReports: 500,
    });

    const result = await runCspViolationAlert(admin);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ alerted: false, reason: "throttled", new_reports: 500 });
  });

  it("alerts once for a burst rather than once per cron invocation", async () => {
    // First run of the day: two days since the last alert, reports waiting.
    const first = fakeAdmin({ lastAlertedAt: daysAgo(2), newReports: 40 });
    await runCspViolationAlert(first.admin);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Cron poked again an hour later; more have arrived since.
    const second = fakeAdmin({
      lastAlertedAt: new Date(Date.now() - HOUR).toISOString(),
      newReports: 15,
    });
    await runCspViolationAlert(second.admin);
    expect(mockSendEmail).toHaveBeenCalledTimes(1); // still one
  });

  it("initialises on the very first run without blasting about history", async () => {
    const { admin, writes } = fakeAdmin({ lastAlertedAt: null, newReports: 999 });

    const result = await runCspViolationAlert(admin);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.reason).toBe("initialised");
    expect(writes.some((w) => w.table === "cron_alert_state" && w.op === "insert")).toBe(true);
  });

  // The whole point of this task is that nobody was watching. A missing
  // recipient must not recreate that silently.
  it("complains loudly rather than quietly doing nothing when no recipient is set", async () => {
    delete process.env.CSP_ALERT_EMAIL;
    const { admin } = fakeAdmin({ lastAlertedAt: daysAgo(2), newReports: 4 });

    const result = await runCspViolationAlert(admin);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.reason).toBe("no_recipient");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("NOBODY IS BEING TOLD"));
  });

  it("uses the singular for a single violation", async () => {
    const { admin } = fakeAdmin({ lastAlertedAt: daysAgo(2), newReports: 1 });
    await runCspViolationAlert(admin);
    expect(mockSendEmail.mock.calls[0][0].subject).toContain("1 Content-Security-Policy violation");
    expect(mockSendEmail.mock.calls[0][0].subject).not.toContain("violations");
  });
});
