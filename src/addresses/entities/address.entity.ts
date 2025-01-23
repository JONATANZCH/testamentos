export interface Address {
  id: string; // UUID
  userId: string; // UUID
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}
