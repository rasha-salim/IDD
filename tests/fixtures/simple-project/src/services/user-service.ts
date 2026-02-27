import { User, UserRole } from '../models/user.js';
import type { UserProfile } from '../models/user.js';

export class UserService {
  private users: Map<string, User> = new Map();

  public createUser(profile: UserProfile): User {
    const user = new User(profile.id, profile.name, profile.email, profile.role);
    this.users.set(user.id, user);
    return user;
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public getAllAdmins(): User[] {
    return Array.from(this.users.values()).filter((u) => u.isAdmin());
  }
}

export function createDefaultUser(name: string): User {
  return new User(crypto.randomUUID(), name, `${name.toLowerCase()}@example.com`, UserRole.Viewer);
}
