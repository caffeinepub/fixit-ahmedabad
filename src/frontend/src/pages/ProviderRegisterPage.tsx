import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Copy, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Page } from "../App";
import { ServiceType } from "../backend";
import { createActorWithConfig } from "../config";
import { useEmailAuth } from "../hooks/useEmailAuth";

type GpsStatus = "idle" | "requesting" | "granted" | "denied";

interface ProviderRegisterPageProps {
  navigate: (page: Page) => void;
}

export default function ProviderRegisterPage({
  navigate,
}: ProviderRegisterPageProps) {
  const { deriveIdentity, loginAfterRegister } = useEmailAuth();

  // GPS state — mandatory
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");

  // Account fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Provider fields
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [baseFeeINR, setBaseFeeINR] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("GPS not supported in your browser");
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lt = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(lt);
        setLng(ln);
        setLocationLabel(`${lt.toFixed(4)}, ${ln.toFixed(4)}`);
        setGpsStatus("granted");
      },
      () => {
        setGpsStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  // Auto-request GPS on mount
  useEffect(() => {
    requestGps();
  }, [requestGps]);

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (gpsStatus !== "granted" || lat === null || lng === null) {
        toast.error("Location access is required to register");
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        toast.error("Please enter a valid email address");
        return;
      }

      // Validate phone
      if (!phone.trim()) {
        toast.error("Please enter a phone number");
        return;
      }

      // Validate password
      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }

      // Validate provider fields
      if (
        !name.trim() ||
        !serviceType ||
        !licenseNumber.trim() ||
        !baseFeeINR
      ) {
        toast.error("Please fill in all fields");
        return;
      }
      const fee = Number.parseInt(baseFeeINR, 10);
      if (Number.isNaN(fee) || fee <= 0) {
        toast.error("Enter a valid base fee");
        return;
      }

      setLoading(true);
      try {
        const { identity, seedHex } = await deriveIdentity(
          email.trim(),
          password,
        );
        const actor = await createActorWithConfig({
          agentOptions: { identity },
        });

        await actor.registerProvider({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          serviceType: serviceType as ServiceType,
          licenseNumber: licenseNumber.trim(),
          lat,
          lng,
          locationLabel: locationLabel.trim(),
          baseFeeINR: BigInt(fee),
        } as any);

        loginAfterRegister(email.trim(), identity, seedHex);
        setSuccess(true);
        toast.success("Registration submitted!");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("already registered")) {
          toast.error(
            "An account with this email already exists. Please login instead.",
          );
        } else {
          toast.error(`Registration failed: ${msg}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      gpsStatus,
      lat,
      lng,
      email,
      phone,
      password,
      confirmPassword,
      name,
      serviceType,
      licenseNumber,
      locationLabel,
      baseFeeINR,
      deriveIdentity,
      loginAfterRegister,
    ],
  );

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-16 text-center pb-24">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl sm:text-3xl">✅</span>
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3">
          Registration Submitted!
        </h2>
        <p className="text-muted-foreground mb-6 text-sm sm:text-base">
          Your profile is under review. An admin will verify your license and
          approve your account shortly. You'll be able to start receiving
          bookings once approved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("home")}>
            Back to Home
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => navigate("provider-dashboard")}
            data-ocid="register.go_dashboard.button"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // GPS requesting state — show full-width card instead of form
  if (gpsStatus === "idle" || gpsStatus === "requesting") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Register as a Service Provider
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Join FixIt Ahmedabad and start receiving booking requests. Your
            license will be reviewed by our admin team.
          </p>
        </div>
        <div
          className="bg-blue-50 border border-blue-200 rounded-xl p-6 sm:p-8 text-center"
          data-ocid="register.loading_state"
        >
          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-spin mx-auto mb-4" />
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-2">
            Detecting your location...
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
            Please allow location access when prompted by your browser. Location
            is required to register as a provider.
          </p>
        </div>
      </div>
    );
  }

  // GPS denied state — blocking error card, no form
  if (gpsStatus === "denied") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Register as a Service Provider
          </h1>
        </div>
        <div
          className="bg-red-50 border border-red-300 rounded-xl p-6 sm:p-8 text-center"
          data-ocid="register.error_state"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-red-800 mb-3">
            Location Access Required
          </h2>
          <p className="text-red-700 text-xs sm:text-sm max-w-sm mx-auto mb-6">
            You must allow location access to register as a provider. This is
            required so customers can see your real-time location. Please enable
            location in your browser settings and try again.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button
              onClick={requestGps}
              className="bg-red-600 hover:bg-red-700 text-white w-full max-w-xs"
              data-ocid="register.retry.button"
            >
              <MapPin className="w-4 h-4 mr-2" /> Retry Location Access
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="w-full max-w-xs bg-white hover:bg-gray-50 border-red-200 text-red-700 hover:text-red-800"
              data-ocid="register.copy.button"
            >
              <Copy className="w-4 h-4 mr-2" /> Copy Location Settings Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // GPS granted — render full registration form
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Register as a Service Provider
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Join FixIt Ahmedabad and start receiving booking requests. Your
          license will be reviewed by our admin team.
        </p>
      </div>

      {/* GPS detected confirmation banner */}
      <div
        className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 flex items-center gap-3"
        data-ocid="register.success_state"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        <p className="text-sm text-green-800 font-medium min-w-0">
          📍 Location detected:{" "}
          <span className="font-mono text-xs break-all">{locationLabel}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card space-y-4 sm:space-y-5"
        data-ocid="register.form"
      >
        {/* Account Credentials Section */}
        <div>
          <h2 className="font-display font-semibold text-sm sm:text-base text-foreground mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
              1
            </span>
            Account Credentials
          </h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                data-ocid="register.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
                data-ocid="register.input"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  data-ocid="register.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  data-ocid="register.input"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 sm:pt-5">
          <h2 className="font-display font-semibold text-sm sm:text-base text-foreground mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">
              2
            </span>
            Provider Details
          </h2>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Rajesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-ocid="register.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="service">Service Type *</Label>
                <select
                  id="service"
                  value={serviceType}
                  onChange={(e) =>
                    setServiceType(e.target.value as ServiceType | "")
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  data-ocid="register.select"
                >
                  <option value="">Select service</option>
                  <option value={ServiceType.plumber}>Plumber</option>
                  <option value={ServiceType.electrician}>Electrician</option>
                  <option value={ServiceType.mechanic}>Mechanic</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="license">License Number *</Label>
              <Input
                id="license"
                placeholder="e.g. GUJ-PLB-2024-12345"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
                data-ocid="register.input"
              />
              <p className="text-xs text-muted-foreground">
                Enter your license number issued by the Gujarat state licensing
                board. Our admin team will verify it before approving your
                profile.
              </p>
            </div>

            {/* Read-only GPS location display */}
            <div className="space-y-1.5">
              <Label>Your Detected Location *</Label>
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2.5 border border-border min-w-0">
                <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-foreground font-mono break-all min-w-0 flex-1">
                  {locationLabel}
                </span>
                <span className="ml-auto text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                  GPS Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your real-time location is automatically detected and shared
                with customers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fee">Base Fee per Visit (₹) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="fee"
                  type="number"
                  min="1"
                  placeholder="e.g. 300"
                  value={baseFeeINR}
                  onChange={(e) => setBaseFeeINR(e.target.value)}
                  className="pl-7"
                  required
                  data-ocid="register.input"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum charge per visit. Final billing is between you and the
                customer.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading || gpsStatus !== "granted"}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          data-ocid="register.submit_button"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Submitting..." : "Create Account & Register"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            className="text-primary hover:underline font-medium"
            onClick={() => navigate("provider-dashboard")}
            data-ocid="register.secondary_button"
          >
            Login here
          </button>
        </p>
      </form>
    </div>
  );
}
