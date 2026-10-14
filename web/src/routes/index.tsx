/**
 * @file index.tsx
 * @description Official public marketing homepage and landing page for EmitDocs.
 * @architecture Composed of modular landing components: LandingHeader, HeroSection, FeaturesBentoGrid,
 * WorkflowTimeline, TrustAndSecurity, LandingBottomCta, and LandingFooter.
 */

import { createFileRoute } from "@tanstack/react-router";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesBentoGrid } from "@/components/landing/FeaturesBentoGrid";
import { WorkflowTimeline } from "@/components/landing/WorkflowTimeline";
import { TrustAndSecurity } from "@/components/landing/TrustAndSecurity";
import { LandingBottomCta } from "@/components/landing/LandingBottomCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

/**
 * @component IndexPage
 * @description Principal landing page showcasing EmitDocs's bulk document automation engine,
 * interactive workflow canvas, features bento grid, and technical verification benchmarks.
 * @returns {JSX.Element} Landing page.
 */
function IndexPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900 flex flex-col font-sans antialiased">
      {/* 1. Sticky Navigation Header */}
      <LandingHeader />

      {/* 2. Main Content Canvas */}
      <main className="flex-1 w-full">
        {/* Hero Section with Interactive Workflow Canvas */}
        <HeroSection />

        {/* Core Features Bento Grid */}
        <FeaturesBentoGrid />

        {/* 3-Step Workflow & Benchmarks Timeline */}
        <WorkflowTimeline />

        {/* Architectural Trust, Compliance & Zero Model Training */}
        <TrustAndSecurity />

        {/* High-Contrast Signature Deep Navy Call to Action */}
        <LandingBottomCta />
      </main>

      {/* 3. Comprehensive Brand Footer */}
      <LandingFooter />
    </div>
  );
}
