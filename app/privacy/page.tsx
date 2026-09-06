import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy — Debrief" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        Debrief stores a lightweight session in your browser: the email you
        enter, remaining briefing credits, and past verdicts (localStorage).
        This is not a server account, and we do not verify the email.
      </p>
      <p>
        When you run a briefing, we send the idea text to model and search
        providers (OpenAI, and if configured SerpApi, Exa, Tavily, Firecrawl)
        to produce the report. We do not sell your ideas.
      </p>
      <p>
        Server logs may include IP addresses used for rate limits. Do not
        submit secrets, personal data about other people, or confidential
        third-party material.
      </p>
    </LegalPage>
  );
}
