import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Page } from "../App";
import type { Provider } from "../backend";
import { useActor } from "../hooks/useActor";
import { useEmailAuth } from "../hooks/useEmailAuth";
import { serviceTypeLabel } from "../utils/helpers";

interface AdminPanelPageProps {
  navigate: (page: Page) => void;
}

function AdminLoginForm({
  onLogin,
}: { onLogin: (email: string, password: string) => Promise<void> }) {
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
          Admin Login
        </h2>
        <p className="text-muted-foreground text-sm">
          Sign in to access the admin panel
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-card space-y-4"
        data-ocid="admin_login.form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Email Address</Label>
          <Input
            id="admin-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            data-ocid="admin_login.input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            data-ocid="admin_login.input"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          data-ocid="admin_login.submit_button"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}

export default function AdminPanelPage({
  navigate: _navigate,
}: AdminPanelPageProps) {
  const { actor } = useActor();
  const { isLoggedIn, isAdmin, login } = useEmailAuth();

  const [pendingProviders, setPendingProviders] = useState<Provider[]>([]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  const [rejectProvider, setRejectProvider] = useState<Provider | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPendingProviders = useCallback(async () => {
    if (!actor) return;
    setLoadingPending(true);
    try {
      const p = await actor.getPendingProviders();
      setPendingProviders(p);
    } catch {
      toast.error("Failed to load pending providers");
    } finally {
      setLoadingPending(false);
    }
  }, [actor]);

  const loadAllProviders = useCallback(async () => {
    if (!actor) return;
    setLoadingAll(true);
    try {
      const all = await actor.getAllProviders();
      setAllProviders(all);
    } catch {
      toast.error("Failed to load providers");
    } finally {
      setLoadingAll(false);
    }
  }, [actor]);

  useEffect(() => {
    if (isLoggedIn && isAdmin && actor) {
      Promise.all([loadPendingProviders(), loadAllProviders()]);
    }
  }, [isLoggedIn, isAdmin, actor, loadPendingProviders, loadAllProviders]);

  const handleApprove = useCallback(
    async (provider: Provider) => {
      if (!actor) return;
      const id = provider.principal.toString();
      setApprovingId(id);
      try {
        await actor.approveProvider(provider.principal);
        toast.success(`${provider.name} approved!`);
        await Promise.all([loadPendingProviders(), loadAllProviders()]);
      } catch (err: unknown) {
        toast.error(
          `Approval failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setApprovingId(null);
      }
    },
    [actor, loadPendingProviders, loadAllProviders],
  );

  const handleRejectSubmit = useCallback(async () => {
    if (!actor || !rejectProvider) return;
    setRejecting(true);
    try {
      await actor.rejectProvider(
        rejectProvider.principal,
        rejectNote.trim() || "License could not be verified",
      );
      toast.success(`${rejectProvider.name} rejected`);
      setRejectProvider(null);
      setRejectNote("");
      await Promise.all([loadPendingProviders(), loadAllProviders()]);
    } catch (err: unknown) {
      toast.error(
        `Rejection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setRejecting(false);
    }
  }, [
    actor,
    rejectProvider,
    rejectNote,
    loadPendingProviders,
    loadAllProviders,
  ]);

  if (!isLoggedIn) {
    return <AdminLoginForm onLogin={login} />;
  }

  // Frontend admin check (email-based)
  if (!isAdmin) {
    return (
      <div
        className="max-w-lg mx-auto px-4 py-12 sm:py-16 text-center pb-24"
        data-ocid="admin.error_state"
      >
        <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-destructive mx-auto mb-4" />
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-3">
          Access Denied
        </h2>
        <p className="text-muted-foreground text-sm">
          You do not have admin privileges. This panel is restricted to
          administrators only.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-10 pb-24">
      <div className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
          Admin Panel
        </h1>
        <p className="text-muted-foreground text-sm">
          Review provider registrations and manage the platform
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger
            value="pending"
            className="flex-1 sm:flex-none"
            data-ocid="admin.pending.tab"
          >
            Pending Approvals
            {pendingProviders.length > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                {pendingProviders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="flex-1 sm:flex-none"
            data-ocid="admin.all.tab"
          >
            All Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              Pending License Reviews
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPendingProviders}
              disabled={loadingPending}
              data-ocid="admin.pending.secondary_button"
            >
              {loadingPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {loadingPending ? (
            <div
              className="text-center py-10"
              data-ocid="admin.pending.loading_state"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : pendingProviders.length === 0 ? (
            <div
              className="bg-card rounded-xl border border-border p-8 sm:p-10 text-center text-muted-foreground"
              data-ocid="admin.pending.empty_state"
            >
              <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10 text-green-500 mx-auto mb-3" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm mt-1">
                No pending registrations to review.
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {pendingProviders.map((provider, idx) => (
                <ProviderReviewCard
                  key={provider.principal.toString()}
                  provider={provider}
                  onApprove={() => handleApprove(provider)}
                  onReject={() => {
                    setRejectProvider(provider);
                    setRejectNote("");
                  }}
                  approving={approvingId === provider.principal.toString()}
                  index={idx + 1}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              All Providers ({allProviders.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllProviders}
              disabled={loadingAll}
              data-ocid="admin.all.secondary_button"
            >
              {loadingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>

          {loadingAll ? (
            <div
              className="text-center py-10"
              data-ocid="admin.all.loading_state"
            >
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : allProviders.length === 0 ? (
            <div
              className="bg-card rounded-xl border border-border p-8 sm:p-10 text-center text-muted-foreground"
              data-ocid="admin.all.empty_state"
            >
              <p>No providers registered yet.</p>
            </div>
          ) : (
            <div data-ocid="admin.all.table">
              {/* Desktop table */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Service
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        License
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Location
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Fee
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">
                        Available
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {allProviders.map((p, idx) => (
                      <tr
                        key={p.principal.toString()}
                        className="hover:bg-secondary/50"
                        data-ocid={`admin.all.row.item.${idx + 1}`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {serviceTypeLabel(p.serviceType)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {p.licenseNumber}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.locationLabel}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          ₹{Number(p.baseFeeINR)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[p.status]}`}
                          >
                            {p.status.charAt(0).toUpperCase() +
                              p.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              p.isAvailable
                                ? "text-green-700 border-green-200"
                                : "text-gray-500 border-gray-200"
                            }
                          >
                            {p.isAvailable ? "Yes" : "No"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {allProviders.map((p, idx) => (
                  <div
                    key={p.principal.toString()}
                    className="bg-card rounded-xl border border-border p-4 shadow-sm"
                    data-ocid={`admin.all.row.item.${idx + 1}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {serviceTypeLabel(p.serviceType)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[p.status]}`}
                        >
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            p.isAvailable
                              ? "text-green-700 border-green-200"
                              : "text-gray-500 border-gray-200"
                          }`}
                        >
                          {p.isAvailable ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">License</p>
                        <p className="font-mono text-foreground break-all">
                          {p.licenseNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Base Fee</p>
                        <p className="font-medium text-foreground">
                          ₹{Number(p.baseFeeINR)}/visit
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Location</p>
                        <p className="text-foreground break-all">
                          {p.locationLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!rejectProvider}
        onOpenChange={(open) => {
          if (!open) {
            setRejectProvider(null);
            setRejectNote("");
          }
        }}
      >
        <DialogContent
          className="mx-3 sm:mx-auto"
          data-ocid="admin.reject.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Reject Provider</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              You are rejecting <strong>{rejectProvider?.name}</strong> (
              {serviceTypeLabel(rejectProvider?.serviceType ?? "")}). License:{" "}
              <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                {rejectProvider?.licenseNumber}
              </code>
            </p>
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="e.g. License not found in Gujarat licensing board database"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                data-ocid="admin.reject.textarea"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectProvider(null);
                setRejectNote("");
              }}
              data-ocid="admin.reject.cancel_button"
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRejectSubmit}
              disabled={rejecting}
              data-ocid="admin.reject.confirm_button"
            >
              {rejecting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reject Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ProviderReviewCardProps {
  provider: Provider;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  index: number;
}

function ProviderReviewCard({
  provider,
  onApprove,
  onReject,
  approving,
  index,
}: ProviderReviewCardProps) {
  return (
    <div
      className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-card"
      data-ocid={`admin.pending.item.${index}`}
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            {provider.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
              {provider.name}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {serviceTypeLabel(provider.serviceType)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-1 text-xs font-medium shrink-0">
          <Clock className="w-3 h-3" /> Pending
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3">
          <p className="text-xs text-muted-foreground mb-1">License Number</p>
          <p className="font-mono text-xs sm:text-sm font-medium text-foreground break-all">
            {provider.licenseNumber}
          </p>
        </div>
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3">
          <p className="text-xs text-muted-foreground mb-1">Location</p>
          <p className="text-xs sm:text-sm font-medium text-foreground break-all">
            {provider.locationLabel}
          </p>
        </div>
        <div className="bg-secondary rounded-lg p-2.5 sm:p-3">
          <p className="text-xs text-muted-foreground mb-1">Base Fee</p>
          <p className="text-xs sm:text-sm font-medium text-foreground">
            ₹{Number(provider.baseFeeINR)}/visit
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
        <p className="text-xs text-blue-700 font-medium mb-1">
          📝 Admin Action Required
        </p>
        <p className="text-xs text-blue-600">
          Please verify license <strong>{provider.licenseNumber}</strong> on the{" "}
          <a
            href="https://www.gpcb.gujarat.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-800"
          >
            Gujarat licensing board website
          </a>{" "}
          before approving.
        </p>
      </div>

      <div className="flex gap-2 sm:gap-3">
        <Button
          variant="outline"
          className="flex-1 border-red-200 text-red-700 hover:bg-red-50 text-sm"
          onClick={onReject}
          disabled={approving}
          data-ocid={`admin.pending.delete_button.${index}`}
        >
          <XCircle className="w-4 h-4 mr-1" /> Reject
        </Button>
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
          onClick={onApprove}
          disabled={approving}
          data-ocid={`admin.pending.confirm_button.${index}`}
        >
          {approving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-1" />
          )}
          Approve
        </Button>
      </div>
    </div>
  );
}
