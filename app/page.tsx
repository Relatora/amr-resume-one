import content from "@/data/content.json";
import type { ResumeContent } from "@/lib/types";
import App from "@/components/App";

export default function Page() {
  return <App initial={content as ResumeContent} />;
}
