import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
//
import { registerFont, Image, loadImage } from 'canvas';
import sharp from 'sharp';
//
import shortid from 'shortid';
//
import QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Konva = require('konva/cmj').default;
import * as fs from 'fs';
import { jsPDF } from 'jspdf';
// registerFont('src/fonts/nunito.ttf', { family: 'Nunito' });

@Injectable()
export class DesignService {
  constructor(private prisma: PrismaService) {}

  async getDesign() {
    return await this.prisma.design.findMany();
  }

  async uploadFile(body: any) {
    try {
      const uri = body.file.base64.split(';base64,').pop();

      const imgBuffer = Buffer.from(uri, 'base64');
      const image = await sharp(imgBuffer).toBuffer();

      const fileName = body.file.name;

      fs.writeFileSync(`client/${fileName}`, image);

      const file = await this.prisma.file.create({
        data: {
          design: { connect: { id: body.designId } },
          url: `http://localhost:3333/${fileName}`,
        },
      });

      return file;
    } catch (error) {}
  }

  async createDesign(design: any): Promise<any> {
    return await this.prisma.design.create({
      data: {
        title: design?.title,
        typeFile: 'jpg',
      },
    });
  }

  async save(data: any): Promise<any> {
    return await this.prisma.design.update({
      where: {
        id: data.designId,
      },
      data: {
        elements: data.elements,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        typeFile: data.typeFile,
      },
    });
  }

  async getOne(id: number): Promise<any> {
    if (id) {
      return await this.prisma.design.findUnique({
        where: {
          id: id,
        },
        include: {
          files: true,
        },
      });
    }
  }

  async preview(body: any): Promise<any> {
    const design = await this.prisma.design.findUnique({
      where: {
        id: body.designId,
      },
    });

    const stage = new Konva.Stage({
      width: design.canvasWidth,
      height: design.canvasHeight,
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    const drawElements = async () => {
      const parseElements = JSON.parse(design.elements);

      for (const el of parseElements) {
        if (el._type === 'rect') {
          const box = new Konva.Rect({
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            fill: el.fill,
          });
          layer.add(box);
        }

        if (el._type === 'qrcode' && el.isReplace) {
          const qrcode = await QRCode.toDataURL(
            body?.qrcodes[el.id]?.text ?? 'appy.com',
            {
              errorCorrectionLevel: 'H',
            },
          );

          const uri = qrcode.split(';base64,').pop();

          const imgBuffer = Buffer.from(uri, 'base64');
          await sharp(imgBuffer)
            .resize({
              width: el.width,
              height: el.height,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer()
            .then((data) => {
              const img = new Image();
              img.src = data;

              const image = new Konva.Image({
                image: img,
                x: el.x,
                y: el.y,
              });
              layer.add(image);
            });
        }

        if (el._type === 'text') {
          const text = new Konva.Text({
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            fill: el.fill,
            fontStyle: el.fontStyle,
            fontFamily: el.fontFamily,
            fontSize: el.fontSize,

            text: el.isReplace ? body.texts[el.id]?.text : el.text,
          });
          layer.add(text);
        }
        if (el._type === 'image' && el.image.isURL) {
          const img = await loadImage(el.image.url);
          const image = new Konva.Image({
            image: img,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          });
          layer.add(image);
        }

        if (
          el._type === 'dynamic_image' &&
          el.isReplace &&
          body.images[el.id].base64
        ) {
          const uri = body.images[el.id].base64.split(';base64,').pop();

          const imgBuffer = Buffer.from(uri, 'base64');
          await sharp(imgBuffer)
            .resize({
              width: el.width,
              height: el.height,

              position: el.pos,
              background: { r: 0, g: 0, b: 0, alpha: 0 },

              fit: el.fit,
            })
            .png()
            .toBuffer()
            .then((data) => {
              const img = new Image();
              img.src = data;

              const image = new Konva.Image({
                image: img,
                x: el.x,
                y: el.y,
              });
              layer.add(image);
            });
        }
      }
      

      return stage.toDataURL({ pixelRatio: 2 })
      // if (design.typeFile === 'pdf') {
      //   const pdf = new jsPDF();
      //   stage.find('Text').forEach((text: any) => {
      //     const size = text.fontSize()
      //     pdf.setFontSize(size);
      //     pdf.text(text.text(), text.x(), text.y(), {
      //       baseline: 'top',
      //       angle: -text.getAbsoluteRotation(),
      //     });
      //   });

      //   // then put image on top of texts (so texts are not visible)
      //   pdf.addImage(
      //     stage.toDataURL({ pixelRatio: 2 }),
      //     0,
      //     0,
      //     stage.width(),
      //     stage.height(),
      //   );

      //   const fileName = `${design.id}_${shortid.generate()}.${
      //     design.typeFile
      //   }`;
      //   pdf.save(`client/${fileName}`);

      //   return `http://localhost:3333/${fileName}`;
      // } else {
      //   const uri = stage.toDataURL({ pixelRatio: 3 }).split(';base64,').pop();
      //   const imgBuffer = Buffer.from(uri, 'base64');
      //   let image: any;
      //   if (design.typeFile === 'png') {
      //     image = await sharp(imgBuffer)
      //       .resize({
      //         width: design.canvasWidth,
      //         height: design.canvasHeight,
      //       })
      //       .png()
      //       .toBuffer();
      //   }
      //   if (design.typeFile === 'jpg') {
      //     image = await sharp(imgBuffer)
      //       .resize({
      //         width: design.canvasWidth,
      //         height: design.canvasHeight,
      //       })
      //       .jpeg()
      //       .flatten({ background: '#fff' })
      //       .toBuffer();
      //   }

      //   const fileName = `${design.id}_${shortid.generate()}.${
      //     design.typeFile
      //   }`;
      //   fs.writeFileSync(`client/${fileName}`, image);

      //   return `http://localhost:3333/${fileName}`;
      // }
    };

    return await drawElements();
  }

  async updateCanvasWidth(id: number, canvasWidth: number): Promise<any> {
    return await this.prisma.design.update({
      where: {
        id,
      },
      data: {
        canvasWidth,
      },
    });
  }

  async updateCanvasHeight(id: number, canvasHeight: number): Promise<any> {
    return await this.prisma.design.update({
      where: {
        id,
      },
      data: {
        canvasHeight,
      },
    });
  }

  // async addElement(data: any) {
  //   return await this.prisma.element.create({
  //     data: {
  //       ...data.element,
  //       design: { connect: { id: data.designId } },
  //     },
  //   });
  // }
}
