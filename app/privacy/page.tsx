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
        When you run a briefing, we send the idea text to model providers
        (OpenAI, or Google Gemini when you bring your own key) and search
        providers (if configured SerpApi, Exa, Tavily, Firecrawl) to produce the
        report. We do not sell your ideas.
      </p>
      <p>
        You can save your own model API key (OpenAI or Google Gemini) in this
        browser. We send that key with the briefing request so the agents run on
        your account, and we do not store it on our servers. Remove it from the
        briefing form to stop sending it. Live search still uses
        Debrief&apos;s own search providers.
      </p>
      <p>
        Server logs may include IP addresses used for rate limits. Do not
        submit secrets, personal data about other people, or confidential
        third-party material.
      </p>
    </LegalPage>
  );
}
