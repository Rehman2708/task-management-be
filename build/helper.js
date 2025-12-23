import User from "./models/User.js";
// Optimized version with parallel queries
export async function getOwnerAndPartner(userId) {
    const owner = await User.findOne({ userId }).lean();
    if (!owner)
        return { owner: null, partner: null };
    // If no partner, return early
    if (!owner.partnerUserId)
        return { owner, partner: null };
    // Fetch partner in parallel (though in this case it's just one query)
    const partner = await User.findOne({
        userId: owner.partnerUserId,
    }).lean();
    return { owner, partner };
}
// Batch version for multiple users (solves N+1 problem)
export async function getOwnersAndPartners(userIds) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0)
        return new Map();
    // Get all owners first
    const owners = await User.find({ userId: { $in: uniqueIds } }).lean();
    const ownerMap = new Map();
    const partnerIds = [];
    for (const owner of owners) {
        ownerMap.set(owner.userId, owner);
        if (owner.partnerUserId) {
            partnerIds.push(owner.partnerUserId);
        }
    }
    // Get all partners in one query
    const partners = partnerIds.length > 0
        ? await User.find({ userId: { $in: partnerIds } }).lean()
        : [];
    const partnerMap = new Map();
    for (const partner of partners) {
        partnerMap.set(partner.userId, partner);
    }
    // Build result map
    const result = new Map();
    for (const userId of uniqueIds) {
        const owner = ownerMap.get(userId) || null;
        const partner = owner?.partnerUserId
            ? partnerMap.get(owner.partnerUserId) || null
            : null;
        result.set(userId, { owner, partner });
    }
    return result;
}
