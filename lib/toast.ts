// Tiny dependency-free toast bus. Components emit; <Toaster/> renders.

export type ToastKind = "error" | "success" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
};

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(kind: ToastKind, message: string, duration: number) {
  if (!message) return;
  const item: ToastItem = { id: ++seq, kind, message, duration };
  listeners.forEach((listener) => listener(item));
}

export function toast(message: string, kind: ToastKind = "info", duration = 5000) {
  emit(kind, message, duration);
}

export function toastError(message: string, duration = 7000) {
  emit("error", message, duration);
}

export function toastSuccess(message: string, duration = 4000) {
  emit("success", message, duration);
}

export function toastInfo(message: string, duration = 5000) {
  emit("info", message, duration);
}
