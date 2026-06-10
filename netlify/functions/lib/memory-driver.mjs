import { seedState } from "./seed.mjs";

// In-process store used by the local smoke test (JAM_DRIVER=memory).
let state = null;

function read() {
  if (!state) state = seedState();
  return state;
}

export function memoryDriver() {
  return {
    name: "memory",
    label: "In-memory (test)",

    async getAll() {
      return read();
    },
    async createTopic(topic) {
      read().topics.push(topic);
      return topic;
    },
    async updateTopic(id, patch) {
      const topic = read().topics.find((t) => t.id === id);
      if (!topic) return null;
      Object.assign(topic, patch);
      return topic;
    },
    async deleteTopic(id) {
      const s = read();
      s.topics = s.topics.filter((t) => t.id !== id);
    },
    async createMeeting(meeting) {
      read().meetings.push(meeting);
      return meeting;
    },
    async updateMeeting(id, patch) {
      const meeting = read().meetings.find((m) => m.id === id);
      if (!meeting) return null;
      Object.assign(meeting, patch);
      return meeting;
    },
  };
}
