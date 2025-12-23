import User, { IUser } from "./models/User.js";

// Optimized version with parallel queries
export async function getOwnerAndPartner(userId: string) {
  const owner: IUser | null = await User.findOne({ userId }).lean();
  if (!owner) return { owner: null, partner: null };

  // If no partner, return early
  if (!owner.partnerUserId) return { owner, partner: null };

  // Fetch partner in parallel (though in this case it's just one query)
  const partner: IUser | null = await User.findOne({
    userId: owner.partnerUserId,
  }).lean();
  return { owner, partner };
}

// Batch version for multiple users (solves N+1 problem)
export async function getOwnersAndPartners(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  // Get all owners first
  const owners = await User.find({ userId: { $in: uniqueIds } }).lean<
    IUser[]
  >();
  const ownerMap = new Map<string, IUser>();
  const partnerIds: string[] = [];

  for (const owner of owners) {
    ownerMap.set(owner.userId, owner);
    if (owner.partnerUserId) {
      partnerIds.push(owner.partnerUserId);
    }
  }

  // Get all partners in one query
  const partners =
    partnerIds.length > 0
      ? await User.find({ userId: { $in: partnerIds } }).lean<IUser[]>()
      : [];
  const partnerMap = new Map<string, IUser>();

  for (const partner of partners) {
    partnerMap.set(partner.userId, partner);
  }

  // Build result map
  const result = new Map<
    string,
    { owner: IUser | null; partner: IUser | null }
  >();
  for (const userId of uniqueIds) {
    const owner = ownerMap.get(userId) || null;
    const partner = owner?.partnerUserId
      ? partnerMap.get(owner.partnerUserId) || null
      : null;
    result.set(userId, { owner, partner });
  }

  return result;
}
