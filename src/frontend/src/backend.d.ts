import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface RegisterProviderRequest {
    lat: number;
    lng: number;
    baseFeeINR: bigint;
    serviceType: ServiceType;
    name: string;
    email: string;
    phone: string;
    licenseNumber: string;
    locationLabel: string;
}
export interface Booking {
    id: bigint;
    status: BookingStatus;
    userName: string;
    issueDescription: string;
    createdAt: Time;
    userLat: number;
    userLng: number;
    userLocationLabel: string;
    providerPrincipal: Principal;
    userContact: string;
}
export interface UpdateProviderProfileRequest {
    lat: number;
    lng: number;
    baseFeeINR: bigint;
    name: string;
    email: string;
    phone: string;
    locationLabel: string;
}
export interface Provider {
    lat: number;
    lng: number;
    status: ProviderStatus;
    baseFeeINR: bigint;
    serviceType: ServiceType;
    principal: Principal;
    name: string;
    isAvailable: boolean;
    email: string;
    phone: string;
    licenseNumber: string;
    rejectionNote?: string;
    locationLabel: string;
    registeredAt: Time;
}
export interface UserProfile {
    name: string;
}
export enum BookingStatus {
    pending = "pending",
    accepted = "accepted",
    declined = "declined",
    inProgress = "inProgress",
    completed = "completed",
    cancelled = "cancelled"
}
export enum ProviderStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected"
}
export enum ServiceType {
    plumber = "plumber",
    electrician = "electrician",
    mechanic = "mechanic"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    approveProvider(providerPrincipal: Principal): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    cancelBooking(bookingId: bigint): Promise<void>;
    getActiveBookingByContact(userContact: string): Promise<Booking | null>;
    getAllProviders(): Promise<Array<Provider>>;
    getApprovedProvidersByServiceType(serviceType: ServiceType): Promise<Array<Provider>>;
    getBookingById(id: bigint): Promise<Booking>;
    getBookingsByProvider(providerPrincipal: Principal): Promise<Array<Booking>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMyBookingRequests(): Promise<Array<Booking>>;
    getMyProfile(): Promise<Provider>;
    getPendingProviders(): Promise<Array<Provider>>;
    getProviderByPrincipal(providerPrincipal: Principal): Promise<Provider | null>;
    getProvidersByEmail(email: string): Promise<Array<Provider>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    markBookingComplete(bookingId: bigint): Promise<void>;
    markBookingInProgress(bookingId: bigint): Promise<void>;
    registerProvider(request: RegisterProviderRequest): Promise<void>;
    rejectProvider(providerPrincipal: Principal, note: string): Promise<void>;
    respondToBooking(bookingId: bigint, accept: boolean): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    submitBookingRequest(providerPrincipal: Principal, userName: string, userContact: string, issueDescription: string, userLat: number, userLng: number, userLocationLabel: string): Promise<bigint>;
    toggleAvailability(): Promise<void>;
    updateProviderLocation(lat: number, lng: number): Promise<void>;
    updateProviderProfile(request: UpdateProviderProfileRequest): Promise<void>;
}
