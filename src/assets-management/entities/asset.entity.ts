export class Asset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  value: number;
  metadata?: Record<string, any>; // JSON type
  isInherited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
