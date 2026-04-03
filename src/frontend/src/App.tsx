import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import BottomNav from "./components/BottomNav";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./hooks/useEmailAuth";
import AdminPanelPage from "./pages/AdminPanelPage";
import HomePage from "./pages/HomePage";
import LocationRequiredPage from "./pages/LocationRequiredPage";
import ProviderDashboardPage from "./pages/ProviderDashboardPage";
import ProviderRegisterPage from "./pages/ProviderRegisterPage";
import TrackBookingPage from "./pages/TrackBookingPage";

export type Page =
  | "home"
  | "provider-register"
  | "provider-dashboard"
  | "admin"
  | "track-booking"
  | "login"
  | "location-required";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [pendingGpsRetry, setPendingGpsRetry] = useState(false);

  const navigate = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  // Called from LocationRequiredPage's "Try Again" button.
  // We navigate to home first; home auto-requests GPS on mount.
  // The pendingGpsRetry flag tells HomePage to re-request GPS even if
  // it already attempted once (hasFetched guard bypass).
  const handleLocationRetry = () => {
    setPendingGpsRetry(true);
    navigate("home");
  };

  const clearPendingRetry = () => setPendingGpsRetry(false);

  const isLocationPage = page === "location-required";

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        {!isLocationPage && <Navbar currentPage={page} navigate={navigate} />}
        <main className={!isLocationPage ? "pb-16 md:pb-0" : ""}>
          {page === "home" && (
            <HomePage
              navigate={navigate}
              pendingGpsRetry={pendingGpsRetry}
              onGpsRetryConsumed={clearPendingRetry}
            />
          )}
          {page === "provider-register" && (
            <ProviderRegisterPage navigate={navigate} />
          )}
          {page === "provider-dashboard" && (
            <ProviderDashboardPage navigate={navigate} />
          )}
          {page === "admin" && <AdminPanelPage navigate={navigate} />}
          {page === "track-booking" && <TrackBookingPage navigate={navigate} />}
          {page === "login" && <ProviderDashboardPage navigate={navigate} />}
          {page === "location-required" && (
            <LocationRequiredPage
              navigate={navigate}
              onRetry={handleLocationRetry}
            />
          )}
        </main>
        {!isLocationPage && (
          <BottomNav currentPage={page} navigate={navigate} />
        )}
        <Toaster richColors position="top-right" />
      </div>
    </AuthProvider>
  );
}
