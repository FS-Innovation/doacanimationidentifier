import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/db';
import { jsPDF } from 'jspdf';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, selectedIds, executiveBrief, overallSummary } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Filter suggestions if specific IDs provided
    const suggestions = selectedIds?.length
      ? session.suggestions.filter(s => selectedIds.includes(s.id))
      : session.suggestions;

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper to add text with word wrap
    const addWrappedText = (text: string, fontSize: number, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, contentWidth);

      for (const line of lines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += fontSize * 0.5;
      }
      y += 5;
    };

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TAS Analysis Report', margin, y);
    y += 15;

    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    doc.text(`Mode: ${session.mode.toUpperCase()}`, pageWidth - margin - 30, y);
    doc.setTextColor(0, 0, 0);
    y += 15;

    // Executive Brief
    if (executiveBrief) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin - 5, y - 5, contentWidth + 10, 30, 'F');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Brief', margin, y + 5);
      y += 12;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const briefLines = doc.splitTextToSize(executiveBrief, contentWidth);
      for (const line of briefLines) {
        doc.text(line, margin, y);
        y += 5;
      }
      y += 15;
    }

    // Overall Summary
    if (overallSummary) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Overall Summary', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(overallSummary, contentWidth);
      for (const line of summaryLines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      }
      y += 15;
    }

    // Key Sections
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Key Sections (${suggestions.length})`, margin, y);
    y += 12;

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];

      // Check if we need a new page
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      // Section header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin - 5, y - 5, contentWidth + 10, 12, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${suggestion.title}`, margin, y + 3);

      // Score badge
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Score: ${suggestion.score}/10 | Pages: ${suggestion.sectionStart}-${suggestion.sectionEnd}`, pageWidth - margin - 50, y + 3);
      doc.setTextColor(0, 0, 0);
      y += 15;

      // Excerpt
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      const excerptLines = doc.splitTextToSize(`"${suggestion.excerpt}"`, contentWidth - 10);
      for (const line of excerptLines.slice(0, 3)) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin + 5, y);
        y += 5;
      }
      doc.setTextColor(0, 0, 0);
      y += 5;

      // Rationale
      doc.setFont('helvetica', 'normal');
      const rationaleLines = doc.splitTextToSize(suggestion.rationale, contentWidth);
      for (const line of rationaleLines) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      }

      // Animation type tag
      y += 3;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Animation Type: ${suggestion.animationType.replace(/_/g, ' ')}`, margin, y);
      if (suggestion.tags.length > 0) {
        doc.text(`Tags: ${suggestion.tags.join(', ')}`, margin + 60, y);
      }
      doc.setTextColor(0, 0, 0);
      y += 15;
    }

    // Footer on last page
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount} | TAS - Transcript Animation Spotter`,
        pageWidth / 2,
        285,
        { align: 'center' }
      );
    }

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tas-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF export failed' },
      { status: 500 }
    );
  }
}
