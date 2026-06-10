import { airtableDriver } from "./airtable-driver.mjs";
import { blobsDriver } from "./blobs-driver.mjs";
import { memoryDriver } from "./memory-driver.mjs";

const DEFAULT_BASE_ID = "appd47FpAzqZCzTQM";

export function getDriver() {
  if (process.env.JAM_DRIVER === "memory") return memoryDriver();
  if (process.env.AIRTABLE_TOKEN) {
    return airtableDriver({
      token: process.env.AIRTABLE_TOKEN,
      baseId: process.env.AIRTABLE_BASE_ID || DEFAULT_BASE_ID,
    });
  }
  return blobsDriver();
}
