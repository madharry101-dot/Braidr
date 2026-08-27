import { randomBytes } from "crypto";
import { encryptUtr, decryptUtr, maskUtr } from "@/lib/crypto/utr";

describe("UTR encryption (braidr_pro_progress.step2_utr)", () => {
  beforeAll(() => {
    process.env.UTR_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips a UTR through encrypt/decrypt", () => {
    const utr = "1234567890";
    const ciphertext = encryptUtr(utr);
    expect(ciphertext).not.toContain(utr);
    expect(decryptUtr(ciphertext)).toBe(utr);
  });

  it("masks a UTR for display", () => {
    expect(maskUtr("1234567890")).toBe("****7890");
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encryptUtr("1234567890");
    const [iv, tag, data] = ciphertext.split(":");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(":");
    expect(() => decryptUtr(tampered)).toThrow();
  });
});
