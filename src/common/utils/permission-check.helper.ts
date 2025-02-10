export interface PermissionResult {
  access: 'allow' | 'deny';
  role: string;
  username: string;
  scope: string;
  clientid: string;
  sub: string;
  iss?: string;
  message?: string;
}

export async function checkPermissions(
  authorizerData: any,
): Promise<PermissionResult> {
  const permission: PermissionResult = {
    access: 'deny',
    role: 'norole',
    username: 'nousername',
    scope: 'no scope',
    clientid: 'noid',
    sub: 'nosub',
  };

  console.log('authorizerData ->', authorizerData);

  // Si no llega nada en claims ni jwt, negar
  if (!authorizerData || Object.keys(authorizerData).length === 0) {
    permission.message = 'claims/jwt not found in event';
    console.log(JSON.stringify(permission));
    return permission;
  }

  // Extraer claims (si fuera 'event.claims' o 'event.jwt.claims')
  const claims = authorizerData.claims
    ? authorizerData.claims
    : authorizerData.jwt?.claims || {};

  if (!claims.client_id) {
    permission.message = 'claims does not contain the client_id';
    console.log(JSON.stringify(permission));
    return permission;
  }
  if (!claims.iss) {
    permission.message = 'claims does not contain the iss';
    console.log(JSON.stringify(permission));
    return permission;
  }

  // Verificar que tus variables de entorno estén configuradas
  if (!process.env.cognito_admin) {
    permission.message = 'cognito_admin env var not set';
    console.log(JSON.stringify(permission));
    return permission;
  }
  if (!process.env.cognito_user) {
    permission.message = 'cognito_user env var not set';
    console.log(JSON.stringify(permission));
    return permission;
  }

  // Asignar algunos campos al objeto permission
  permission.username = claims.username || 'nousername';
  permission.scope = claims.scope || 'no scope';
  permission.clientid = claims.client_id || 'noid';
  permission.sub = claims.sub || 'nosub';
  permission.iss = claims.iss;

  // Lógica para determinar si es admin o user, comparando con variables de entorno
  switch (claims.iss) {
    case process.env.cognito_admin: {
      console.log('We got an Admin');
      permission.role = 'admin';
      permission.access = 'allow';
      break;
    }
    case process.env.cognito_user: {
      console.log('We got a User');
      permission.role = 'user';
      permission.access = 'allow';
      break;
    }
    default: {
      console.log('we got default, check info');
      permission.access = 'deny';
      permission.message = `Issuer ${claims.iss} is not recognized`;
      break;
    }
  }

  console.log(JSON.stringify(permission));
  return permission;
}
