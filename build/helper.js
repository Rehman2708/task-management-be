import User from "./models/User.js";
export async function getOwnerAndPartner(userId) {
    const owner = await User.findOne({ userId }).lean();
    if (!owner)
        return { owner: null, partner: null };
    const partner = owner.partnerUserId
        ? await User.findOne({ userId: owner.partnerUserId }).lean()
        : null;
    return { owner, partner };
}
