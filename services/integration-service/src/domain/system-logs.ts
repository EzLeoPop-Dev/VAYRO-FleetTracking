// Merging the audit rows of several services into one newest-first list. Pure: no HTTP.

export interface MergedLog { created_at: string; system_log_id: string; source: string }

export const MAX_WINDOW = 200; // offset + limit: every source is asked for this many newest rows at most (the internal route caps one page at 200)

// Each source's rows arrive newest first. The page [offset, offset + limit) of the combined list is
// always inside the first (offset + limit) rows of every source, which is why that is all we ask for.
export function mergeNewestFirst<T extends MergedLog>(perSource: T[][], offset: number, limit: number): T[] {
  return perSource
    .flat()
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.source.localeCompare(b.source) || b.system_log_id.localeCompare(a.system_log_id, "en", { numeric: true }))
    .slice(offset, offset + limit);
}
