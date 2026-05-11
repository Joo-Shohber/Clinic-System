import { Queue, Worker, WorkerOptions, Processor } from "bullmq";
import getRedis from "../config/redis";

function getBullMQConnection() {
  return getRedis().duplicate();
}

let _expirationQueue: Queue | null = null;
let _notificationQueue: Queue | null = null;

export function getExpirationQueue(): Queue {
  if (!_expirationQueue) {
    _expirationQueue = new Queue("appointment-expiration", {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }
  return _expirationQueue;
}

export function getNotificationQueue(): Queue {
  if (!_notificationQueue) {
    _notificationQueue = new Queue("notifications", {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }
  return _notificationQueue;
}

export function createWorker(
  queueName: string,
  processor: Processor,
  options?: Partial<WorkerOptions>,
): Worker {
  return new Worker(queueName, processor, {
    connection: getBullMQConnection(),
    ...options,
  });
}
