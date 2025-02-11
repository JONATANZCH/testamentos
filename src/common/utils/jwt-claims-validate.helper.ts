import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthorizerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 1. Get the request object from the context
    const request: Request = context.switchToHttp().getRequest();

    // Si el método es 'OPTIONS', ignorar validación
    if (request.method === 'OPTIONS') {
      console.log('Skipping guard for OPTIONS');
      return true;
    }

    // 2. exctract the authorizer data from the request context
    console.log('buscando authorizer in requestContext:', request);
    const authorizerData = request['requestContext']?.authorizer;
    if (!authorizerData) {
      console.log('Missing authorizer data in requestContext: ', request);
    }
    console.log('Authorizer data found: ', authorizerData);

    // 3. validate the claims
    const claims =
      authorizerData.claims ||
      (authorizerData.jwt && authorizerData.jwt.claims);
    console.log('claims obtained :', claims);
    if (!claims || !claims.username) {
      console.log('No claims or username in authorizer data:', authorizerData);
    }

    // return authorizer from the request context
    request['authorizerData'] = authorizerData;

    return true;
  }
}
