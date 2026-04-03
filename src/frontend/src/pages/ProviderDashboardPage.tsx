import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Play,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Page } from "../App";
import type { Booking, Provider } from "../backend";
import { BookingStatus, ProviderStatus } from "../backend";
import { useActor } from "../hooks/useActor";
import { useEmailAuth } from "../hooks/useEmailAuth";
import {
  AHMEDABAD_CENTER,
  formatDate,
  serviceTypeLabel,
} from "../utils/helpers";

interface ProviderDashboardPageProps {
  navigate: (page: Page) => void;
}

function LoginForm({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-16 pb-24">
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
          Provider Login
        </h2>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your profile and bookings
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card space-y-4"
        data-ocid="login.form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email Address</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            data-ocid="login.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            data-ocid="login.input"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          data-ocid="login.submit_button"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Don’t have an account?{" "}
        <button
          type="button"
          className="text-primary font-medium hover:underline"
          onClick={onRegister}
          data-ocid="login.secondary_button"
        >
          Register as a provider
        </button>
      </p>
    </div>
  );
}

export default function ProviderDashboardPage({
  navigate,
}: ProviderDashboardPageProps) {
  const { actor } = useActor();
  const { isLoggedIn, login } = useEmailAuth();

  const [profile, setProfile] = useState<Provider | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Live location tracking
  const [locationTrackingActive, setLocationTrackingActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLat, setEditLat] = useState(AHMEDABAD_CENTER.lat);
  const [editLng, setEditLng] = useState(AHMEDABAD_CENTER.lng);
  const [editLocationLabel, setEditLocationLabel] = useState("");
  const [editBaseFee, setEditBaseFee] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!actor || !isLoggedIn) return;
    setLoadingProfile(true);
    try {
      const p = await actor.getMyProfile();
      setProfile(p);
      setEditName(p.name);
      setEditPhone((p as any).phone ?? "");
      setEditLat(p.lat);
      setEditLng(p.lng);
      setEditLocationLabel(p.locationLabel);
      setEditBaseFee(Number(p.baseFeeINR).toString());
    } catch {
      // Not registered yet — that’s fine
    } finally {
      setLoadingProfile(false);
    }
  }, [actor, isLoggedIn]);

  const loadBookings = useCallback(async () => {
    if (!actor || !isLoggedIn) return;
    setLoadingBookings(true);
    try {
      const b = await actor.getMyBookingRequests();
      setBookings(b.sort((a, bk) => Number(bk.createdAt - a.createdAt)));
    } catch {
      // ignore
    } finally {
      setLoadingBookings(false);
    }
  }, [actor, isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && actor) {
      loadProfile();
      loadBookings();
    }
  }, [isLoggedIn, actor, loadProfile, loadBookings]);

  // Live location watchPosition — starts when logged in
  useEffect(() => {
    if (!isLoggedIn || !actor) return;

    if (!navigator.geolocation) {
      setLocationTrackingActive(false);
      return;
    }

    const THROTTLE_MS = 30_000;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastLocationUpdateRef.current < THROTTLE_MS) return;
        lastLocationUpdateRef.current = now;

        const lt = pos.coords.latitude;
        const ln = pos.coords.longitude;

        (actor as any).updateProviderLocation(lt, ln).catch(() => {
          // Silently fail — provider might not be registered yet
        });

        setLocationTrackingActive(true);
      },
      () => {
        setLocationTrackingActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
      setLocationTrackingActive(false);
    };
  }, [isLoggedIn, actor]);

  const handleToggleAvailability = useCallback(async () => {
    if (!actor) return;
    setTogglingAvailability(true);
    try {
      await actor.toggleAvailability();
      await loadProfile();
      toast.success("Availability updated");
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setTogglingAvailability(false);
    }
  }, [actor, loadProfile]);

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("GPS not supported");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditLat(pos.coords.latitude);
        setEditLng(pos.coords.longitude);
        setEditLocationLabel(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        );
        setGpsLoading(false);
        toast.success("Location detected");
      },
      () => {
        setGpsLoading(false);
        toast.error("Could not get location");
      },
    );
  }, []);

  const handleSaveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!actor) return;
      const fee = Number.parseInt(editBaseFee, 10);
      if (Number.isNaN(fee) || fee <= 0) {
        toast.error("Enter a valid fee");
        return;
      }
      setSaving(true);
      try {
        await actor.updateProviderProfile({
          name: editName.trim(),
          email: profile?.email ?? "",
          phone: editPhone.trim(),
          lat: editLat,
          lng: editLng,
          locationLabel: editLocationLabel.trim(),
          baseFeeINR: BigInt(fee),
        } as any);
        await loadProfile();
        setEditMode(false);
        toast.success("Profile updated");
      } catch (err: unknown) {
        toast.error(
          `Update failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSaving(false);
      }
    },
    [
      actor,
      editName,
      editPhone,
      editLat,
      editLng,
      editLocationLabel,
      editBaseFee,
      profile,
      loadProfile,
    ],
  );

  const handleRespondBooking = useCallback(
    async (bookingId: bigint, accept: boolean) => {
      if (!actor) return;
      try {
        await actor.respondToBooking(bookingId, accept);
        await loadBookings();
        toast.success(accept ? "Booking accepted!" : "Booking declined");
      } catch (err: unknown) {
        toast.error(
          `Failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [actor, loadBookings],
  );

  const handleMarkInProgress = useCallback(
    async (bookingId: bigint) => {
      if (!actor) return;
      try {
        await (actor as any).markBookingInProgress(bookingId);
        await loadBookings();
        toast.success("Booking marked as in progress!");
      } catch (err: unknown) {
        toast.error(
          `Failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [actor, loadBookings],
  );

  if (!isLoggedIn) {
    return (
      <LoginForm
        onLogin={login}
        onRegister={() => navigate("provider-register")}
      />
    );
  }

  if (loadingProfile) {
    return (
      <div
        className="max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center pb-24"
        data-ocid="dashboard.loading_state"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 sm:py-16 text-center pb-24">
        <div className="text-4xl sm:text-5xl mb-4">📝</div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3">
          No Profile Found
        </h2>
        <p className="text-muted-foreground mb-6 text-sm sm:text-base">
          You haven’t registered as a service provider yet.
        </p>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => navigate("provider-register")}
          data-ocid="dashboard.primary_button"
        >
          Register as Provider
        </Button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10 pb-24">
      <div className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
          Provider Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile and incoming booking requests
        </p>
      </div>

      {/* Status Banner */}
      {profile.status === ProviderStatus.pending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm sm:text-base">
              Awaiting Admin Approval
            </p>
            <p className="text-xs sm:text-sm text-yellow-700">
              Your license is being reviewed. You’ll be able to receive bookings
              once approved.
            </p>
          </div>
        </div>
      )}
      {profile.status === ProviderStatus.rejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm sm:text-base">
              Registration Rejected
            </p>
            {profile.rejectionNote && (
              <p className="text-xs sm:text-sm text-red-700">
                Reason: {profile.rejectionNote}
              </p>
            )}
            <p className="text-xs sm:text-sm text-red-700 mt-1">
              Please contact support or re-register with a valid license.
            </p>
          </div>
        </div>
      )}
      {profile.status === ProviderStatus.approved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm sm:text-base">
              Profile Approved
            </p>
            <p className="text-xs sm:text-sm text-green-700">
              You are live and visible to customers searching for{" "}
              {serviceTypeLabel(profile.serviceType)}s.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger
            value="profile"
            className="flex-1 sm:flex-none"
            data-ocid="dashboard.profile.tab"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="bookings"
            className="flex-1 sm:flex-none"
            data-ocid="dashboard.bookings.tab"
          >
            Bookings
            {bookings.filter((b) => b.status === BookingStatus.pending).length >
              0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                {
                  bookings.filter((b) => b.status === BookingStatus.pending)
                    .length
                }
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          {editMode ? (
            <form
              onSubmit={handleSaveProfile}
              className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card space-y-4 sm:space-y-5"
            >
              <h2 className="font-display font-bold text-lg sm:text-xl text-foreground">
                Edit Profile
              </h2>
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  data-ocid="dashboard.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  data-ocid="dashboard.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={editLocationLabel}
                      onChange={(e) => setEditLocationLabel(e.target.value)}
                      className="pl-9"
                      required
                      data-ocid="dashboard.input"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGps}
                    disabled={gpsLoading}
                    data-ocid="dashboard.upload_button"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Base Fee (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="1"
                    value={editBaseFee}
                    onChange={(e) => setEditBaseFee(e.target.value)}
                    className="pl-7"
                    required
                    data-ocid="dashboard.input"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditMode(false)}
                  data-ocid="dashboard.cancel_button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-primary-foreground"
                  data-ocid="dashboard.save_button"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card">
              <div className="flex items-start justify-between mb-5 sm:mb-6 gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl sm:text-2xl shrink-0">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-base sm:text-xl font-bold text-foreground truncate">
                      {profile.name}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {serviceTypeLabel(profile.serviceType)}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${statusColors[profile.status]}`}
                    >
                      {profile.status.charAt(0).toUpperCase() +
                        profile.status.slice(1)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="shrink-0"
                  data-ocid="dashboard.edit_button"
                >
                  Edit Profile
                </Button>
              </div>

              {/* Live location tracking chip */}
              <div className="mb-4">
                {locationTrackingActive ? (
                  <div
                    className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs font-medium text-green-800"
                    data-ocid="dashboard.location.success_state"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Live location active
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-600"
                    data-ocid="dashboard.location.error_state"
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    Location tracking off
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-6">
                <div className="bg-secondary rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    License Number
                  </p>
                  <p className="font-medium text-foreground text-sm">
                    {profile.licenseNumber}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground mb-1">Base Fee</p>
                  <p className="font-medium text-foreground text-sm">
                    ₹{Number(profile.baseFeeINR)} per visit
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground mb-1">Location</p>
                  <p className="font-medium text-foreground text-sm break-all">
                    {profile.locationLabel}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Service Type
                  </p>
                  <p className="font-medium text-foreground text-sm">
                    {serviceTypeLabel(profile.serviceType)}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3 sm:p-4 flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Phone Number
                    </p>
                    <p className="font-medium text-foreground text-sm">
                      {(profile as any).phone || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Availability Toggle */}
              <div className="flex items-center justify-between p-3 sm:p-4 border border-border rounded-lg gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">
                    Availability
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {profile.isAvailable
                      ? "Visible to customers"
                      : "Hidden from results"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <Badge
                    className={`hidden sm:flex ${
                      profile.isAvailable
                        ? "bg-green-100 text-green-800 border-green-200"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                    variant="outline"
                  >
                    {profile.isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                  <Switch
                    checked={profile.isAvailable}
                    onCheckedChange={handleToggleAvailability}
                    disabled={
                      togglingAvailability ||
                      profile.status !== ProviderStatus.approved
                    }
                    data-ocid="dashboard.switch"
                  />
                </div>
              </div>
              {profile.status !== ProviderStatus.approved && (
                <p className="text-xs text-muted-foreground mt-2">
                  Availability can only be toggled after your profile is
                  approved.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              Booking Requests
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBookings}
              disabled={loadingBookings}
              data-ocid="dashboard.secondary_button"
            >
              {loadingBookings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {loadingBookings ? (
            <div
              className="text-center py-10"
              data-ocid="dashboard.loading_state"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : bookings.length === 0 ? (
            <div
              className="bg-card rounded-xl border border-border p-8 sm:p-10 text-center text-muted-foreground"
              data-ocid="dashboard.empty_state"
            >
              <div className="text-3xl sm:text-4xl mb-3">📬</div>
              <p className="font-medium">No booking requests yet</p>
              <p className="text-sm mt-1">
                Requests from customers will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {bookings.map((booking, idx) => (
                <BookingCard
                  key={booking.id.toString()}
                  booking={booking}
                  onRespond={handleRespondBooking}
                  onMarkInProgress={handleMarkInProgress}
                  index={idx + 1}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface BookingCardProps {
  booking: Booking;
  onRespond: (id: bigint, accept: boolean) => void;
  onMarkInProgress: (id: bigint) => void;
  index: number;
}

function BookingCard({
  booking,
  onRespond,
  onMarkInProgress,
  index,
}: BookingCardProps) {
  const [responding, setResponding] = useState(false);
  const [markingInProgress, setMarkingInProgress] = useState(false);

  const handleRespond = async (accept: boolean) => {
    setResponding(true);
    await onRespond(booking.id, accept);
    setResponding(false);
  };

  const handleMarkInProgress = async () => {
    setMarkingInProgress(true);
    await onMarkInProgress(booking.id);
    setMarkingInProgress(false);
  };

  const statusStyle: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    accepted: "bg-green-100 text-green-800 border-green-200",
    declined: "bg-red-100 text-red-800 border-red-200",
    inProgress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const statusLabel: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    inProgress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const isActionable =
    booking.status !== ("inProgress" as any) &&
    booking.status !== ("completed" as any) &&
    booking.status !== ("cancelled" as any);

  return (
    <div
      className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card"
      data-ocid={`dashboard.booking.item.${index}`}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-foreground text-sm sm:text-base">
              {booking.userName}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                statusStyle[booking.status] ?? statusStyle.pending
              }`}
            >
              {statusLabel[booking.status] ?? booking.status}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Booking #{booking.id.toString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(booking.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Contact</p>
          <p className="text-sm font-medium text-foreground">
            {booking.userContact}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Location</p>
          <p className="text-sm font-medium text-foreground break-all">
            {booking.userLocationLabel}
          </p>
        </div>
      </div>

      <div className="bg-secondary rounded-lg p-3 mb-3 sm:mb-4">
        <p className="text-xs text-muted-foreground mb-1">Issue Description</p>
        <p className="text-sm text-foreground">{booking.issueDescription}</p>
      </div>

      {/* Accept / Decline — only for pending */}
      {booking.status === BookingStatus.pending && isActionable && (
        <div className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="flex-1 border-red-200 text-red-700 hover:bg-red-50 text-sm"
            onClick={() => handleRespond(false)}
            disabled={responding}
            data-ocid={`dashboard.booking.delete_button.${index}`}
          >
            {responding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-1" />
            )}
            Decline
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
            onClick={() => handleRespond(true)}
            disabled={responding}
            data-ocid={`dashboard.booking.confirm_button.${index}`}
          >
            {responding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1" />
            )}
            Accept
          </Button>
        </div>
      )}

      {/* Mark as In Progress — only for accepted */}
      {booking.status === BookingStatus.accepted &&
        !(["inProgress", "completed", "cancelled"] as string[]).includes(
          booking.status,
        ) && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
            onClick={handleMarkInProgress}
            disabled={markingInProgress}
            data-ocid={`dashboard.booking.primary_button.${index}`}
          >
            {markingInProgress ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Mark as In Progress
          </Button>
        )}
    </div>
  );
}
