import { InfoPage } from "@/components/talkt/info-page";

export const metadata = {
  title: "About — TalkT",
};

export default function AboutPage() {
  return (
    <InfoPage eyebrow="About" title="About TalkT">
      <p style={{ margin: 0 }}>
        TalkT is real-time voice interview practice with an AI interviewer,
        scored the moment you hang up.
      </p>
    </InfoPage>
  );
}
