// Syncs the board with the "Expansion Jam 📞 Agenda" Airtable base, so the
// team keeps a browsable archive in their existing stack. Activated by setting
// AIRTABLE_TOKEN (and optionally AIRTABLE_BASE_ID) on the Netlify site.
//
// Mapping uses field IDs (not names) so renaming columns in Airtable is safe.

const TABLES = {
  meetings: "tblsV0G5AuMwi0zP3",
  topics: "tbl9tN3Uc11sBgTc1",
};

const MEETING_FIELDS = {
  date: "fldgxiIesFssuPHEr",
  status: "fldEnjXhKKL9OQaR6",
  zoomLink: "fld0sFgLvlHvMgeeU",
  firefliesLink: "fldrW4B6z5J47piii",
  notes: "fld6DlI9sbJcRvSw0",
};

const TOPIC_FIELDS = {
  topic: "fldkmXEdxCH1WLbzu",
  details: "fldlQanRSnPcfSRuj",
  submittedBy: "fldfeA5iRZ4NEU9Ai",
  meeting: "fldR0YZcf5otQgLKv",
  priority: "fldKxdf46lTbM3UJ7",
  timeNeeded: "fldRI5krzvkPYl8uK",
  covered: "fld16zGDrRyEKO7xY",
  needsData: "fldc6dVLxB4Ji490c",
  dataAsk: "fldxc4VaxVrfZsj70",
  outcome: "fldhM6apnv8oI36A6",
};

const STATUS_TO_AIRTABLE = {
  upcoming: "🗓 Upcoming",
  done: "✅ Done",
  skipped: "❌ Skipped",
};
const PRIORITY_TO_AIRTABLE = {
  must: "🔥 Must cover",
  iftime: "💬 If time allows",
  parking: "🅿️ Parking lot",
};
const STATUS_FROM_AIRTABLE = invert(STATUS_TO_AIRTABLE);
const PRIORITY_FROM_AIRTABLE = invert(PRIORITY_TO_AIRTABLE);

function invert(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
}

function mapMeeting(record) {
  const f = record.fields;
  return {
    id: record.id,
    date: f[MEETING_FIELDS.date] || "",
    status: STATUS_FROM_AIRTABLE[f[MEETING_FIELDS.status]] || "upcoming",
    zoomLink: f[MEETING_FIELDS.zoomLink] || "",
    firefliesLink: f[MEETING_FIELDS.firefliesLink] || "",
    notes: f[MEETING_FIELDS.notes] || "",
  };
}

function mapTopic(record) {
  const f = record.fields;
  return {
    id: record.id,
    topic: f[TOPIC_FIELDS.topic] || "",
    details: f[TOPIC_FIELDS.details] || "",
    submittedBy: f[TOPIC_FIELDS.submittedBy] || "Other",
    meetingId: (f[TOPIC_FIELDS.meeting] || [])[0] || null,
    priority: PRIORITY_FROM_AIRTABLE[f[TOPIC_FIELDS.priority]] || "iftime",
    timeNeeded: f[TOPIC_FIELDS.timeNeeded] || "10 min",
    covered: !!f[TOPIC_FIELDS.covered],
    needsData: !!f[TOPIC_FIELDS.needsData],
    dataAsk: f[TOPIC_FIELDS.dataAsk] || "",
    outcome: f[TOPIC_FIELDS.outcome] || "",
    createdAt: record.createdTime,
  };
}

function meetingFields(patch) {
  const f = {};
  if ("date" in patch) f[MEETING_FIELDS.date] = patch.date;
  if ("status" in patch) f[MEETING_FIELDS.status] = STATUS_TO_AIRTABLE[patch.status];
  if ("zoomLink" in patch) f[MEETING_FIELDS.zoomLink] = patch.zoomLink || null;
  if ("firefliesLink" in patch) f[MEETING_FIELDS.firefliesLink] = patch.firefliesLink || null;
  if ("notes" in patch) f[MEETING_FIELDS.notes] = patch.notes || "";
  return f;
}

function topicFields(patch) {
  const f = {};
  if ("topic" in patch) f[TOPIC_FIELDS.topic] = patch.topic;
  if ("details" in patch) f[TOPIC_FIELDS.details] = patch.details || "";
  if ("submittedBy" in patch) f[TOPIC_FIELDS.submittedBy] = patch.submittedBy;
  if ("meetingId" in patch) f[TOPIC_FIELDS.meeting] = patch.meetingId ? [patch.meetingId] : [];
  if ("priority" in patch) f[TOPIC_FIELDS.priority] = PRIORITY_TO_AIRTABLE[patch.priority];
  if ("timeNeeded" in patch) f[TOPIC_FIELDS.timeNeeded] = patch.timeNeeded;
  if ("covered" in patch) f[TOPIC_FIELDS.covered] = !!patch.covered;
  if ("needsData" in patch) f[TOPIC_FIELDS.needsData] = !!patch.needsData;
  if ("dataAsk" in patch) f[TOPIC_FIELDS.dataAsk] = patch.dataAsk || "";
  if ("outcome" in patch) f[TOPIC_FIELDS.outcome] = patch.outcome || "";
  return f;
}

export function airtableDriver({ token, baseId }) {
  const root = `https://api.airtable.com/v0/${baseId}`;

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(`${root}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async function listAll(tableId) {
    const records = [];
    let offset;
    do {
      const params = new URLSearchParams({ returnFieldsByFieldId: "true" });
      if (offset) params.set("offset", offset);
      const page = await api(`/${tableId}?${params}`);
      records.push(...page.records);
      offset = page.offset;
    } while (offset);
    return records;
  }

  const byFieldId = "?returnFieldsByFieldId=true";

  return {
    name: "airtable",
    label: "Airtable",

    async getAll() {
      const [meetings, topics] = await Promise.all([
        listAll(TABLES.meetings),
        listAll(TABLES.topics),
      ]);
      return { meetings: meetings.map(mapMeeting), topics: topics.map(mapTopic) };
    },

    async createTopic(topic) {
      const out = await api(`/${TABLES.topics}${byFieldId}`, {
        method: "POST",
        body: { records: [{ fields: topicFields(topic) }], typecast: true },
      });
      return mapTopic(out.records[0]);
    },

    async updateTopic(id, patch) {
      const out = await api(`/${TABLES.topics}/${id}${byFieldId}`, {
        method: "PATCH",
        body: { fields: topicFields(patch), typecast: true },
      });
      return mapTopic(out);
    },

    async deleteTopic(id) {
      await api(`/${TABLES.topics}/${id}`, { method: "DELETE" });
    },

    async createMeeting(meeting) {
      const out = await api(`/${TABLES.meetings}${byFieldId}`, {
        method: "POST",
        body: { records: [{ fields: meetingFields(meeting) }], typecast: true },
      });
      return mapMeeting(out.records[0]);
    },

    async updateMeeting(id, patch) {
      const out = await api(`/${TABLES.meetings}/${id}${byFieldId}`, {
        method: "PATCH",
        body: { fields: meetingFields(patch), typecast: true },
      });
      return mapMeeting(out);
    },
  };
}
