import { Injectable } from '@nestjs/common';
import { getPrismaClient } from 'testgetprismaclient';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
let prismaInstance: any = null;

@Injectable()
export class PrismaProvider {
  async getPrismaClient(): Promise<any> {
    try {
      if (prismaInstance === null) {
        const secretid = process.env.AWS_SECRET_ID;
        const prismaNPMVersion = '3.0';
        const AWSREGION = process.env.AWSREGION;
        console.log('secretid ->', secretid);
        console.log('prismaNPMVersion ->', prismaNPMVersion);
        console.log('REGION ->', AWSREGION);
        prismaInstance = await getPrismaClient(
          secretid,
          SecretsManager,
          prismaNPMVersion,
          AWSREGION,
        );
        console.log('Prisma instance successfully created');
      }
      return prismaInstance;
    } catch (error) {
      console.log('Pastpost Error-> v8jhus');
      console.error('Error getting prisma instance', error);
      return null;
    }
  }
}
