import { InfoPage } from "@/components/talkt/info-page";

export const metadata = {
  title: "Terms & Conditions — TalkT",
};

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Legal" title="Terms & Conditions">
      <p style={{ margin: 0 }}>
        These terms govern your use of TalkT. Full terms are being finalized and
        will appear here.
      </p>
    </InfoPage>
  );
}
