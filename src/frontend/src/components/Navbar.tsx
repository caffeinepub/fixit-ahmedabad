import { Button } from "@/components/ui/button";
import type { Page } from "../App";
import { useEmailAuth } from "../hooks/useEmailAuth";

interface NavbarProps {
  currentPage: Page;
  navigate: (page: Page) => void;
}

export default function Navbar({ currentPage, navigate }: NavbarProps) {
  const { isLoggedIn, email, isAdmin, logout } = useEmailAuth();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Brand */}
          <button
            type="button"
            onClick={() => navigate("home")}
            className="flex items-center gap-2 group shrink-0"
            data-ocid="nav.home.link"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs sm:text-sm shrink-0">
              F
            </div>
            <span className="font-display font-bold text-foreground text-sm sm:text-lg leading-tight">
              <span className="hidden xs:inline">FixIt </span>
              <span className="text-primary">Ahmedabad</span>
            </span>
          </button>

          {/* Nav Links — desktop only */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigate("home")}
              data-ocid="nav.find_services.link"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                currentPage === "home"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Find Services
            </button>
            <button
              type="button"
              onClick={() => navigate("track-booking")}
              data-ocid="nav.track_booking.link"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                currentPage === "track-booking"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Track Booking
            </button>
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => navigate("provider-dashboard")}
                data-ocid="nav.dashboard.link"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  currentPage === "provider-dashboard"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                My Dashboard
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate("admin")}
                data-ocid="nav.admin.link"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  currentPage === "admin"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                Admin
              </button>
            )}
            {!isLoggedIn && (
              <button
                type="button"
                onClick={() => navigate("admin")}
                data-ocid="nav.admin.link"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  currentPage === "admin"
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
                  {email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="text-xs h-8 px-3"
                  data-ocid="nav.logout.button"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                {/* On mobile: show only one primary action */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("provider-dashboard")}
                  className="hidden sm:flex text-xs h-8 px-3"
                  data-ocid="nav.provider_login.button"
                >
                  Provider Login
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("provider-register")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3"
                  data-ocid="nav.register_provider.button"
                >
                  <span className="hidden sm:inline">Register as Pro</span>
                  <span className="sm:hidden">Register</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
