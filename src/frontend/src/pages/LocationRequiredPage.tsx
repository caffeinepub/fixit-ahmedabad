import { Button } from "@/components/ui/button";
import {
  Chrome,
  Copy,
  Info,
  MapPin,
  MapPinOff,
  Navigation,
  Smartphone,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { Page } from "../App";

interface LocationRequiredPageProps {
  navigate: (page: Page) => void;
  onRetry: () => void;
}

const STEPS = [
  {
    icon: Smartphone,
    platform: "Chrome on Android",
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    steps: [
      "Open Chrome menu (⋮) → Settings",
      "Privacy & Security → Site Settings",
      "Location → find this site → Allow",
    ],
  },
  {
    icon: Smartphone,
    platform: "Safari on iPhone/iPad",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    steps: [
      "Open iPhone Settings → Privacy & Security",
      "Location Services → Safari → While Using App",
      "Reload this page and Allow when prompted",
    ],
  },
  {
    icon: Chrome,
    platform: "Chrome on Desktop",
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    steps: [
      "Click the 🔒 lock icon in the address bar",
      'Find "Location" and change it to Allow',
      "Reload the page",
    ],
  },
];

export default function LocationRequiredPage({
  navigate,
  onRetry,
}: LocationRequiredPageProps) {
  const handleRetry = () => {
    onRetry();
    navigate("home");
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText("chrome://settings/content/location")
      .then(() => {
        toast.success(
          "Copied! Paste it in your address bar to open location settings",
        );
      })
      .catch(() => {
        toast.error("Could not copy to clipboard. Please copy manually.");
      });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-primary" />

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10 sm:py-16 max-w-2xl mx-auto w-full">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6"
          data-ocid="location_required.panel"
        >
          <MapPinOff className="w-10 h-10 sm:w-12 sm:h-12 text-destructive" />
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-2"
        >
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Location Access Required
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            FixIt Ahmedabad needs your location to find verified service
            providers nearby. Without it, we can't calculate distances or show
            you real-time availability.
          </p>
        </motion.div>

        {/* Why it's needed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="w-full bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex gap-3 items-start"
        >
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground mb-1">
              Why do we need your location?
            </p>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Show plumbers, electricians &amp; mechanics nearest to you
              </li>
              <li>Display live distance &amp; estimated arrival time</li>
              <li>Sort providers by how close they are to you right now</li>
            </ul>
          </div>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="w-full mb-8"
        >
          <h2 className="font-display font-bold text-foreground text-base sm:text-lg mb-3 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            How to enable location access
          </h2>
          <div className="grid gap-3">
            {STEPS.map(({ icon: Icon, platform, color, bg, steps }) => (
              <div key={platform} className={`border rounded-xl p-4 ${bg}`}>
                <div
                  className={`flex items-center gap-2 font-semibold text-sm mb-2 ${color}`}
                >
                  <Icon className="w-4 h-4" />
                  {platform}
                </div>
                <ol className="space-y-1 list-decimal list-inside">
                  {steps.map((s) => (
                    <li
                      key={s}
                      className="text-xs sm:text-sm text-foreground/80"
                    >
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="w-full flex flex-col gap-3"
        >
          <Button
            onClick={handleRetry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-semibold"
            data-ocid="location_required.retry.button"
          >
            <MapPin className="w-4 h-4 mr-2" />
            I've enabled location — Try Again
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="w-full h-12 text-base font-semibold"
            data-ocid="location_required.copy.button"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Location Settings Link
          </Button>
          <button
            type="button"
            onClick={() => navigate("home")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center underline-offset-4 hover:underline"
            data-ocid="location_required.skip.button"
          >
            Continue without location
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground px-4">
        © {new Date().getFullYear()} FixIt Ahmedabad. Ahmedabad, Gujarat, India.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Built with ❤️ using caffeine.ai
        </a>
      </footer>
    </div>
  );
}
