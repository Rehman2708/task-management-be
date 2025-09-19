import User, { IUser } from "./models/User.js";

export async function getOwnerAndPartner(userId: string) {
  const owner: IUser | null = await User.findOne({ userId }).lean();
  if (!owner) return { owner: null, partner: null };
  const partner: IUser | null = owner.partnerUserId
    ? await User.findOne({ userId: owner.partnerUserId }).lean()
    : null;
  return { owner, partner };
}
