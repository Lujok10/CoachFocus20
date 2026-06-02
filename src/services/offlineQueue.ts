type OfflineJob = {
  id: string;
  type: "create_task" | "schedule_task" | "voice_checkin";
  createdAt: string;
  payload: any;
};

const QUEUE_KEY = "focus20_offline_queue";

function readQueue(): OfflineJob[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineJob[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineJob(
  type: OfflineJob["type"],
  payload: any
) {
  const queue = readQueue();

  const job: OfflineJob = {
    id: crypto.randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    payload,
  };

  writeQueue([...queue, job]);

  return job;
}

export function getOfflineQueue() {
  return readQueue();
}

export function clearOfflineJob(jobId: string) {
  writeQueue(readQueue().filter((job) => job.id !== jobId));
}

export function clearOfflineQueue() {
  writeQueue([]);
}