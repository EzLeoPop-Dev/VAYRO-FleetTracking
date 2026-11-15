// Prisma returns BIGINT columns as JS bigint, which JSON.stringify rejects.
// Public API ids are strings end to end, so serialize bigint as its decimal string.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function toJSON() {
  return this.toString();
};
export {};
