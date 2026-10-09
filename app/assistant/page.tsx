import type { Metadata } from "next";
import { AuthenticatedAgentChat } from "../_components/authenticated-agent-chat";

export const metadata: Metadata = { title: "Assistant", robots: { index: false, follow: false } };

export default function Page() {
  return <AuthenticatedAgentChat />;
}
