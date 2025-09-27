import { Controller, Post, Body, Get, Param, Header, Res, HttpException, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { SensorService } from './sensor.service';
import { Response } from 'express';

@Controller('sensor')
export class SensorController {
  constructor(private sensorService: SensorService) {}

  @Post()
  async receberDados(
    @Body() { media_eco2, location }: { media_eco2: number; location: string }
  ) {
    if (!media_eco2 || !location) {
      throw new HttpException('Dados incompletos: media_eco2 e location são obrigatórios.', HttpStatus.BAD_REQUEST);
    }

    try {
      const sensorData = await this.sensorService.create(media_eco2, location);
      return { message: 'Dados armazenados', dados: sensorData };
    } catch (error) {
      throw new HttpException('Erro ao armazenar os dados', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('media-semana')
  async getMediaSemana() {
    const dados = await this.sensorService.getMediaSemana();
    return { message: 'Média dos últimos 7 dias', dados };
  }

  @Get('ultima-leitura')
  async getUltimaLeitura() {
    const ultimaLeitura = await this.sensorService.getUltimaLeitura();
    return ultimaLeitura 
      ? { message: 'Última leitura encontrada', dados: ultimaLeitura } 
      : { message: 'Nenhuma leitura disponível' };
  }

  @Get("historico")
  async getHistorico(){
    const historico = await this.sensorService.getHistorico();
    return historico.length 
      ? { message: 'Histórico encontrado', dados: historico } 
      : { message: 'Nenhum dado encontrado' };
  }

  @Get("grupo/:id")
  async getMedicoesPorGrupo(@Param('id', ParseIntPipe) id: number) {
    const registros = await this.sensorService.getMedicoesPorGrupo(id);
    return { message: "Medições do grupo", dados: registros };
  }

  @Get('grupo/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="relatorio.pdf"')
  async baixarPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdfBuffer = await this.sensorService.generatePdfForGrupo(id);
    res.send(pdfBuffer);
  }
}