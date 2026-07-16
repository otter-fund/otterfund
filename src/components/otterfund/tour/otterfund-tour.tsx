"use client";

// otterfund first-run tour — the client wrapper.
//
// Rendered by (app)/layout.tsx AROUND the whole dashboard shell, so the tour's
// spotlight can reach both chrome anchors (rail, bell, avatar, month picker)
// and page anchors (the overview canvas, the add-account CTA). It sets up
// NextStepjs, renders the on-brand <TourCard>, and:
//   • auto-starts the tour once when `autoStart` is true (first visit — the
//     server passes tourCompletedAt == null), via the inner TourController.
//   • stamps `tourCompletedAt` through the completeTour mutation on finish OR
//     skip, so it never auto-starts again.
// Replays are triggered from the profile menu via useOtterfundTour().startTour();
// the tour is single-page (all anchors live on /dashboard), so a replay first
// navigates there and then starts once the route settles.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NextStep, NextStepProvider, useNextStep } from "nextstepjs";
import { useNextAdapter } from "nextstepjs/adapters/next";
import { useReducedMotion } from "motion/react";
import { gqlClient } from "@/lib/graphql/client";
import { useMediaQuery } from "@/lib/use-media-query";
import { buildOtterfundTour, TOUR_NAME } from "@/components/otterfund/tour/tour-steps";
import { TourCard } from "@/components/otterfund/tour/tour-card";

const COMPLETE_TOUR = /* GraphQL */ `
  mutation CompleteTour {
    completeTour { ok }
  }
`;

// The tour lives on /dashboard. Replays route there first, so the trigger can be
// fired from anywhere (e.g. the profile menu on the Accounts page). Exposed via
// context because the trigger (chrome) sits outside the component that owns the
// NextStepjs hook — the context bridges them.
const TourReplayContext = createContext<{ startTour: () => void }>({ startTour: () => {} });

/** Used by the profile menu's "Take a tour" — replays from any page. */
export function useOtterfundTour() {
  return useContext(TourReplayContext);
}

/**
 * Owns auto-start, replay-after-navigation, and the pin-to-/dashboard safety
 * net. Lives inside NextStepProvider so it can drive the tour. Renders nothing.
 */
function TourController({ autoStart, replayNonce }: { autoStart: boolean; replayNonce: number }) {
  const { startNextStep, isNextStepVisible, closeNextStep } = useNextStep();
  const pathname = usePathname();
  const fired = useRef(false); // auto-start guard (once per mount)
  const handledReplay = useRef(0); // last replay nonce we acted on

  // First-run auto-start: on Overview, at any width. The step script adapts to
  // the viewport (desktop rail vs the mobile hamburger menu), so the tour runs on
  // phones too — see buildOtterfundTour({ isMobile }).
  useEffect(() => {
    if (!autoStart || fired.current) return;
    if (pathname !== "/dashboard") return;
    fired.current = true;
    // A short beat so the shell + overview anchors are painted before the
    // spotlight measures them (the welcome step is centered, so this is
    // belt-and-braces).
    const t = window.setTimeout(() => startNextStep(TOUR_NAME), 450);
    return () => window.clearTimeout(t);
  }, [autoStart, pathname, startNextStep]);

  // Replay: fire once the nonce bumps AND we're on /dashboard (the trigger routes
  // us here first if needed, so this runs after the route settles).
  useEffect(() => {
    if (replayNonce === 0 || replayNonce === handledReplay.current) return;
    if (pathname !== "/dashboard") return;
    handledReplay.current = replayNonce;
    const t = window.setTimeout(() => startNextStep(TOUR_NAME), 300);
    return () => window.clearTimeout(t);
  }, [replayNonce, pathname, startNextStep]);

  // Safety net: the tour is single-page. If it's running and the route leaves
  // /dashboard for any reason, close it cleanly rather than soft-locking on a
  // page where the next anchor doesn't exist.
  useEffect(() => {
    if (isNextStepVisible && pathname !== "/dashboard") closeNextStep();
  }, [isNextStepVisible, pathname, closeNextStep]);

  return null;
}

export function OtterfundTour({
  autoStart,
  firstName,
  hasAccounts,
  children,
}: {
  autoStart: boolean;
  firstName?: string | null;
  hasAccounts: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Below the rail breakpoint the nav lives behind the hamburger — build the
  // mobile step variants so anchors land on elements that actually exist. SSR
  // defaults to desktop (matches the rail's own default); the 450ms auto-start
  // beat is long past the post-mount correction, so the right steps are ready.
  const isMobile = !useMediaQuery("(min-width: 769px)", true);
  const steps = useMemo(
    () => buildOtterfundTour({ firstName, hasAccounts, isMobile }),
    [firstName, hasAccounts, isMobile],
  );

  // Replay trigger: bump a nonce (TourController watches it) and, if we're not on
  // /dashboard, navigate there so the anchors exist before the tour starts.
  const [replayNonce, setReplayNonce] = useState(0);
  const startTour = useCallback(() => {
    setReplayNonce((n) => n + 1);
    if (pathname !== "/dashboard") router.push("/dashboard");
  }, [pathname, router]);

  // Finish and skip both mean "don't auto-start again" — stamp it, fire-and-forget
  // (the UI has already closed; a failed write just means it may re-arm next load).
  const markSeen = useCallback(() => {
    gqlClient.request(COMPLETE_TOUR).catch(() => {});
  }, []);

  return (
    <TourReplayContext.Provider value={{ startTour }}>
      <NextStepProvider>
        <NextStep
          steps={steps}
          cardComponent={TourCard}
          navigationAdapter={useNextAdapter}
          onComplete={markSeen}
          onSkip={markSeen}
          // Warm, deep scrim rather than flat black — on-brand and premium.
          shadowRgb="28, 25, 20"
          shadowOpacity="0.52"
          scrollToTop={false}
          // Every anchor is already fully visible on /dashboard, so suppress
          // NextStep's scroll-into-view — otherwise the Overview step scrolls the
          // canvas up and clips the spotlight's top padding against the greeting.
          noInViewScroll
          // Calm reveal that matches the app's motion language (globals.css
          // cubic-bezier(.22,.61,.36,1)) instead of a springy bounce.
          cardTransition={reduce ? { duration: 0 } : { ease: [0.22, 0.61, 0.36, 1], duration: 0.42 }}
        >
          <TourController autoStart={autoStart} replayNonce={replayNonce} />
          {children}
        </NextStep>
      </NextStepProvider>
    </TourReplayContext.Provider>
  );
}
