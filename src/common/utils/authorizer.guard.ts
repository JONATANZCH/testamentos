import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { getCurrentInvoke } from '@codegenie/serverless-express';

@Injectable()
export class AuthorizerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();

    // 1. Ignorar si es OPTIONS
    if (request.method === 'OPTIONS') {
      console.log('Skipping guard for OPTIONS');
      return true;
    }

    console.log(
      'AuthorizerGuard => Attempting to retrieve event from getCurrentInvoke()',
    );
    const { event } = getCurrentInvoke();

    // 2. Obtener el authorizer data del event
    const authorizerData = event?.requestContext?.authorizer;
    console.log('Guard - authorizerData from event:', authorizerData);

    // 3. Si no hay data, lanzamos excepción
    if (!authorizerData) {
      console.log(
        'No authorizer data found => no claims in requestContext.authorizer',
      );
      throw new HttpException(
        'Unauthorized: no authorizer data',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 4. Intentamos extraer "username" de la estructura Cognito
    const claims =
      authorizerData.claims ||
      authorizerData?.jwt?.claims ||
      authorizerData?.lambda;

    const username = claims?.username || claims?.email || claims?.name || null;

    if (!claims || !username) {
      console.log('No username found in token claims');
      throw new HttpException(
        'Unauthorized: missing username claim',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 5. Inyectar en el request
    request['authorizerData'] = {
      ...authorizerData,
      claims,
    };

    // 6. Retornar true => pasa al controlador
    return true;
  }
}
