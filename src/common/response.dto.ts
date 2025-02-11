export class GeneralResponseDto {
  code: number;
  msg: string;
  response?: any;

  constructor(init?: Partial<GeneralResponseDto>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
