/** Placeholder — wire Prisma repositories in a later sprint. */
export abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>;
}
