import { exec } from '../db/pool.js';

export async function notify(userId: number, message: string, link?: string) {
  await exec('INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)', [
    userId,
    message.slice(0, 500),
    link ?? null,
  ]);
}
