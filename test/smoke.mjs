// End-to-end exercise of the API function using the in-memory driver.
process.env.JAM_DRIVER = "memory";

const { default: handler } = await import("../netlify/functions/api.mjs");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) failures++;
}

async function call(method, path, body) {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await handler(req);
  return { status: res.status, data: await res.json() };
}

// initial state is seeded
let { status, data } = await call("GET", "/api/state");
check("GET /api/state returns 200", status === 200);
check("state is seeded with 1 meeting", data.meetings.length === 1);
check("state is seeded with 3 topics", data.topics.length === 3);
const meetingId = data.meetings[0].id;

// create a topic
({ status, data } = await call("POST", "/api/topics", {
  topic: "Test partnerships idea",
  details: "context here",
  submittedBy: "Taylor",
  meetingId,
  priority: "must",
  timeNeeded: "15 min",
  needsData: true,
  dataAsk: "pull the numbers",
}));
check("POST /api/topics returns 201", status === 201);
check("topic count is now 4", data.topics.length === 4);
const created = data.topics.find((t) => t.topic === "Test partnerships idea");
check("created topic round-trips fields", created?.needsData === true && created?.priority === "must");

// validation
({ status } = await call("POST", "/api/topics", { topic: "   " }));
check("POST empty topic rejected with 400", status === 400);

// cross off
({ status, data } = await call("PATCH", `/api/topics/${created.id}`, { covered: true }));
check("PATCH covered=true works", status === 200 && data.topics.find((t) => t.id === created.id).covered);

// park another topic
const parkMe = data.topics.find((t) => t.id !== created.id && t.priority === "iftime");
({ data } = await call("PATCH", `/api/topics/${parkMe.id}`, { priority: "parking" }));
check("topic can move to parking lot", data.topics.find((t) => t.id === parkMe.id).priority === "parking");

// wrap up: uncovered non-parking topics roll to a new meeting a week out
({ status, data } = await call("POST", "/api/rollover", { fromMeetingId: meetingId }));
check("rollover returns 200", status === 200);
check("a next meeting was created", data.meetings.length === 2);
const next = data.meetings.find((m) => m.id !== meetingId);
check("next meeting is a week later", next.date === "2026-06-24");
check("old meeting marked done", data.meetings.find((m) => m.id === meetingId).status === "done");
check(`uncovered topics rolled (${data.rolled})`, data.rolled === 2);
check("covered topic stayed on old meeting", data.topics.find((t) => t.id === created.id).meetingId === meetingId);
check("parked topic did not roll", data.topics.find((t) => t.id === parkMe.id).meetingId === meetingId);

// delete
({ data } = await call("DELETE", `/api/topics/${created.id}`));
check("DELETE removes topic", !data.topics.some((t) => t.id === created.id));

// 404s
({ status } = await call("PATCH", "/api/topics/nope", { covered: true }));
check("PATCH unknown topic → 404", status === 404);
({ status } = await call("GET", "/api/bogus"));
check("unknown route → 404", status === 404);

console.log(failures ? `\n${failures} failure(s)` : "\nAll smoke tests passed 🎉");
process.exit(failures ? 1 : 0);
