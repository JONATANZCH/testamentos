import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { reverseCountryPhoneCodeMap } from '../utils/reverseCountryPhoneCodeMap';

@Injectable()
export class CountryPhoneCodeTransformInterceptor implements NestInterceptor {
  /**
   * Función recursiva para transformar cualquier propiedad "countryPhoneCode"
   * en cualquier nivel del objeto o arreglo.
   */
  private transformValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.transformValue(item));
    }
    if (value && typeof value === 'object') {
      // Si la propiedad existe en este objeto, la transformamos
      if (
        Object.prototype.hasOwnProperty.call(value, 'countryPhoneCode') &&
        value.countryPhoneCode &&
        reverseCountryPhoneCodeMap[value.countryPhoneCode]
      ) {
        value.countryPhoneCode =
          reverseCountryPhoneCodeMap[value.countryPhoneCode];
      }
      // Iteramos sobre todas las propiedades para transformar objetos anidados
      for (const key of Object.keys(value)) {
        value[key] = this.transformValue(value[key]);
      }
    }
    return value;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transformValue(data)));
  }
}
