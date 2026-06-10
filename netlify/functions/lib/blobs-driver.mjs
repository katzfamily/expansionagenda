import { getStore } from "@netlify/blobs";
import { seedState } from "./seed.mjs";

const STATE_KEY = "state-v1";

function store() {
  return getStore({ name: "jam-board", consistency: "strong" });
}

async function read() {
  const state = await store().get(STATE_KEY, { type: "json" });
  if (state) return state;
  const seeded = seedState();
  await store().setJSON(STATE_KEY, seeded);
  return seeded;
}

async function write(state) {
  await store().setJSON(STATE_KEY, state);
}

export function blobsDriver() {
  return {
    name: "blobs",
    label: "Netlify Blobs",

    async getAll() {
      return read();
    },

    async createTopic(topic) {
      const state = await read();
      state.topics.push(topic);
      await write(state);
      return topic;
    },

    async updateTopic(id, patch) {
      const state = await read();
      const topic = state.topics.find((t) => t.id === id);
      if (!topic) return null;
      Object.assign(topic, patch);
      await write(state);
      return topic;
    },

    async deleteTopic(id) {
      const state = await read();
      state.topics = state.topics.filter((t) => t.id !== id);
      await write(state);
    },

    async createMeeting(meeting) {
      const state = await read();
      state.meetings.push(meeting);
      await write(state);
      return meeting;
    },

    async updateMeeting(id, patch) {
      const state = await read();
      const meeting = state.meetings.find((m) => m.id === id);
      if (!meeting) return null;
      Object.assign(meeting, patch);
      await write(state);
      return meeting;
    },
  };
}
