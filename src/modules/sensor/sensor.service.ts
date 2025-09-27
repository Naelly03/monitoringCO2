import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class SensorService {
  constructor(private prisma: PrismaService) {}

  private classificarQualidadeAr(eco2: number): string {
    if (eco2 < 400) return "Excelente";
    if (eco2 < 800) return "Boa";
    if (eco2 < 1000) return "Moderada";
    if (eco2 < 2000) return "Ruim";
    if (eco2 < 5000) return "Muito Ruim";
    return "Perigoso";
  }

  async create(media_eco2: number, location: string) {
    const qualidadeAr = this.classificarQualidadeAr(media_eco2);
    return this.prisma.sensor.create({
      data: {
        co2Level: media_eco2,
        airQuality: qualidadeAr,
        location,
        dayMedia: media_eco2, 
      },
    });
  }

  async getMediaSemana() {
    const agora = new Date();
    const inicioSemana = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - 6, 0, 0, 0, 0));
    const fimSemana = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 23, 59, 59, 999));

    const dadosDaSemana = await this.prisma.sensor.findMany({
      where: { timestamp: { gte: inicioSemana, lte: fimSemana } },
    });

    const agrupadoPorDia: Record<string, { total: number; count: number }> = {};
    for (let i = 0; i < 7; i++) {
        const data = new Date(inicioSemana);
        data.setUTCDate(inicioSemana.getUTCDate() + i);
        agrupadoPorDia[data.toISOString().split('T')[0]] = { total: 0, count: 0 };
    }

    for (const dado of dadosDaSemana) {
        const dia = new Date(dado.timestamp).toISOString().split('T')[0];
        if (agrupadoPorDia[dia]) {
            agrupadoPorDia[dia].total += dado.co2Level;
            agrupadoPorDia[dia].count++;
        }
    }

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    return Object.entries(agrupadoPorDia).map(([dia, { total, count }]) => {
        const data = new Date(dia);
        return {
            day: diasSemana[data.getUTCDay()],
            value: count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
        };
    });
  }

  async getUltimaLeitura() {
    return this.prisma.sensor.findFirst({ orderBy: { timestamp: 'desc' } });
  }

  async getHistorico() {
    return this.prisma.sensor.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
  }

  async getMedicoesPorGrupo(id: number) {
    const registroBase = await this.prisma.sensor.findUnique({ where: { id } });

    if (!registroBase) {
      throw new NotFoundException('Registro não encontrado');
    }

    const dataBase = new Date(registroBase.timestamp);
    const inicio = new Date(dataBase.setHours(0, 0, 0, 0));
    const fim = new Date(dataBase.setHours(23, 59, 59, 999));

    return this.prisma.sensor.findMany({
      where: {
        timestamp: { gte: inicio, lte: fim },
        location: registroBase.location,
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async generatePdfForGrupo(id: number): Promise<Buffer> {
    const registros = await this.getMedicoesPorGrupo(id);
    const base = registros[0];
    
    if (!base) {
      throw new NotFoundException('Grupo não encontrado');
    }

    const doc = new PDFDocument();
    
    doc.fontSize(16).text(`Medições de CO₂ - ${base.location}`, { align: 'center' });
    doc.moveDown();

    registros.forEach((r) => {
      doc.fontSize(12).text(
        `Hora: ${new Date(r.timestamp).toLocaleTimeString('pt-BR')} | Local: ${r.location} | CO₂: ${r.co2Level} ppm | Qualidade: ${r.airQuality}`
      );
    });

    doc.end();

    return new Promise((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  }
}