import User from "../models/User.js";
import { IUser } from "../models/User.js";

// In-memory cache for user details (request-scoped)
class UserCacheService {
  private cache = new Map<string, IUser | null>();

  // Get single user with caching
  async getUser(userId: string): Promise<IUser | null> {
    if (!userId) return null;

    if (this.cache.has(userId)) {
      return this.cache.get(userId) || null;
    }

    const user = await User.findOne({ userId }).lean<IUser>();
    this.cache.set(userId, user);
    return user;
  }

  // Batch fetch multiple users (solves N+1 problem)
  async getUsers(userIds: string[]): Promise<Map<string, IUser>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, IUser>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const userId of uniqueIds) {
      if (this.cache.has(userId)) {
        const user = this.cache.get(userId);
        if (user) result.set(userId, user);
      } else {
        uncachedIds.push(userId);
      }
    }

    // Batch fetch uncached users
    if (uncachedIds.length > 0) {
      const users = await User.find({ userId: { $in: uncachedIds } }).lean<
        IUser[]
      >();

      // Update cache and result
      for (const user of users) {
        this.cache.set(user.userId, user);
        result.set(user.userId, user);
      }

      // Cache null for non-existent users
      for (const userId of uncachedIds) {
        if (!result.has(userId)) {
          this.cache.set(userId, null);
        }
      }
    }

    return result;
  }

  // Get user details for UI (name, image)
  getUserDetails(user: IUser | null) {
    if (!user) return undefined;
    return {
      name: user.name,
      image: user.image || "",
    };
  }

  // Clear cache (call at end of request)
  clear() {
    this.cache.clear();
  }
}

// Create new instance per request to avoid memory leaks
export const createUserCache = () => new UserCacheService();
