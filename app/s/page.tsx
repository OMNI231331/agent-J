import type { Metadata } from "next";
import { AuthenticatedAgentChat } from "@/app/_components/authenticated-agent-chat";

export const metadata: Metadata = { title: "Assistant", robots: { index: false, follow: false } };

export default function NewSessionPage() {
  return <AuthenticatedAgentChat sessionless />;
}
