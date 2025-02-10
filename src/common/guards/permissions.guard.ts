// src/auth/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { checkPermissions } from '../utils/permission-check.helper';

@Injectable()
export class PermissionsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obtener la request
    const request = context.switchToHttp().getRequest();

    // En serverless, a veces el authorizer podría estar en request.requestContext.authorizer
    // o si lo decodificaste por tu cuenta, en request.user
    const authorizerData = request.requestContext?.authorizer;

    // Llamamos a nuestro helper
    const result = await checkPermissions(authorizerData);

    if (result.access !== 'allow') {
      // Lanza excepción 403
      throw new ForbiddenException(result.message || 'User not authorized');
    }

    // Si es allow, podríamos adjuntar info a la request para usarla luego
    request.permission = result;

    // true => Nest continuará al siguiente paso
    return true;
  }
}
