
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Order "mo:core/Order";


actor {
  type ServiceType = {
    #plumber;
    #electrician;
    #mechanic;
  };

  type ProviderStatus = {
    #pending;
    #approved;
    #rejected;
  };

  // V1 booking status — only the original 3 variants (kept for stable upgrade compatibility)
  type BookingStatusV1 = {
    #pending;
    #accepted;
    #declined;
  };

  // V2 booking status — includes new variants
  type BookingStatus = {
    #pending;
    #accepted;
    #declined;
    #inProgress;
    #completed;
    #cancelled;
  };

  // V1: old provider schema without phone (kept for upgrade compatibility — do not remove)
  type ProviderV1 = {
    principal : Principal;
    name : Text;
    email : Text;
    serviceType : ServiceType;
    licenseNumber : Text;
    lat : Float;
    lng : Float;
    locationLabel : Text;
    baseFeeINR : Nat;
    isAvailable : Bool;
    status : ProviderStatus;
    rejectionNote : ?Text;
    registeredAt : Time.Time;
  };

  // V2: current provider schema with phone
  type Provider = {
    principal : Principal;
    name : Text;
    email : Text;
    phone : Text;
    serviceType : ServiceType;
    licenseNumber : Text;
    lat : Float;
    lng : Float;
    locationLabel : Text;
    baseFeeINR : Nat;
    isAvailable : Bool;
    status : ProviderStatus;
    rejectionNote : ?Text;
    registeredAt : Time.Time;
  };

  // V1 booking — uses old 3-variant status (kept for stable upgrade compatibility, do NOT write to)
  type BookingV1 = {
    id : Nat;
    providerPrincipal : Principal;
    userContact : Text;
    issueDescription : Text;
    userName : Text;
    userLat : Float;
    userLng : Float;
    userLocationLabel : Text;
    status : BookingStatusV1;
    createdAt : Time.Time;
  };

  // V2 booking — uses full 6-variant status
  type Booking = {
    id : Nat;
    providerPrincipal : Principal;
    userContact : Text;
    issueDescription : Text;
    userName : Text;
    userLat : Float;
    userLng : Float;
    userLocationLabel : Text;
    status : BookingStatus;
    createdAt : Time.Time;
  };

  public type UserProfile = {
    name : Text;
  };

  module ProviderOrd {
    public func compare(p1 : Provider, p2 : Provider) : Order.Order {
      Principal.compare(p1.principal, p2.principal);
    };
  };

  module BookingOrd {
    public func compare(b1 : Booking, b2 : Booking) : Order.Order {
      Nat.compare(b1.id, b2.id);
    };
  };

  public type RegisterProviderRequest = {
    name : Text;
    email : Text;
    phone : Text;
    serviceType : ServiceType;
    licenseNumber : Text;
    lat : Float;
    lng : Float;
    locationLabel : Text;
    baseFeeINR : Nat;
  };

  public type UpdateProviderProfileRequest = {
    name : Text;
    email : Text;
    phone : Text;
    lat : Float;
    lng : Float;
    locationLabel : Text;
    baseFeeINR : Nat;
  };

  // ---- Provider stores ----

  // Legacy stable store (V1 schema — no phone). Do NOT write to after migration.
  let providers : Map.Map<Principal, ProviderV1> = Map.empty<Principal, ProviderV1>();

  // Current stable store (V2 schema with phone)
  let providers_v2 : Map.Map<Principal, Provider> = Map.empty<Principal, Provider>();

  stable var providers_v2_migrated = false;

  func ensureProvidersMigrated() {
    if (not providers_v2_migrated) {
      for ((k, v) in providers.entries()) {
        if (not providers_v2.containsKey(k)) {
          providers_v2.add(k, {
            principal = v.principal;
            name = v.name;
            email = v.email;
            phone = "";
            serviceType = v.serviceType;
            licenseNumber = v.licenseNumber;
            lat = v.lat;
            lng = v.lng;
            locationLabel = v.locationLabel;
            baseFeeINR = v.baseFeeINR;
            isAvailable = v.isAvailable;
            status = v.status;
            rejectionNote = v.rejectionNote;
            registeredAt = v.registeredAt;
          });
        };
      };
      providers_v2_migrated := true;
    };
  };

  // ---- Booking stores ----

  // Legacy stable store (V1 booking with 3-variant status). Do NOT write to after migration.
  let bookings : Map.Map<Nat, BookingV1> = Map.empty<Nat, BookingV1>();

  // Current stable store (V2 booking with 6-variant status)
  let bookings_v2 : Map.Map<Nat, Booking> = Map.empty<Nat, Booking>();

  stable var bookings_v2_migrated = false;

  // Called only from update functions to lazily copy V1 bookings into V2
  func ensureBookingsMigrated() {
    if (not bookings_v2_migrated) {
      for ((k, v) in bookings.entries()) {
        if (not bookings_v2.containsKey(k)) {
          bookings_v2.add(k, upgradeBookingV1(v));
        };
      };
      bookings_v2_migrated := true;
    };
  };

  // Pure conversion: V1 booking → V2 booking (no state mutation, safe to use in queries)
  func upgradeBookingV1(v : BookingV1) : Booking {
    let s : BookingStatus = switch (v.status) {
      case (#pending)  { #pending  };
      case (#accepted) { #accepted };
      case (#declined) { #declined };
    };
    {
      id = v.id;
      providerPrincipal = v.providerPrincipal;
      userContact = v.userContact;
      issueDescription = v.issueDescription;
      userName = v.userName;
      userLat = v.userLat;
      userLng = v.userLng;
      userLocationLabel = v.userLocationLabel;
      status = s;
      createdAt = v.createdAt;
    };
  };

  // Read-only lookup: checks V2 first, then falls back to V1 (safe for queries)
  func lookupBooking(id : Nat) : ?Booking {
    switch (bookings_v2.get(id)) {
      case (?b) { ?b };
      case (null) {
        switch (bookings.get(id)) {
          case (?v1) { ?upgradeBookingV1(v1) };
          case (null) { null };
        };
      };
    };
  };

  // Merged view of all bookings: V2 entries + any V1 entries not yet in V2 (read-only)
  func allBookings() : [Booking] {
    let v2arr = bookings_v2.values().toArray();
    let v1extra = bookings.entries().toArray()
      .filter(func((k, _) : (Nat, BookingV1)) : Bool {
        not bookings_v2.containsKey(k)
      })
      .map(func((_, v) : (Nat, BookingV1)) : Booking {
        upgradeBookingV1(v)
      });
    v2arr.concat(v1extra);
  };

  var nextBookingId = 1;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let userProfiles = Map.empty<Principal, UserProfile>();

  // ---- User Profile Functions ----

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // ---- Provider Functions ----

  public shared ({ caller }) func registerProvider(request : RegisterProviderRequest) : async () {
    ensureProvidersMigrated();
    if (providers_v2.containsKey(caller)) {
      Runtime.trap("Provider already registered. Use updateProviderProfile instead.");
    };
    providers_v2.add(caller, {
      principal = caller;
      name = request.name;
      email = request.email;
      phone = request.phone;
      serviceType = request.serviceType;
      licenseNumber = request.licenseNumber;
      lat = request.lat;
      lng = request.lng;
      locationLabel = request.locationLabel;
      baseFeeINR = request.baseFeeINR;
      isAvailable = false;
      status = #pending;
      rejectionNote = null;
      registeredAt = Time.now();
    });
  };

  public shared ({ caller }) func updateProviderProfile(request : UpdateProviderProfileRequest) : async () {
    ensureProvidersMigrated();
    let provider = getExistingProvider(caller);
    providers_v2.add(caller, {
      provider with
      name = request.name;
      email = request.email;
      phone = request.phone;
      lat = request.lat;
      lng = request.lng;
      locationLabel = request.locationLabel;
      baseFeeINR = request.baseFeeINR;
    });
  };

  public shared ({ caller }) func updateProviderLocation(lat : Float, lng : Float) : async () {
    ensureProvidersMigrated();
    let provider = getExistingProvider(caller);
    providers_v2.add(caller, { provider with lat = lat; lng = lng });
  };

  public query ({ caller }) func getProvidersByEmail(email : Text) : async [Provider] {
    providers_v2.values().toArray()
      .filter(func(p) { p.email.trim(#text " ") == email.trim(#text " ") });
  };

  public shared ({ caller }) func toggleAvailability() : async () {
    ensureProvidersMigrated();
    let provider = getExistingProvider(caller);
    if (provider.status != #approved) {
      Runtime.trap("Only approved providers can change availability");
    };
    providers_v2.add(caller, { provider with isAvailable = not provider.isAvailable });
  };

  public query ({ caller }) func getMyProfile() : async Provider {
    getExistingProvider(caller);
  };

  public query ({ caller }) func getApprovedProvidersByServiceType(serviceType : ServiceType) : async [Provider] {
    providers_v2.values().toArray()
      .filter(func(p) { p.status == #approved and p.serviceType == serviceType });
  };

  public query func getProviderByPrincipal(providerPrincipal : Principal) : async ?Provider {
    providers_v2.get(providerPrincipal);
  };

  public query ({ caller }) func getAllProviders() : async [Provider] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Admins only");
    };
    providers_v2.values().toArray().sort();
  };

  public query ({ caller }) func getPendingProviders() : async [Provider] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Admins only");
    };
    providers_v2.values().toArray().filter(func(p) { p.status == #pending }).sort();
  };

  public shared ({ caller }) func approveProvider(providerPrincipal : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Admins only");
    };
    ensureProvidersMigrated();
    let provider = getExistingProvider(providerPrincipal);
    providers_v2.add(providerPrincipal, { provider with status = #approved; rejectionNote = null });
  };

  public shared ({ caller }) func rejectProvider(providerPrincipal : Principal, note : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Admins only");
    };
    ensureProvidersMigrated();
    let provider = getExistingProvider(providerPrincipal);
    providers_v2.add(providerPrincipal, { provider with status = #rejected; rejectionNote = ?note });
  };

  // ---- Booking Functions ----

  public shared ({ caller }) func submitBookingRequest(
    providerPrincipal : Principal,
    userName : Text,
    userContact : Text,
    issueDescription : Text,
    userLat : Float,
    userLng : Float,
    userLocationLabel : Text,
  ) : async Nat {
    ensureBookingsMigrated();
    ignore getExistingProvider(providerPrincipal);
    let id = nextBookingId;
    bookings_v2.add(id, {
      id;
      providerPrincipal;
      userContact;
      issueDescription;
      userName;
      userLat;
      userLng;
      userLocationLabel;
      status = #pending;
      createdAt = Time.now();
    });
    nextBookingId += 1;
    id;
  };

  public shared ({ caller }) func respondToBooking(bookingId : Nat, accept : Bool) : async () {
    ensureBookingsMigrated();
    ignore getExistingProvider(caller);
    let booking = requireBooking(bookingId);
    if (booking.providerPrincipal != caller) {
      Runtime.trap("Unauthorized: Can only respond to your own bookings");
    };
    bookings_v2.add(bookingId, { booking with status = if (accept) { #accepted } else { #declined } });
  };

  public shared ({ caller }) func markBookingInProgress(bookingId : Nat) : async () {
    ensureBookingsMigrated();
    let booking = requireBooking(bookingId);
    if (booking.providerPrincipal != caller) {
      Runtime.trap("Unauthorized: Can only update your own bookings");
    };
    if (booking.status != #accepted) {
      Runtime.trap("Booking must be accepted before marking as in-progress");
    };
    bookings_v2.add(bookingId, { booking with status = #inProgress });
  };

  public shared func markBookingComplete(bookingId : Nat) : async () {
    ensureBookingsMigrated();
    let booking = requireBooking(bookingId);
    if (booking.status != #inProgress) {
      Runtime.trap("Booking must be in-progress before marking as complete");
    };
    bookings_v2.add(bookingId, { booking with status = #completed });
  };

  public shared func cancelBooking(bookingId : Nat) : async () {
    ensureBookingsMigrated();
    let booking = requireBooking(bookingId);
    switch (booking.status) {
      case (#completed) { Runtime.trap("Cannot cancel a completed booking") };
      case (#declined)  { Runtime.trap("Cannot cancel a declined booking") };
      case (#cancelled) { Runtime.trap("Booking is already cancelled") };
      case _ {};
    };
    bookings_v2.add(bookingId, { booking with status = #cancelled });
  };

  // ---- Booking Read Operations ----

  public query func getActiveBookingByContact(userContact : Text) : async ?Booking {
    let matches = allBookings().filter(func(b : Booking) : Bool {
      b.userContact == userContact and
      b.status != #completed and
      b.status != #cancelled and
      b.status != #declined
    });
    if (matches.size() == 0) { null } else { ?matches[0] };
  };

  public query ({ caller }) func getMyBookingRequests() : async [Booking] {
    ignore getExistingProvider(caller);
    allBookings().filter(func(b) { b.providerPrincipal == caller }).sort();
  };

  public query ({ caller }) func getBookingById(id : Nat) : async Booking {
    switch (lookupBooking(id)) {
      case (?b)   { b };
      case (null) { Runtime.trap("Booking not found") };
    };
  };

  public query ({ caller }) func getBookingsByProvider(providerPrincipal : Principal) : async [Booking] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Admins only");
    };
    ignore getExistingProvider(providerPrincipal);
    allBookings()
      .filter(func(b) { b.providerPrincipal == providerPrincipal })
      .sort();
  };

  // ---- Helper Functions ----

  func getExistingProvider(principal : Principal) : Provider {
    switch (providers_v2.get(principal)) {
      case (null)      { Runtime.trap("Provider not found") };
      case (?provider) { provider };
    };
  };

  // Used in update (mutable) context: requires booking to exist
  func requireBooking(id : Nat) : Booking {
    switch (lookupBooking(id)) {
      case (?b)   { b };
      case (null) { Runtime.trap("Booking not found") };
    };
  };
};
