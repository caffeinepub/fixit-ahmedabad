import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Page } from "../App";
import type { Booking, Provider } from "../backend";
import { BookingStatus } from "../backend";
import { useActor } from "../hooks/useActor";
import {
  estimatedTravelTime,
  formatDate,
  haversineDistance,
  serviceTypeIcon,
  serviceTypeLabel,
} from "../utils/helpers";

const STORAGE_KEY = "fixit_active_booking";

interface ActiveBookingEntry {
  bookingId: string;
  userContact: string;
}

interface TrackBookingPageProps {
  navigate: (page: Page) => void;
}

export default function TrackBookingPage({ navigate }: TrackBookingPageProps) {
  const { actor } = useActor();

  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hasStoredBooking, setHasStoredBooking] = useState(false);

  // Manual fallback search
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBookingAndProvider = useCallback(
    async (bookingId: bigint) => {
      if (!actor) return;
      try {
        const [bk] = await Promise.all([actor.getBookingById(bookingId)]);
        setBooking(bk);
        if (bk) {
          const prov = await (actor as any).getProviderByPrincipal(
            bk.providerPrincipal,
          );
          setProvider(prov);
        }
      } catch {
        setBooking(null);
      }
    },
    [actor],
  );

  // On mount: read localStorage and fetch
  useEffect(() => {
    if (!actor) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      setHasStoredBooking(false);
      return;
    }

    let entry: ActiveBookingEntry;
    try {
      entry = JSON.parse(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    setHasStoredBooking(true);
    setLoading(true);

    fetchBookingAndProvider(BigInt(entry.bookingId)).finally(() => {
      setLoading(false);
    });

    // Start polling every 15 seconds
    pollingRef.current = setInterval(() => {
      fetchBookingAndProvider(BigInt(entry.bookingId));
    }, 15_000);

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [actor, fetchBookingAndProvider]);

  const clearActiveBooking = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleMarkComplete = useCallback(async () => {
    if (!actor || !booking) return;
    setActionLoading("complete");
    try {
      await (actor as any).markBookingComplete(booking.id);
      clearActiveBooking();
      await fetchBookingAndProvider(booking.id);
      toast.success("Service marked as complete! Thank you.");
    } catch (err: unknown) {
      toast.error(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading(null);
    }
  }, [actor, booking, fetchBookingAndProvider, clearActiveBooking]);

  const handleCancel = useCallback(async () => {
    if (!actor || !booking) return;
    setActionLoading("cancel");
    try {
      await (actor as any).cancelBooking(booking.id);
      clearActiveBooking();
      await fetchBookingAndProvider(booking.id);
      toast.success("Booking cancelled.");
    } catch (err: unknown) {
      toast.error(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading(null);
    }
  }, [actor, booking, fetchBookingAndProvider, clearActiveBooking]);

  const handleManualSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const id = Number.parseInt(manualId.trim(), 10);
      if (Number.isNaN(id) || id <= 0) {
        toast.error("Please enter a valid booking ID");
        return;
      }
      if (!actor) {
        toast.error("Connecting to backend...");
        return;
      }
      setManualLoading(true);
      setBooking(undefined);
      try {
        await fetchBookingAndProvider(BigInt(id));
      } catch {
        setBooking(null);
        toast.error("Booking not found");
      } finally {
        setManualLoading(false);
      }
    },
    [actor, manualId, fetchBookingAndProvider],
  );

  // ── Status config ─────────────────────────────────────────────────────
  const statusConfig: Record<
    string,
    {
      icon: React.ElementType;
      label: string;
      color: string;
      bg: string;
      borderColor: string;
      pulse: boolean;
      desc: string;
    }
  > = {
    [BookingStatus.pending]: {
      icon: Clock,
      label: "Pending",
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      borderColor: "border-yellow-300",
      pulse: true,
      desc: "Waiting for the provider to respond to your request.",
    },
    [BookingStatus.accepted]: {
      icon: CheckCircle2,
      label: "Accepted",
      color: "text-blue-700",
      bg: "bg-blue-50",
      borderColor: "border-blue-300",
      pulse: false,
      desc: "Provider accepted! They will contact you shortly.",
    },
    ["inProgress" as BookingStatus]: {
      icon: Navigation,
      label: "In Progress",
      color: "text-green-700",
      bg: "bg-green-50",
      borderColor: "border-green-300",
      pulse: true,
      desc: "Service in progress — the provider is on the way or working.",
    },
    [BookingStatus.declined]: {
      icon: XCircle,
      label: "Declined",
      color: "text-red-700",
      bg: "bg-red-50",
      borderColor: "border-red-300",
      pulse: false,
      desc: "The provider declined your request. You can find another provider.",
    },
    ["completed" as BookingStatus]: {
      icon: CheckCircle2,
      label: "Completed",
      color: "text-green-700",
      bg: "bg-green-50",
      borderColor: "border-green-300",
      pulse: false,
      desc: "Service completed! Thank you for using FixIt Ahmedabad.",
    },
    ["cancelled" as BookingStatus]: {
      icon: X,
      label: "Cancelled",
      color: "text-gray-600",
      bg: "bg-gray-50",
      borderColor: "border-gray-300",
      pulse: false,
      desc: "This booking was cancelled.",
    },
  };

  // ── Render: loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Render: no stored booking ───────────────────────────────────────────────
  if (!hasStoredBooking && booking === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
        <PageHeader navigate={navigate} />
        <AnimatePresence>
          {!showManualSearch ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-card rounded-2xl border border-border p-8 sm:p-10 text-center shadow-card"
              data-ocid="tracking.empty_state"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground mb-2">
                No Active Booking
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                You don’t have an active booking. Book a service provider to
                start tracking.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => navigate("home")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-ocid="tracking.primary_button"
                >
                  Find a Provider
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowManualSearch(true)}
                  data-ocid="tracking.secondary_button"
                >
                  Enter Booking ID
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              data-ocid="tracking.panel"
            >
              <ManualSearchForm
                manualId={manualId}
                setManualId={setManualId}
                onSubmit={handleManualSearch}
                loading={manualLoading}
                onBack={() => {
                  setShowManualSearch(false);
                  setBooking(undefined);
                }}
              />
              {booking === null && (
                <div
                  className="mt-4 bg-card rounded-xl border border-border p-5 sm:p-6 text-center text-muted-foreground"
                  data-ocid="tracking.error_state"
                >
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="font-medium text-foreground">
                    Booking Not Found
                  </p>
                  <p className="text-sm mt-1">
                    No booking found with ID #{manualId}.
                  </p>
                </div>
              )}
              {booking && (
                <BookingDetails
                  booking={booking}
                  provider={provider}
                  statusConfig={statusConfig}
                  actionLoading={actionLoading}
                  onMarkComplete={handleMarkComplete}
                  onCancel={handleCancel}
                  onNavigate={navigate}
                  onClearStorage={clearActiveBooking}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Render: main tracking view ──────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
      <PageHeader navigate={navigate} />

      {booking === null && (
        <div
          className="bg-card rounded-2xl border border-border p-8 sm:p-10 text-center shadow-card"
          data-ocid="tracking.error_state"
        >
          <AlertTriangle className="w-9 h-9 sm:w-10 sm:h-10 text-destructive mx-auto mb-3" />
          <p className="font-medium text-foreground mb-2">Booking Not Found</p>
          <p className="text-muted-foreground text-sm mb-5">
            The booking could not be loaded. It may have been removed.
          </p>
          <Button
            onClick={() => navigate("home")}
            className="bg-primary text-primary-foreground"
            data-ocid="tracking.primary_button"
          >
            Go Home
          </Button>
        </div>
      )}

      {booking && (
        <BookingDetails
          booking={booking}
          provider={provider}
          statusConfig={statusConfig}
          actionLoading={actionLoading}
          onMarkComplete={handleMarkComplete}
          onCancel={handleCancel}
          onNavigate={navigate}
          onClearStorage={clearActiveBooking}
        />
      )}

      {/* Manual ID fallback link */}
      <div className="mt-6 sm:mt-8 text-center">
        <button
          type="button"
          onClick={() => setShowManualSearch((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="tracking.secondary_button"
        >
          Looking up a different booking? Enter ID manually
        </button>
        <AnimatePresence>
          {showManualSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <ManualSearchForm
                manualId={manualId}
                setManualId={setManualId}
                onSubmit={handleManualSearch}
                loading={manualLoading}
                onBack={null}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────────

function PageHeader({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <div className="mb-6 sm:mb-8">
      <button
        type="button"
        onClick={() => navigate("home")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 sm:mb-4"
        data-ocid="tracking.link"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-1">
        Track Your Booking
      </h1>
      <p className="text-muted-foreground text-sm">
        Live status updates every 15 seconds.
      </p>
    </div>
  );
}

interface BookingDetailsProps {
  booking: Booking;
  provider: Provider | null;
  statusConfig: Record<
    string,
    {
      icon: React.ElementType;
      label: string;
      color: string;
      bg: string;
      borderColor: string;
      pulse: boolean;
      desc: string;
    }
  >;
  actionLoading: string | null;
  onMarkComplete: () => void;
  onCancel: () => void;
  onNavigate: (page: Page) => void;
  onClearStorage: () => void;
}

function BookingDetails({
  booking,
  provider,
  statusConfig,
  actionLoading,
  onMarkComplete,
  onCancel,
  onNavigate,
  onClearStorage,
}: BookingDetailsProps) {
  const cfg = statusConfig[booking.status] ?? {
    icon: Clock,
    label: booking.status,
    color: "text-gray-600",
    bg: "bg-gray-50",
    borderColor: "border-gray-200",
    pulse: false,
    desc: "",
  };
  const StatusIcon = cfg.icon;

  const isTerminal =
    booking.status === ("completed" as BookingStatus) ||
    booking.status === ("cancelled" as BookingStatus) ||
    booking.status === BookingStatus.declined;

  const canCancel =
    booking.status === BookingStatus.pending ||
    booking.status === BookingStatus.accepted ||
    booking.status === ("inProgress" as BookingStatus);

  const canComplete = booking.status === ("inProgress" as BookingStatus);

  // Distance / ETA from user to provider's current location
  let distanceKm: number | null = null;
  let eta: string | null = null;
  if (provider) {
    distanceKm = haversineDistance(
      booking.userLat,
      booking.userLng,
      provider.lat,
      provider.lng,
    );
    eta = estimatedTravelTime(distanceKm);
  }

  // Avatar colour derived from name
  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  const avatarColor = provider
    ? avatarColors[provider.name.charCodeAt(0) % avatarColors.length]
    : "bg-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3 sm:space-y-4"
      data-ocid="tracking.card"
    >
      {/* ── Status Banner ─────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border-2 ${cfg.bg} ${cfg.borderColor} p-4 sm:p-5 flex items-start gap-3 sm:gap-4`}
        data-ocid="tracking.panel"
      >
        <div className="relative shrink-0">
          <StatusIcon className={`w-6 h-6 sm:w-7 sm:h-7 ${cfg.color}`} />
          {cfg.pulse && (
            <span
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-current ${cfg.color} opacity-70 animate-ping`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base sm:text-lg ${cfg.color}`}>
            {cfg.label}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {cfg.desc}
          </p>
        </div>
        {/* Live chip */}
        {!isTerminal && (
          <div
            className="flex items-center gap-1.5 bg-white/80 rounded-full px-2 sm:px-2.5 py-1 shrink-0 border border-green-200"
            data-ocid="tracking.success_state"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
        )}
      </div>

      {/* ── Provider Card ─────────────────────────────────────────── */}
      {!isTerminal && (
        <div
          className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-card"
          data-ocid="tracking.section"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4">
            Your Provider
          </p>

          {!provider ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${avatarColor} text-white font-bold text-lg sm:text-xl flex items-center justify-center shrink-0`}
                >
                  {provider.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-base sm:text-lg text-foreground leading-tight">
                    {provider.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {serviceTypeIcon(provider.serviceType)}{" "}
                    {serviceTypeLabel(provider.serviceType)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <a
                      href={`tel:${(provider as any).phone}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {(provider as any).phone || "—"}
                    </a>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Base Fee</p>
                  <p className="font-bold text-foreground text-sm">
                    ₹{Number(provider.baseFeeINR)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      /visit
                    </span>
                  </p>
                </div>
              </div>

              {/* Distance / ETA tiles */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-secondary rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-bold text-foreground text-xs sm:text-sm">
                      {distanceKm !== null
                        ? `${distanceKm.toFixed(1)} km`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="bg-secondary rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                  <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">ETA</p>
                    <p className="font-bold text-foreground text-xs sm:text-sm">
                      {eta ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground truncate">
                  {provider.locationLabel}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Mark as Complete — only when inProgress */}
        {canComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              onClick={onMarkComplete}
              disabled={actionLoading !== null}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-base h-auto"
              data-ocid="tracking.confirm_button"
            >
              {actionLoading === "complete" ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              Mark as Complete
            </Button>
          </motion.div>
        )}

        {/* Cancel */}
        {canCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={actionLoading !== null}
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            data-ocid="tracking.delete_button"
          >
            {actionLoading === "cancel" ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <X className="w-4 h-4 mr-2" />
            )}
            Cancel Booking
          </Button>
        )}

        {/* Terminal states */}
        {booking.status === BookingStatus.declined && (
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onClearStorage();
              onNavigate("home");
            }}
            data-ocid="tracking.primary_button"
          >
            Find Another Provider
          </Button>
        )}
        {(booking.status === ("completed" as BookingStatus) ||
          booking.status === ("cancelled" as BookingStatus)) && (
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onClearStorage();
              onNavigate("home");
            }}
            data-ocid="tracking.primary_button"
          >
            Book Again
          </Button>
        )}
      </div>

      {/* ── Booking Details ──────────────────────────────────────────── */}
      <div
        className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-card"
        data-ocid="tracking.section"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4">
          Booking Details
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Booking ID</span>
            <span className="font-mono font-bold text-foreground text-sm">
              #{booking.id.toString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Submitted</span>
            <span className="text-xs sm:text-sm text-foreground">
              {formatDate(booking.createdAt)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your Name</span>
            <span className="text-sm font-medium text-foreground">
              {booking.userName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contact</span>
            <span className="text-sm font-medium text-foreground">
              {booking.userContact}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm text-muted-foreground shrink-0">
              Location
            </span>
            <span className="text-xs sm:text-sm text-foreground text-right break-all">
              {booking.userLocationLabel}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div>
            <p className="text-sm text-muted-foreground mb-1.5">Issue</p>
            <p className="text-sm text-foreground bg-secondary rounded-lg p-3">
              {booking.issueDescription}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ManualSearchForm({
  manualId,
  setManualId,
  onSubmit,
  loading,
  onBack,
}: {
  manualId: string;
  setManualId: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  onBack: (() => void) | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card"
      data-ocid="tracking.panel"
    >
      <p className="text-sm font-semibold text-foreground mb-3">
        Look up by Booking ID
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="manualBookingId" className="sr-only">
            Booking ID
          </Label>
          <Input
            id="manualBookingId"
            type="number"
            min="1"
            placeholder="e.g. 12345"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            data-ocid="tracking.input"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !manualId.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-ocid="tracking.submit_button"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            data-ocid="tracking.cancel_button"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-ocid="tracking.loading_state">
      <div>
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-10 w-64 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  );
}
