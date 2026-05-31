import {
  getCollection,
  type CollectionEntry,
  type CollectionKey,
} from 'astro:content';
import { getSession } from 'auth-astro/server';

// The signIn callback only lets the configured OWNER_USERNAME create a session,
// so any valid session implies the viewer is the owner.
export async function isOwner(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return !!session;
}

function sortKey(entry: { data: Record<string, unknown> }): number {
  const d = entry.data as { date?: Date; startDate?: Date };
  return (d.date ?? d.startDate)?.valueOf() ?? 0;
}

export async function getVisibleEntries<K extends CollectionKey>(
  collection: K,
  request: Request,
): Promise<CollectionEntry<K>[]> {
  const owner = await isOwner(request);
  const entries = await getCollection(collection);
  const visible = owner ? entries : entries.filter((e) => !e.data.private);
  return visible.sort((a, b) => sortKey(b) - sortKey(a));
}

export async function getVisibleEntry<K extends CollectionKey>(
  collection: K,
  slug: string,
  request: Request,
): Promise<CollectionEntry<K> | null> {
  const entries = await getVisibleEntries(collection, request);
  return entries.find((e) => e.id === slug) ?? null;
}
