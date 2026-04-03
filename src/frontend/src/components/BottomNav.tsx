import { Home, LayoutDashboard, Navigation, Shield } from "lucide-react";
import type { Page } from "../App";
import { useEmailAuth } from "../hooks/useEmailAuth";

interface BottomNavProps {
  currentPage: Page;
  navigate: (page: Page) => void;
}

export default function BottomNav({ currentPage, navigate }: BottomNavProps) {
  const { isLoggedIn, isAdmin } = useEmailAuth();

  const items = [
    {
      label: "Home",
      icon: Home,
      page: "home" as Page,
      show: true,
    },
    {
      label: "Track",
      icon: Navigation,
      page: "track-booking" as Page,
      show: true,
    },
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      page: "provider-dashboard" as Page,
      show: isLoggedIn,
    },
    {
      label: isAdmin ? "Admin" : "Login",
      icon: Shield,
      page: isAdmin ? ("admin" as Page) : ("provider-dashboard" as Page),
      show: !isLoggedIn || isAdmin,
    },
  ];

  const visibleItems = items.filter((item) => item.show);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch">
        {visibleItems.map((item) => {
          const isActive = currentPage === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.page)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-ocid={`bottomnav.${item.label.toLowerCase()}.link`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
