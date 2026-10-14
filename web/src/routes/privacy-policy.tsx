import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "./privacy";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPage,
});

