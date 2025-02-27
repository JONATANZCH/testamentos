import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../../providers';

interface CreatePdfProcessDto {
  userId: string;
  version: number;
  status: string;
  htmlData?: string | null;
  metadata?: any;
}

@Injectable()
export class PdfProcessRepository {
  private prisma: any = null;

  constructor(private prismaprovider: PrismaProvider) {}

  /**
   * Crea un registro en la tabla PdfProcess.
   */
  async createPdfProcess(data: CreatePdfProcessDto) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.create({
      data: {
        userId: data.userId,
        version: data.version,
        status: data.status,
        htmlData: data.htmlData,
        metadata: data.metadata ?? {},
      },
    });
  }

  /**
   * Obtiene un registro pdfProcess por su ID.
   */
  async getPdfProcessById(pdfProcessId: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.findUnique({
      where: {
        id: pdfProcessId,
      },
    });
  }

  /**
   * Actualiza el campo status de un proceso en pdfProcess.
   */
  async updateStatus(pdfProcessId: string, newStatus: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.update({
      where: { id: pdfProcessId },
      data: { status: newStatus },
    });
  }

  /**
   * Guarda el HTML generado en la columna htmlData
   */
  async updateHtmlData(pdfProcessId: string, htmlData: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.update({
      where: { id: pdfProcessId },
      data: { htmlData },
    });
  }
}
