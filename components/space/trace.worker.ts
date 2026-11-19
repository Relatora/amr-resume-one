// Runs the disk ray trace off the main thread, so a full-resolution trace
// (around a second of maths) never stalls scrolling or the first paint.
import { traceDisk } from "./gargantua";

self.onmessage = (e: MessageEvent<{ id: number; w: number; h: number }>) => {
  const { id, w, h } = e.data;
  const data = traceDisk(w, h);
  (self as unknown as Worker).postMessage({ id, w, h, data }, [data.buffer]);
};
