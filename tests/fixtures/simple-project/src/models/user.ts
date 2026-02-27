export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

export class User implements UserProfile {
  public id: string;
  public name: string;
  public email: string;
  public role: UserRole;

  constructor(id: string, name: string, email: string, role: UserRole = UserRole.Viewer) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
  }

  public isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }
}
