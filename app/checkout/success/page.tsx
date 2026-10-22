import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Checkout — Debrief" };

export default function CheckoutSuccessPage() {
  return (
    <LegalPage title="Checkout">
      <p>
        If the payment went through, Dodo confirms it on our server and the
        briefing credits are added then. This page does not add credits by
        itself.
      </p>
      <p>
        <Link href="/brief">Back to a briefing</Link>
      </p>
    </LegalPage>
  );
}
