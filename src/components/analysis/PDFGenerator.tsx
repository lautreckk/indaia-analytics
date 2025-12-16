'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFGeneratorProps {
  contentRef: React.RefObject<HTMLDivElement>;
  fileName?: string;
  className?: string;
}

export function PDFGenerator({ contentRef, fileName, className }: PDFGeneratorProps) {
  const handleGeneratePDF = async () => {
    if (!contentRef.current) {
      console.error('Content ref não encontrado');
      return;
    }

    try {
      // Configurar canvas com opções de qualidade
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, // Maior qualidade
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // Fundo branco para o PDF
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
        onclone: (clonedDoc) => {
          // Garantir fundo branco no elemento clonado
          const clonedElement = clonedDoc.querySelector('[data-pdf-content]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.backgroundColor = '#ffffff';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Margens para centralização e espaçamento
      const marginX = 15; // 15mm de margem lateral para centralização
      const marginY = 10; // 10mm de margem vertical
      const contentWidth = pdfWidth - (marginX * 2);
      const contentHeight = pdfHeight - (marginY * 2);
      
      // Calcular dimensões da imagem mantendo proporção
      const imgAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = contentWidth / contentHeight;
      
      let imgWidthFinal: number;
      let imgHeightFinal: number;
      
      if (imgAspectRatio > pdfAspectRatio) {
        // Imagem é mais larga - ajustar pela largura
        imgWidthFinal = contentWidth;
        imgHeightFinal = contentWidth / imgAspectRatio;
      } else {
        // Imagem é mais alta - ajustar pela altura
        imgHeightFinal = contentHeight;
        imgWidthFinal = contentHeight * imgAspectRatio;
      }

      // Calcular quantas páginas serão necessárias
      const totalPages = Math.ceil(imgHeightFinal / contentHeight);

      // Adicionar imagem página por página
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        if (pageNum > 0) {
          pdf.addPage();
        }

        // Calcular a posição Y do source na imagem original
        const sourceY = (pageNum * contentHeight * canvas.height) / imgHeightFinal;
        const sourceHeight = Math.min(
          (contentHeight * canvas.height) / imgHeightFinal,
          canvas.height - sourceY
        );

        // Criar um canvas temporário para esta página
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        if (pageCtx) {
          // Copiar a porção relevante da imagem original
          pageCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const pageHeightFinal = (sourceHeight * imgWidthFinal) / canvas.width;
          
          // Posição Y na página PDF (sempre começa na margem superior)
          const pdfY = marginY;
          
          // Adicionar imagem centralizada horizontalmente
          pdf.addImage(pageImgData, 'PNG', marginX, pdfY, imgWidthFinal, pageHeightFinal);
        }
      }

      // Salvar PDF
      const finalFileName = fileName || `analise-reuniao-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(finalFileName);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  };

  return (
    <Button
      onClick={handleGeneratePDF}
      variant="outline"
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      Baixar PDF
    </Button>
  );
}
