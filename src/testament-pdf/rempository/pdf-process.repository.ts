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

  async validateVersion(userId: string, version: number): Promise<boolean> {
    this.prisma = await this.prismaprovider.getPrismaClient();
    const record = await this.prisma.testamentHeader.findFirst({
      where: { userId, version },
    });
    return !!record;
  }

  async getLatestProcessForUser(userId: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
  }

  async getPdfProcessById(pdfProcessId: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.findUnique({
      where: {
        id: pdfProcessId,
      },
    });
  }

  async updateStatus(pdfProcessId: string, newStatus: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.update({
      where: { id: pdfProcessId },
      data: { status: newStatus },
    });
  }

  async updateHtmlData(pdfProcessId: string, htmlData: string) {
    this.prisma = await this.prismaprovider.getPrismaClient();
    return this.prisma.pdfProcess.update({
      where: { id: pdfProcessId },
      data: { htmlData },
    });
  }
}
