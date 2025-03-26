import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { SendTestamentDto } from './dto/send-messages.dto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../config';

@Injectable()
export class SendMessagesService {
  private prisma: any = null;
  private readonly environment: string;
  private readonly getSqsCommNoWaitQueue: any;
  private readonly sqsClient: SQSClient;

  constructor(
    private prismaprovider: PrismaProvider,
    private readonly configService: ConfigService,
  ) {
    this.getSqsCommNoWaitQueue = this.configService.getSqsCommNoWaitQueue();
    this.sqsClient = new SQSClient({
      region: this.configService.getAwsRegion(),
    });
  }

  async sendInstantMessage(
    userId: string,
    sendTestamentDto: SendTestamentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      // 1) Obtener instancia de Prisma
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> fbekj3');
        response.code = 500;
        response.msg = 'Could not connect to DB, no prisma client created.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // 2) Validar que el usuario exista
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        response.code = 404;
        response.msg = `User with id ${userId} not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // 3) Validar que exista un testamento activo
      const testamentHeader = await this.prisma.testamentHeader.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });
      if (!testamentHeader) {
        response.code = 400;
        response.msg = 'You can only send Active wills.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 4) Validar que la suscripción del usuario está activa
      //    (expireDate > now() && status = 'Active')
      const subscription = await this.prisma.usersSuscriptions.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });
      if (!subscription || subscription.expireDate <= new Date()) {
        response.code = 400;
        response.msg = 'Your subscription has expired or does not exist.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 5) Validar contactos (máx 4 -> ya validado en sendTestamentDto) y que pertenezcan al usuario
      const contacts = await this.prisma.contact.findMany({
        where: {
          id: { in: sendTestamentDto.contactIds },
          userId,
        },
      });
      if (contacts.length !== sendTestamentDto.contactIds.length) {
        response.code = 400;
        response.msg =
          'Some contacts do not belong to the user or do not exist.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 3) Valida el email de cada contacto
      //    Ej. un regex rápido o min. ver si no está vacío
      const invalidContacts = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const c of contacts) {
        // Si no tiene email o no pasa la regex, se considera inválido
        if (!c.email || !emailRegex.test(c.email)) {
          invalidContacts.push({
            id: c.id,
            name: c.name,
            email: c.email,
          });
        }
      }

      if (invalidContacts.length > 0) {
        response.code = 400;
        response.msg = `The following contacts have invalid email addresses: ${invalidContacts
          .map((ic) => `[${ic.id}: ${ic.email}]`)
          .join(', ')}`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 6) Verificar info en la columna 'url' del testamento (bucket, key)
      const testamentUrl = testamentHeader.url as any;
      if (!testamentUrl?.set?.bucket || !testamentUrl?.set?.key) {
        response.code = 400;
        response.msg = 'The active will has no bucket/key attached.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 7) Construir la lista de destinatarios
      const toEmails = contacts.map((c) => c.email as string);

      if (toEmails.length === 0) {
        response.code = 400;
        response.msg =
          'None of the selected contacts have a valid email address.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // 8. Construir el payload final para ServiceMessaging
      const finalPayload = {
        type: 'new',
        metadata: {
          pastpostmetadata: {
            ppObjectType: 'Testamentos send-messages',
            ppObjetcId: uuidv4(),
            userId: userId,
          },
          body: {
            provider: 'sendgrid',
            commType: 'email',
            data: [
              {
                msg: {
                  to: toEmails,
                  from: 'Past Post <mensaje@pastpost.com>',
                  templateId: 'd-b5575cad947d4523bbbb5d1ee2351959',
                  dynamicTemplateData: {
                    subject: `${user.name} te envió su testamento.`,
                    from: user.name,
                    to: 'Receptor(es)',
                    mensajeTitulo: 'Mensaje de prueba Dev Env',
                    mensajeDescripcion: sendTestamentDto.message,
                  },
                  attachments: [
                    {
                      provider: 's3',
                      bucket: testamentUrl.set.bucket,
                      key: testamentUrl.set.key,
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      // 9) Guardar en tabla Messages
      const createdMessage = await this.prisma.messages.create({
        data: {
          userId: userId,
          deliveryType: 'INSTANT',
          status: 'RECIVED',
          payload: finalPayload,
        },
      });

      // 10) Enviar a SQS
      const sqsClient = this.sqsClient;
      const queueUrl = this.getSqsCommNoWaitQueue;

      try {
        const command = new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(finalPayload),
          MessageGroupId: 'send-messages',
          MessageDeduplicationId: new Date().getTime().toString(),
        });
        await sqsClient.send(command);

        // 11) Actualizar status a ENQUE y marcar fecha de envío
        const updatedMessage = await this.prisma.messages.update({
          where: { id: createdMessage.id },
          data: {
            status: 'ENQUE',
            sentAt: new Date(),
          },
          select: {
            id: true,
            userId: true,
            status: true,
            errorLog: true,
            createdAt: true,
          },
        });

        response.code = 200;
        response.msg = 'Message queued successfully.';
        response.response = updatedMessage;
        return response;
      } catch (err) {
        // 12) Manejo de error, guardar log
        await this.prisma.messages.update({
          where: { id: createdMessage.id },
          data: {
            errorLog: err.message,
            status: 'FAILED',
          },
          select: {
            id: true,
            userId: true,
            status: true,
            errorLog: true,
            createdAt: true,
          },
        });
        response.code = 500;
        response.msg = `Error al enviar el mensaje a SQS: ${err.message}`;
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      processException(error);
    }
  }
}
