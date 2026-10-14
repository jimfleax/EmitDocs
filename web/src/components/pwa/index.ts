/**
 * @file index.ts
 * @description Public exports barrel for PWA presentation components.
 * @architecture Component export aggregator for offline indicators, update banners, and install cards.
 * @agent_note Exposes PwaInstallCard, UpdateBanner, and OfflineIndicator for use across layout shells.
 */

export { PwaInstallCard } from "./PwaInstallCard";
export { UpdateBanner } from "./UpdateBanner";
export { OfflineIndicator } from "./OfflineIndicator";
