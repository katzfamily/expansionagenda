// First-run data so the board is never empty. Mirrors the Airtable base
// "Expansion Jam 📞 Agenda" (appd47FpAzqZCzTQM).
export function seedState() {
  const meetingId = "seed-meeting-2026-06-17";
  return {
    meetings: [
      {
        id: meetingId,
        date: "2026-06-17",
        status: "upcoming",
        zoomLink: "",
        firefliesLink: "",
        notes: "",
      },
    ],
    topics: [
      {
        id: "seed-topic-goals",
        topic: "Sync on overarching goals + POVs for expansion",
        details:
          "Taylor's priority: the 4 of us aligning on overarching goals and POVs on what to run towards. Makes it easier to commit to what we're saying hell yes to across the biz — magic we add to existing IRL events, new events, partnerships, LinkedIn, etc. Goal: leave with an intentional container to dream in (can be huge, doesn't need to be tiny).",
        submittedBy: "Taylor",
        meetingId,
        priority: "must",
        timeNeeded: "20+ min",
        covered: false,
        needsData: false,
        dataAsk: "",
        outcome: "",
        createdAt: "2026-06-10T21:00:00.000Z",
      },
      {
        id: "seed-topic-walkthrough",
        topic: "How we'll use this board (2-min walkthrough)",
        details:
          "Drop topics here anytime during the week, check them off live on the call. Anything unchecked rolls to next week or the parking lot. Flag data asks for Tori early!",
        submittedBy: "Cara",
        meetingId,
        priority: "must",
        timeNeeded: "5 min",
        covered: false,
        needsData: false,
        dataAsk: "",
        outcome: "",
        createdAt: "2026-06-10T21:01:00.000Z",
      },
      {
        id: "seed-topic-growth",
        topic: "Membership growth check-in: where are we vs. goals?",
        details:
          "Standing pulse-check on growth numbers so the goals conversation is grounded in data.",
        submittedBy: "Cara",
        meetingId,
        priority: "iftime",
        timeNeeded: "10 min",
        covered: false,
        needsData: true,
        dataAsk:
          "Tori: month-over-month new members + renewals since January, whatever's easiest to pull. Flagged a week ahead 🙏",
        outcome: "",
        createdAt: "2026-06-10T21:02:00.000Z",
      },
    ],
  };
}
