import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import { getPrismaClient } from 'testgetprismaclient';

@Injectable()
export class PrismaProvider {
  private prismaInstance: any = null;

  async getPrismaClient(): Promise<any> {
    if (!this.prismaInstance) {
      console.log('Initializing Prisma client...');
      try {
        this.prismaInstance = await getPrismaClient();
      } catch (error) {
        console.error('Error initializing Prisma client:', error);
        throw new Error('Failed to initialize Prisma client');
      }
    }
    return this.prismaInstance;
  }

  async disconnectClient(): Promise<void> {
    if (this.prismaInstance) {
      await this.prismaInstance.$disconnect();
      console.log('Prisma client disconnected.');
    }
  }
}
