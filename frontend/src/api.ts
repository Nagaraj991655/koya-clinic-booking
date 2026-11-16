const API_BASE = "http://100.59.34.171:8000";
export interface Slot {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
}

export interface Booking {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

// Set VITE_API_KEY in frontend/.env (local) and as an env var on Render (build time).
const API_KEY = import.meta.env.VITE_API_KEY as string;

export class ApiError extends Error {
  status: number;
  retryAfter: string | null;
  constructor(message: string, status: number, retryAfter: string | null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {    ...options,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, res.headers.get("Retry-After"));
  }
  return data as T;
}

export const getSlots = (provider = "") =>
  request<{ slots: Slot[] }>("/slots" + (provider ? `?provider=${encodeURIComponent(provider)}` : ""));

export const createBooking = (
  body: { slot_id: string; name: string; email: string },
  idempotencyKey: string
) =>
  request<Booking>("/bookings", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });

export const cancelBooking = (id: string) => request<Booking>(`/bookings/${id}`, { method: "DELETE" });

// Follows next_cursor until the last page.
export async function getAllBookings(email: string): Promise<Booking[]> {
  const all: Booking[] = [];
  let cursor: string | null = null;
  do {
    const q: string = `/bookings?email=${encodeURIComponent(email)}&limit=50` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const page: { bookings: Booking[]; next_cursor: string | null } = await request(q);
    all.push(...page.bookings);
    cursor = page.next_cursor;
  } while (cursor);
  return all;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
