import { randomUUID } from "node:crypto";
import { getDriver } from "./lib/store.mjs";

export const config = { path: "/api/*" };

const PRIORITIES = new Set(["must", "iftime", "parking"]);
const TIMES = new Set(["5 min", "10 min", "15 min", "20+ min"]);
const STATUSES = new Set(["upcoming", "done", "skipped"]);
const PEOPLE = new Set(["Cara", "Taylor", "Tori", "Other"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function fullState(driver) {
  const { meetings, topics } = await driver.getAll();
  meetings.sort((a, b) => a.date.localeCompare(b.date));
  topics.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return { backend: driver.name, backendLabel: driver.label, meetings, topics };
}

function cleanTopicInput(body, { partial = false } = {}) {
  const out = {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  if (!partial || "topic" in body) out.topic = str(body.topic).slice(0, 200);
  if (!partial || "details" in body) out.details = str(body.details).slice(0, 4000);
  if (!partial || "submittedBy" in body)
    out.submittedBy = PEOPLE.has(body.submittedBy) ? body.submittedBy : "Other";
  if (!partial || "meetingId" in body) out.meetingId = body.meetingId || null;
  if (!partial || "priority" in body)
    out.priority = PRIORITIES.has(body.priority) ? body.priority : "iftime";
  if (!partial || "timeNeeded" in body)
    out.timeNeeded = TIMES.has(body.timeNeeded) ? body.timeNeeded : "10 min";
  if (!partial || "covered" in body) out.covered = !!body.covered;
  if (!partial || "needsData" in body) out.needsData = !!body.needsData;
  if (!partial || "dataAsk" in body) out.dataAsk = str(body.dataAsk).slice(0, 2000);
  if (!partial || "outcome" in body) out.outcome = str(body.outcome).slice(0, 4000);
  return out;
}

function cleanMeetingInput(body, { partial = false } = {}) {
  const out = {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  if (!partial || "date" in body) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str(body.date))) {
      if (!partial) throw new Error("A valid date (YYYY-MM-DD) is required");
    } else {
      out.date = str(body.date);
    }
  }
  if (!partial || "status" in body)
    out.status = STATUSES.has(body.status) ? body.status : "upcoming";
  if (!partial || "zoomLink" in body) out.zoomLink = str(body.zoomLink).slice(0, 500);
  if (!partial || "firefliesLink" in body)
    out.firefliesLink = str(body.firefliesLink).slice(0, 500);
  if (!partial || "notes" in body) out.notes = str(body.notes).slice(0, 4000);
  return out;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async (req) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean); // ["api", resource, id?]
  const resource = segments[1] || "";
  const id = segments[2] || "";
  const driver = getDriver();

  let body = {};
  if (req.method === "POST" || req.method === "PATCH") {
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  }

  try {
    if (req.method === "GET" && resource === "state") {
      return json(await fullState(driver));
    }

    if (req.method === "POST" && resource === "topics") {
      const input = cleanTopicInput(body);
      if (!input.topic) return json({ error: "Topic is required" }, 400);
      await driver.createTopic({
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      });
      return json(await fullState(driver), 201);
    }

    if (req.method === "PATCH" && resource === "topics" && id) {
      const updated = await driver.updateTopic(id, cleanTopicInput(body, { partial: true }));
      if (!updated) return json({ error: "Topic not found" }, 404);
      return json(await fullState(driver));
    }

    if (req.method === "DELETE" && resource === "topics" && id) {
      await driver.deleteTopic(id);
      return json(await fullState(driver));
    }

    if (req.method === "POST" && resource === "meetings") {
      const input = cleanMeetingInput(body);
      await driver.createMeeting({ id: randomUUID(), notes: "", ...input });
      return json(await fullState(driver), 201);
    }

    if (req.method === "PATCH" && resource === "meetings" && id) {
      const updated = await driver.updateMeeting(id, cleanMeetingInput(body, { partial: true }));
      if (!updated) return json({ error: "Meeting not found" }, 404);
      return json(await fullState(driver));
    }

    // Wrap-up helper: mark a meeting done and roll its uncovered topics
    // forward to the next upcoming meeting (created a week out if needed).
    if (req.method === "POST" && resource === "rollover") {
      const { meetings, topics } = await driver.getAll();
      const from = meetings.find((m) => m.id === body.fromMeetingId);
      if (!from) return json({ error: "Meeting not found" }, 404);

      let target = meetings
        .filter((m) => m.status === "upcoming" && m.id !== from.id && m.date >= from.date)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!target) {
        target = await driver.createMeeting({
          id: randomUUID(),
          date: addDays(from.date, 7),
          status: "upcoming",
          zoomLink: from.zoomLink || "",
          firefliesLink: "",
          notes: "",
        });
      }

      const leftovers = topics.filter(
        (t) => t.meetingId === from.id && !t.covered && t.priority !== "parking"
      );
      for (const t of leftovers) {
        await driver.updateTopic(t.id, { meetingId: target.id });
      }
      await driver.updateMeeting(from.id, { status: "done" });
      return json({ rolled: leftovers.length, targetMeetingId: target.id, ...(await fullState(driver)) });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || "Server error" }, 500);
  }
};
