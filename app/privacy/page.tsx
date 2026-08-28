import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy — Debrief" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Debrief runs a briefing from the idea text you submit. We send that text
        to model and search providers (OpenAI, and if configured Exa, Tavily,
        Firecrawl) to produce the report. We do not sell your ideas.
      </p>
      <p>
        Briefing history is stored in your browser (localStorage), not in our
        database, unless you later enable accounts. Server logs may include IP
        addresses used for rate limits.
      </p>
      <p>
        Do not submit secrets, personal data about other people, or confidential
        third-party material.
      </p>
    </LegalPage>
  );
}
