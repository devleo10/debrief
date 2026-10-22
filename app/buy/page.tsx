import LegalPage from "@/components/LegalPage";
import CheckoutButton from "@/components/CheckoutButton";
import { BRIEFING_PACKS, formatUsd, unitLabel } from "@/lib/pricing";

export const metadata = { title: "Buy briefings — Debrief" };

export default function BuyPage() {
  return (
    <LegalPage title="Buy briefings">
      <p>
        One credit is one full run: live research, seven critics, and a verdict.
        The first two runs are free. A run on your own model key does not spend
        a credit.
      </p>
      <p>Each figure is the price of one briefing.</p>
      <ul className="buy-list">
        {BRIEFING_PACKS.map((pack) => (
          <li
            key={pack.id}
            className={pack.id === "fifteen" ? "buy-row buy-row-main" : "buy-row"}
          >
            <p className="buy-unit">{unitLabel(pack)}</p>
            <div>
              <p className="buy-name">{pack.name}</p>
              <p className="buy-total">{formatUsd(pack.priceCents)}</p>
            </div>
            <CheckoutButton pack={pack.id} label={`Pay ${formatUsd(pack.priceCents)}`} />
          </li>
        ))}
      </ul>
      <p>
        Dodo collects the payment. Credits are added when that payment is
        confirmed, not when you land back on this site.
      </p>
    </LegalPage>
  );
}
