import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Settings,
  Star,
  Wrench,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Page } from "../App";
import type { Provider } from "../backend";
import { ServiceType } from "../backend";
import { useActor } from "../hooks/useActor";
import {
  estimatedTravelTime,
  haversineDistance,
  serviceTypeLabel,
} from "../utils/helpers";

const BOOKING_STORAGE_KEY = "fixit_active_booking";

type GpsState = "idle" | "requesting" | "granted" | "denied" | "error";

interface HomePageProps {
  navigate: (page: Page) => void;
  /** When true, HomePage should re-request GPS even if it already tried once */
  pendingGpsRetry?: boolean;
  /** Called after consuming the pendingGpsRetry flag */
  onGpsRetryConsumed?: () => void;
}

interface ProviderWithDistance extends Provider {
  distance: number;
}

const SERVICE_OPTIONS = [
  { value: ServiceType.plumber, label: "Plumber", icon: Wrench },
  { value: ServiceType.electrician, label: "Electrician", icon: Zap },
  { value: ServiceType.mechanic, label: "Mechanic", icon: Settings },
];

export default function HomePage({
  navigate,
  pendingGpsRetry,
  onGpsRetryConsumed,
}: HomePageProps) {
  const { actor } = useActor();

  // GPS state
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Providers state
  const [allProviders, setAllProviders] = useState<ProviderWithDistance[]>([]);
  const [fetchingProviders, setFetchingProviders] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [liveRefreshActive, setLiveRefreshActive] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Active booking state
  const [hasActiveBooking, setHasActiveBooking] = useState(false);

  // Filter
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "">(
    "all" as unknown as ServiceType | "",
  );

  // Booking modal state
  const [bookingProvider, setBookingProvider] =
    useState<ProviderWithDistance | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingContact, setBookingContact] = useState("");
  const [bookingIssue, setBookingIssue] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingId, setBookingId] = useState<bigint | null>(null);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState("error");
      toast.error("GPS not supported in your browser");
      return;
    }
    setGpsState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGpsState("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsState("denied");
        } else {
          setGpsState("error");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Auto-request GPS on mount
  useEffect(() => {
    requestGps();
  }, [requestGps]);

  // Consume pendingGpsRetry flag — re-request GPS if navigated back from LocationRequiredPage
  useEffect(() => {
    if (pendingGpsRetry) {
      onGpsRetryConsumed?.();
      setHasFetched(false);
      requestGps();
    }
  }, [pendingGpsRetry, onGpsRetryConsumed, requestGps]);

  // Redirect to location-required page when GPS is denied or errored
  useEffect(() => {
    if (gpsState === "denied" || gpsState === "error") {
      navigate("location-required");
    }
  }, [gpsState, navigate]);

  // Check for active booking once actor and GPS are ready
  useEffect(() => {
    if (!actor) return;
    const stored = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (!stored) {
      setHasActiveBooking(false);
      return;
    }
    try {
      const entry = JSON.parse(stored) as {
        bookingId: string;
        userContact: string;
      };
      (actor as any)
        .getActiveBookingByContact(entry.userContact)
        .then((activeBooking) => {
          if (activeBooking) {
            setHasActiveBooking(true);
          } else {
            // Booking is no longer active — clean up
            localStorage.removeItem(BOOKING_STORAGE_KEY);
            setHasActiveBooking(false);
          }
        })
        .catch(() => {
          // Keep localStorage as-is if check fails
        });
    } catch {
      localStorage.removeItem(BOOKING_STORAGE_KEY);
      setHasActiveBooking(false);
    }
  }, [actor]);

  // Helper: fetch and sort providers using current user lat/lng
  const fetchAndSortProviders = useCallback(
    async (lat: number, lng: number) => {
      if (!actor) return;
      try {
        const [plumbers, electricians, mechanics] = await Promise.all([
          actor.getApprovedProvidersByServiceType(ServiceType.plumber),
          actor.getApprovedProvidersByServiceType(ServiceType.electrician),
          actor.getApprovedProvidersByServiceType(ServiceType.mechanic),
        ]);

        const combined: ProviderWithDistance[] = [
          ...plumbers,
          ...electricians,
          ...mechanics,
        ].map((p) => ({
          ...p,
          distance: haversineDistance(lat, lng, p.lat, p.lng),
        }));

        combined.sort((a, b) => {
          if (a.isAvailable !== b.isAvailable) {
            return a.isAvailable ? -1 : 1;
          }
          return a.distance - b.distance;
        });

        setAllProviders(combined);
      } catch {
        // Silent fail for refresh — only show toast on initial fetch
      }
    },
    [actor],
  );

  // Auto-fetch providers once GPS is granted and actor is ready
  useEffect(() => {
    if (
      gpsState !== "granted" ||
      userLat === null ||
      userLng === null ||
      !actor ||
      hasFetched
    ) {
      return;
    }

    setFetchingProviders(true);
    setHasFetched(true);

    fetchAndSortProviders(userLat, userLng)
      .catch(() => {
        toast.error("Failed to load providers. Please refresh.");
      })
      .finally(() => {
        setFetchingProviders(false);
      });
  }, [gpsState, userLat, userLng, actor, hasFetched, fetchAndSortProviders]);

  // Live refresh interval — every 15 seconds once GPS is granted and initial fetch is done
  useEffect(() => {
    if (
      gpsState !== "granted" ||
      !hasFetched ||
      userLat === null ||
      userLng === null
    ) {
      if (refreshIntervalRef.current !== null) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
        setLiveRefreshActive(false);
      }
      return;
    }

    setLiveRefreshActive(true);

    const intervalId = setInterval(() => {
      setUserLat((currentLat) => {
        setUserLng((currentLng) => {
          if (currentLat !== null && currentLng !== null) {
            fetchAndSortProviders(currentLat, currentLng);
          }
          return currentLng;
        });
        return currentLat;
      });
    }, 15_000);

    refreshIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      refreshIntervalRef.current = null;
      setLiveRefreshActive(false);
    };
  }, [gpsState, hasFetched, userLat, userLng, fetchAndSortProviders]);

  // Filtered providers (client-side)
  const filteredProviders =
    serviceFilter === "" || (serviceFilter as string) === "all"
      ? allProviders
      : allProviders.filter((p) => p.serviceType === serviceFilter);

  const handleBookingSubmit = useCallback(async () => {
    if (!bookingProvider || !actor || userLat === null || userLng === null)
      return;
    if (!bookingName.trim() || !bookingContact.trim() || !bookingIssue.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setBookingLoading(true);
    const locationLabel = `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
    try {
      const id = await actor.submitBookingRequest(
        bookingProvider.principal,
        bookingName,
        bookingContact,
        bookingIssue,
        userLat,
        userLng,
        locationLabel,
      );
      // Save active booking to localStorage
      localStorage.setItem(
        BOOKING_STORAGE_KEY,
        JSON.stringify({
          bookingId: id.toString(),
          userContact: bookingContact,
        }),
      );
      setHasActiveBooking(true);
      setBookingId(id);
      toast.success("Booking request sent!");
      // Navigate directly to tracking page
      resetBookingModal();
      navigate("track-booking");
    } catch {
      toast.error("Failed to submit booking. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }, [
    bookingProvider,
    actor,
    bookingName,
    bookingContact,
    bookingIssue,
    userLat,
    userLng,
    navigate,
  ]);

  const resetBookingModal = () => {
    setBookingProvider(null);
    setBookingName("");
    setBookingContact("");
    setBookingIssue("");
    setBookingId(null);
  };

  const isLocationBlocked = gpsState === "denied" || gpsState === "error";

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative min-h-[280px] sm:min-h-[380px] flex items-center"
        style={{ background: "oklch(0.30 0.057 231)" }}
      >
        {/* Hero image overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage: `url('/assets/generated/hero-services.dim_800x500.jpg')`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 w-full">
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
              Your Trusted Home Services
              <span className="block text-primary mt-1"> in Ahmedabad</span>
            </h1>
            <p className="text-white/80 text-sm sm:text-lg mb-5 sm:mb-8">
              Find verified plumbers, electricians, and mechanics near you.
              Fast, reliable, and transparent pricing.
            </p>

            {/* Search Form — GPS chip replaces location text input */}
            <AnimatePresence mode="wait">
              {isLocationBlocked ? (
                <motion.div
                  key="blocked"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white rounded-xl shadow-hero p-4 sm:p-6 text-center"
                  data-ocid="location.error_state"
                >
                  <MapPin className="w-8 h-8 sm:w-10 sm:h-10 text-destructive mx-auto mb-3" />
                  <h2 className="font-display text-lg sm:text-xl font-bold text-foreground mb-2">
                    Location Access Required
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm mb-4">
                    Please allow location access in your browser settings so we
                    can find nearby service providers.
                  </p>
                  <Button
                    onClick={() => navigate("location-required")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    data-ocid="location.retry.button"
                  >
                    <Navigation className="w-4 h-4 mr-2" /> How to Enable
                    Location
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white rounded-xl shadow-hero p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
                >
                  {/* Service type filter */}
                  <select
                    value={serviceFilter}
                    onChange={(e) =>
                      setServiceFilter(e.target.value as ServiceType | "")
                    }
                    className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    data-ocid="search.select"
                  >
                    <option value="all">All Service Types</option>
                    {SERVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* GPS status chip */}
                  <GpsChip
                    gpsState={gpsState}
                    lat={userLat}
                    lng={userLng}
                    onRetry={requestGps}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {/* Left column */}
          <div className="flex-1 min-w-0">
            {/* Active Booking Banner */}
            <AnimatePresence>
              {hasActiveBooking && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div
                    className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2"
                    data-ocid="booking.active.panel"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-blue-900 text-xs sm:text-sm">
                          You have an active booking
                        </p>
                        <p className="text-xs text-blue-700 hidden sm:block">
                          Track it to see the latest status.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate("track-booking")}
                      className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 text-xs h-8"
                      data-ocid="booking.active.button"
                    >
                      View Booking
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nearby Providers Section */}
            <section className="mb-8 sm:mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg sm:text-2xl font-bold text-foreground">
                  {gpsState === "granted" && !fetchingProviders && hasFetched
                    ? filteredProviders.length > 0
                      ? `${filteredProviders.length} Provider${
                          filteredProviders.length === 1 ? "" : "s"
                        } Near You`
                      : "No Providers Found"
                    : "Nearby Providers"}
                </h2>
                <div className="flex items-center gap-2">
                  {liveRefreshActive && (
                    <div
                      className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2 sm:px-2.5 py-1 text-xs font-medium text-green-800"
                      data-ocid="providers.live.success_state"
                    >
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </div>
                  )}
                  {gpsState === "granted" &&
                    hasFetched &&
                    filteredProviders.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-xs hidden sm:flex"
                        data-ocid="providers.list"
                      >
                        Sorted by distance
                      </Badge>
                    )}
                </div>
              </div>

              {/* Loading state */}
              {(gpsState === "requesting" || fetchingProviders) && (
                <div
                  className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3"
                  data-ocid="providers.loading_state"
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-card rounded-xl border border-border shadow-card p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-12 rounded-lg" />
                        <Skeleton className="h-12 rounded-lg" />
                      </div>
                      <Skeleton className="h-10 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}

              {/* Idle / GPS not yet requested */}
              {gpsState === "idle" && !fetchingProviders && (
                <div
                  className="bg-card rounded-xl border border-border p-8 sm:p-10 text-center text-muted-foreground"
                  data-ocid="providers.empty_state"
                >
                  <Navigation className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-base sm:text-lg font-medium mb-1">
                    Waiting for GPS...
                  </p>
                  <p className="text-sm">
                    Allow location access to see nearby providers.
                  </p>
                </div>
              )}

              {/* GPS denied — fallback (redirect should have happened, but keep as safety net) */}
              {isLocationBlocked && (
                <div
                  className="bg-card rounded-xl border border-destructive/30 p-8 sm:p-10 text-center"
                  data-ocid="providers.error_state"
                >
                  <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-destructive opacity-70" />
                  <p className="text-base sm:text-lg font-medium mb-1 text-foreground">
                    Location Access Required
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please allow location access in your browser settings.
                  </p>
                  <Button
                    onClick={() => navigate("location-required")}
                    variant="outline"
                    data-ocid="providers.retry.button"
                  >
                    <Navigation className="w-4 h-4 mr-2" /> How to Enable
                  </Button>
                </div>
              )}

              {/* Providers list */}
              {gpsState === "granted" && !fetchingProviders && hasFetched && (
                <AnimatePresence>
                  {filteredProviders.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-card rounded-xl border border-border p-8 sm:p-10 text-center text-muted-foreground"
                      data-ocid="providers.empty_state"
                    >
                      <div className="text-4xl sm:text-5xl mb-3">😔</div>
                      <p className="text-base sm:text-lg font-medium mb-2">
                        No providers found
                      </p>
                      <p className="text-sm">
                        All providers might be unavailable right now. Try
                        another service type or check back later.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      data-ocid="providers.list"
                    >
                      {filteredProviders.map((provider, idx) => (
                        <ProviderCard
                          key={provider.principal.toString()}
                          provider={provider}
                          index={idx + 1}
                          onBook={() => setBookingProvider(provider)}
                          bookingActive={hasActiveBooking}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </section>

            {/* How it works */}
            <section className="mb-8 sm:mb-10">
              <h2 className="font-display text-lg sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">
                How FixIt Works
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                  {
                    step: 1,
                    icon: "📍",
                    title: "Share Location",
                    desc: "Allow GPS to detect your position",
                  },
                  {
                    step: 2,
                    icon: "👤",
                    title: "Select",
                    desc: "Choose the nearest available pro",
                  },
                  {
                    step: 3,
                    icon: "📋",
                    title: "Book",
                    desc: "Submit your request in seconds",
                  },
                  {
                    step: 4,
                    icon: "✅",
                    title: "Done",
                    desc: "Pro confirms and arrives at your door",
                  },
                ].map(({ step, icon, title, desc }) => (
                  <div
                    key={step}
                    className="bg-card rounded-xl border border-border p-3 sm:p-5 text-center shadow-card"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm flex items-center justify-center mx-auto mb-2">
                      {step}
                    </div>
                    <div className="text-xl sm:text-2xl mb-1 sm:mb-2">
                      {icon}
                    </div>
                    <p className="font-semibold text-foreground text-xs sm:text-sm mb-1">
                      {title}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="lg:w-80 shrink-0 space-y-4 sm:space-y-5">
            {/* Why Choose */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
              <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4">
                Why Choose FixIt?
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {[
                  {
                    icon: "✅",
                    title: "Verified Pros",
                    desc: "License-checked by our admin team",
                  },
                  {
                    icon: "⚡",
                    title: "Fast Response",
                    desc: "Providers in Ahmedabad, ready now",
                  },
                  {
                    icon: "💰",
                    title: "Transparent Pricing",
                    desc: "See exact base fee before booking",
                  },
                  {
                    icon: "📍",
                    title: "Live Location",
                    desc: "Real-time distance from active pros",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-2 sm:gap-3">
                    <span className="text-base sm:text-lg shrink-0">
                      {icon}
                    </span>
                    <div>
                      <p className="font-semibold text-xs sm:text-sm text-foreground">
                        {title}
                      </p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Categories */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
              <h3 className="font-display font-bold text-foreground mb-3 sm:mb-4">
                Filter by Service
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {SERVICE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      setServiceFilter(
                        serviceFilter === value
                          ? ("all" as unknown as ServiceType)
                          : value,
                      );
                    }}
                    className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5 ${
                      serviceFilter === value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-ocid={`filter.${label.toLowerCase()}.tab`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Provider CTA */}
            <div
              className="rounded-xl p-4 sm:p-5 text-white"
              style={{ background: "oklch(0.30 0.057 231)" }}
            >
              <h3 className="font-display font-bold text-base sm:text-lg mb-2">
                Are you a Pro?
              </h3>
              <p className="text-white/80 text-xs sm:text-sm mb-3 sm:mb-4">
                Join FixIt Ahmedabad and start receiving booking requests today.
              </p>
              <Button
                onClick={() => navigate("provider-register")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                data-ocid="sidebar.register.button"
              >
                Register as Provider
              </Button>
            </div>

            {/* Track Booking */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card">
              <h3 className="font-display font-bold text-foreground mb-2">
                Track a Booking
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                Already booked? Check your request status.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("track-booking")}
                data-ocid="sidebar.track.button"
              >
                Track Booking Status
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-foreground text-white/80 mt-8 sm:mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row justify-between gap-5 sm:gap-6">
            <div>
              <div className="font-display font-bold text-white text-lg mb-2">
                FixIt Ahmedabad
              </div>
              <p className="text-sm text-white/60 max-w-xs">
                Your trusted home services platform for Ahmedabad, Gujarat,
                India.
              </p>
            </div>
            <div className="flex gap-6 sm:gap-8 text-sm">
              <div>
                <p className="font-semibold text-white mb-2">Services</p>
                <ul className="space-y-1 text-white/60">
                  <li>Plumber</li>
                  <li>Electrician</li>
                  <li>Mechanic</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-2">Quick Links</p>
                <ul className="space-y-1 text-white/60">
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("provider-register")}
                      className="hover:text-white transition-colors"
                    >
                      Become a Pro
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("track-booking")}
                      className="hover:text-white transition-colors"
                    >
                      Track Booking
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigate("admin")}
                      className="hover:text-white transition-colors"
                    >
                      Admin Panel
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-6 sm:mt-8 pt-5 sm:pt-6 text-center text-xs sm:text-sm text-white/40">
            © {new Date().getFullYear()} FixIt Ahmedabad. All rights reserved.
            Ahmedabad, Gujarat, India.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/70 transition-colors"
            >
              Built with ❤️ using caffeine.ai
            </a>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <Dialog
        open={!!bookingProvider}
        onOpenChange={(open) => {
          if (!open) resetBookingModal();
        }}
      >
        <DialogContent
          className="max-w-md mx-3 sm:mx-auto"
          data-ocid="booking.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-base sm:text-lg">
              {bookingId
                ? "Booking Submitted!"
                : `Book ${bookingProvider?.name}`}
            </DialogTitle>
          </DialogHeader>

          {bookingId ? (
            <div className="text-center py-4" data-ocid="booking.success_state">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <p className="text-foreground font-medium mb-2">
                Your booking request has been sent!
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                Redirecting to tracking page...
              </p>
              <div className="bg-secondary rounded-lg p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Booking ID</p>
                <p className="font-display text-2xl font-bold text-primary">
                  #{bookingId.toString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-secondary rounded-lg p-3 text-sm">
                <p className="font-medium text-foreground">
                  {bookingProvider?.name}
                </p>
                <p className="text-muted-foreground">
                  {serviceTypeLabel(bookingProvider?.serviceType ?? "")} • ₹
                  {Number(bookingProvider?.baseFeeINR ?? 0)} base fee
                </p>
                {userLat !== null && userLng !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <Navigation className="inline w-3 h-3 mr-1" />
                    Your location: {userLat.toFixed(4)}, {userLng.toFixed(4)}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Your Name</Label>
                <Input
                  placeholder="Full name"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  data-ocid="booking.name.input"
                />
              </div>

              <div className="space-y-1">
                <Label>Contact Number</Label>
                <Input
                  placeholder="+91 XXXXX XXXXX"
                  value={bookingContact}
                  onChange={(e) => setBookingContact(e.target.value)}
                  data-ocid="booking.contact.input"
                />
              </div>

              <div className="space-y-1">
                <Label>Describe the Issue</Label>
                <Textarea
                  placeholder="E.g. Leaking pipe under kitchen sink..."
                  value={bookingIssue}
                  onChange={(e) => setBookingIssue(e.target.value)}
                  rows={3}
                  data-ocid="booking.issue.textarea"
                />
              </div>

              <Button
                onClick={handleBookingSubmit}
                disabled={bookingLoading || hasActiveBooking}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                data-ocid="booking.submit_button"
              >
                {bookingLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {hasActiveBooking ? "Booking Active" : "Send Booking Request"}
              </Button>

              {hasActiveBooking && (
                <p className="text-xs text-center text-muted-foreground">
                  You already have an active booking.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      resetBookingModal();
                      navigate("track-booking");
                    }}
                    className="text-primary hover:underline"
                  >
                    Track it here.
                  </button>
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// GPS Status Chip
interface GpsChipProps {
  gpsState: GpsState;
  lat: number | null;
  lng: number | null;
  onRetry: () => void;
}

function GpsChip({ gpsState, lat, lng, onRetry }: GpsChipProps) {
  if (gpsState === "requesting" || gpsState === "idle") {
    return (
      <div
        className="flex items-center gap-2 bg-secondary/80 rounded-lg px-3 sm:px-4 py-2.5 text-sm text-muted-foreground shrink-0"
        data-ocid="gps.loading_state"
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Detecting location...</span>
      </div>
    );
  }

  if (gpsState === "granted" && lat !== null && lng !== null) {
    return (
      <div
        className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 sm:px-4 py-2.5 text-sm shrink-0"
        data-ocid="gps.success_state"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        <span className="text-green-800 font-medium">Location detected</span>
        <span className="text-green-600 text-xs hidden sm:inline">
          ({lat.toFixed(3)}, {lng.toFixed(3)})
        </span>
      </div>
    );
  }

  // denied or error
  return (
    <button
      type="button"
      onClick={onRetry}
      className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 sm:px-4 py-2.5 text-sm text-red-700 shrink-0 hover:bg-red-100 transition-colors"
      data-ocid="gps.error_state"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
      <span className="font-medium">Enable location</span>
      <Navigation className="w-3.5 h-3.5" />
    </button>
  );
}

// Provider Card Component
interface ProviderCardProps {
  provider: ProviderWithDistance;
  index: number;
  onBook: () => void;
  bookingActive: boolean;
}

function ProviderCard({
  provider,
  index,
  onBook,
  bookingActive,
}: ProviderCardProps) {
  const travelTime = estimatedTravelTime(provider.distance);
  const initial = provider.name.charAt(0).toUpperCase();

  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  const colorIndex = provider.name.charCodeAt(0) % avatarColors.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className={`bg-card rounded-xl border border-border shadow-card flex flex-col overflow-hidden hover:shadow-hero transition-shadow ${
        !provider.isAvailable ? "opacity-60" : ""
      }`}
      data-ocid={`providers.item.${index}`}
    >
      <div className="p-3 sm:p-5 flex-1">
        <div className="flex items-start gap-2 sm:gap-3 mb-3">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${avatarColors[colorIndex]} text-white font-bold text-base sm:text-lg flex items-center justify-center shrink-0`}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                {provider.name}
              </h3>
              {!provider.isAvailable && (
                <Badge
                  variant="secondary"
                  className="text-[10px] shrink-0 bg-muted text-muted-foreground"
                >
                  Unavailable
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {serviceTypeLabel(provider.serviceType)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              <MapPin className="inline w-3 h-3 mr-0.5" />
              {provider.locationLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-2 sm:mb-3">
          <Star className="w-3.5 h-3.5 fill-star text-star" />
          <span className="text-xs text-muted-foreground">Verified Pro</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-verified ml-1" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-4">
          <div className="bg-secondary rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="font-semibold text-xs sm:text-sm text-foreground">
              {provider.distance.toFixed(1)} km
            </p>
          </div>
          <div className="bg-secondary rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Travel Time</p>
            <p className="font-semibold text-xs sm:text-sm text-foreground">
              {travelTime}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Starts at</span>
            <p className="font-bold text-foreground text-sm sm:text-base">
              ₹{Number(provider.baseFeeINR)}
            </p>
          </div>
          <Badge
            className="bg-verified/10 text-verified border-verified/20 text-xs"
            variant="outline"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
          </Badge>
        </div>
      </div>

      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        {bookingActive ? (
          <Button
            disabled
            variant="outline"
            className="w-full cursor-not-allowed text-muted-foreground text-sm"
            data-ocid={`providers.book.button.${index}`}
          >
            Booking Active
          </Button>
        ) : provider.isAvailable ? (
          <Button
            onClick={onBook}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
            data-ocid={`providers.book.button.${index}`}
          >
            Book Now
          </Button>
        ) : (
          <Button
            disabled
            variant="outline"
            className="w-full cursor-not-allowed text-sm"
            data-ocid={`providers.book.button.${index}`}
          >
            Unavailable
          </Button>
        )}
      </div>
    </motion.div>
  );
}
