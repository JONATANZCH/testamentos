export class User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  middleName?: string;
  governmentId?: string;
  birthDate?: Date;
  nationality?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}
