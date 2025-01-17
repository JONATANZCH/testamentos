// import { Injectable } from '@nestjs/common';
// import { getPrismaClient } from 'getprisma-client';
// import { SecretsManager } from '@aws-sdk/client-secrets-manager';
// let prismaInstance: any = null;

// @Injectable()
// export class PrismaProvider {
//   async getPrismaClient(): Promise<any> {
//     try {
//       if (prismaInstance === null) {
//         const secretid = process.env.secretId;
//         const prismaNPMVersion = '3.0';
//         const AWS_REGION = process.env.AWSREGION;
//         console.log('secretid ->', secretid);
//         console.log('prismaNPMVersion ->', prismaNPMVersion);
//         console.log('REGION ->', AWS_REGION);
//         prismaInstance = await getPrismaClient(
//           secretid,
//           SecretsManager,
//           prismaNPMVersion,
//           AWS_REGION,
//         );
//         console.log('Prisma instance successfully created');
//       }
//       return prismaInstance;
//     } catch (error) {
//       console.log('Pastpost Error-> v8jhus');
//       console.error('Error getting prisma instance', error);
//       return null;
//     }
//   }
// }
