import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';
import { countryPhoneCodeMap } from './mapCountryPhoneCode';

export const reverseCountryPhoneCodeMap: Record<CountryPhoneCode, string> =
  Object.keys(countryPhoneCodeMap).reduce(
    (acc, key) => {
      const enumKey = countryPhoneCodeMap[key];
      acc[enumKey] = key;
      return acc;
    },
    {} as Record<CountryPhoneCode, string>,
  );
