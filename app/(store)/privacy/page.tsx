import type { Metadata } from "next";
import { PolicyPage } from "@/components/store/policy-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <PolicyPage title="Privacy Policy" sections={[{"h": "Status", "p": "A full privacy policy must be written (or generated and reviewed by a qualified professional) before launch. This is a placeholder."}, {"h": "What the site collects today", "p": "Early-access sign-up: your email address, stored with our email provider once it is configured. Bag contents are stored in your own browser (local storage) and are not sent to us until checkout. Payments are handled by the payment provider; LSW never sees or stores card numbers."}, {"h": "Your choices", "p": "You can unsubscribe from emails at any time. Contact details for privacy requests will be published here before launch."}]} />
  );
}
