import { InfoPage } from "@/components/talkt/info-page";

export const metadata = {
  title: "Privacy — TalkT",
};

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Legal" title="Privacy">
      <p style={{ margin: 0 }}>
        Your attempts and feedback stay private to you. The full privacy policy
        is being finalized and will appear here.
      </p>
    </InfoPage>
  );
}
