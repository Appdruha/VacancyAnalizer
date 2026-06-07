import { readBoolean } from "./readers.js";

export function readHhMode(): "live" | "auto" | "fixtures" {
  const rawMode = process.env.HH_MODE?.trim().toLowerCase();
  if (rawMode === "live" || rawMode === "auto" || rawMode === "fixtures") {
    return rawMode;
  }

  const legacyFixtures = process.env.HH_USE_FIXTURES;
  if (legacyFixtures) {
    return readBoolean("HH_USE_FIXTURES", false) ? "fixtures" : "auto";
  }

  return "auto";
}

export function readEmailProvider(): "simulated" | "disabled" | "mailgun" {
  const rawProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (rawProvider === "simulated" || rawProvider === "mailgun" || rawProvider === "disabled") {
    return rawProvider;
  }

  return "simulated";
}
