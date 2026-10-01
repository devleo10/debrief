import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy — Debrief" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        When Supabase auth is enabled, we store your account email and remaining
        briefing credits in our database. Sign-in uses a one-time email link; we
        do not store passwords.
      </p>
      <p>
        If auth is not configured, Debrief falls back to a lightweight session in
        your browser (email you enter, credits, and past verdicts in localStorage).
        That mode is for local development only.
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
