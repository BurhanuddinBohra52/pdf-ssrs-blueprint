// PDF.js will be loaded dynamically
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
}

export interface PDFSection {
  type: 'header' | 'body' | 'footer';
  items: PDFTextItem[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFTableCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  column: number;
}

export interface PDFTable {
  cells: PDFTableCell[];
  rows: number;
  columns: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFAnalysisResult {
  sections: PDFSection[];
  tables: PDFTable[];
  allTextItems: PDFTextItem[];
  pageWidth: number;
  pageHeight: number;
}

export class PDFParser {
  static async parsePDF(file: File): Promise<PDFAnalysisResult> {
    // Load PDF.js dynamically
    if (!window.pdfjsLib) {
      // Load PDF.js from CDN
      await this.loadPDFJS();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // For now, process only the first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    
    // Get text content with positioning
    const textContent = await page.getTextContent();
    
    const textItems: PDFTextItem[] = textContent.items.map((item: any) => {
      const transform = item.transform;
      return {
        text: item.str,
        x: transform[4],
        y: viewport.height - transform[5], // Convert PDF coordinate system
        width: item.width || 0,
        height: item.height || transform[0] || 12,
        fontSize: transform[0] || 12,
        fontFamily: item.fontName || 'Arial'
      };
    });

    // Analyze the layout based on your requirements
    const analysis = this.analyzeLayout(textItems, viewport.width, viewport.height);
    
    return {
      sections: analysis.sections,
      tables: analysis.tables,
      allTextItems: textItems,
      pageWidth: viewport.width,
      pageHeight: viewport.height
    };
  }

  private static analyzeLayout(textItems: PDFTextItem[], pageWidth: number, pageHeight: number) {
    const sections: PDFSection[] = [];
    const tables: PDFTable[] = [];

    // Define header area (top 20% of page based on your yellow highlight)
    const headerThreshold = pageHeight * 0.2;
    
    // Define body area (middle section based on your orange highlight)
    const bodyStartThreshold = pageHeight * 0.2;
    const bodyEndThreshold = pageHeight * 0.8;

    // Classify items into sections
    const headerItems = textItems.filter(item => item.y <= headerThreshold);
    const bodyItems = textItems.filter(item => 
      item.y > bodyStartThreshold && item.y <= bodyEndThreshold
    );
    const footerItems = textItems.filter(item => item.y > bodyEndThreshold);

    // Create header section
    if (headerItems.length > 0) {
      sections.push({
        type: 'header',
        items: headerItems,
        boundingBox: this.calculateBoundingBox(headerItems)
      });
    }

    // Create body section and detect tables
    if (bodyItems.length > 0) {
      sections.push({
        type: 'body',
        items: bodyItems,
        boundingBox: this.calculateBoundingBox(bodyItems)
      });

      // Detect table structure in body items
      const detectedTable = this.detectTableStructure(bodyItems);
      if (detectedTable) {
        tables.push(detectedTable);
      }
    }

    // Create footer section
    if (footerItems.length > 0) {
      sections.push({
        type: 'footer',
        items: footerItems,
        boundingBox: this.calculateBoundingBox(footerItems)
      });
    }

    return { sections, tables };
  }

  private static detectTableStructure(items: PDFTextItem[]): PDFTable | null {
    if (items.length < 4) return null; // Need at least 4 items for a table

    // Sort items by Y position (top to bottom), then by X position (left to right)
    const sortedItems = [...items].sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff < 5) { // Same row if Y positions are within 5 units
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    // Group items into rows
    const rows: PDFTextItem[][] = [];
    let currentRow: PDFTextItem[] = [];
    let lastY = sortedItems[0].y;

    for (const item of sortedItems) {
      if (Math.abs(item.y - lastY) > 5) { // New row
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
        }
        currentRow = [item];
        lastY = item.y;
      } else {
        currentRow.push(item);
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    if (rows.length < 2) return null; // Need at least 2 rows

    // Determine number of columns (use the row with most items)
    const maxColumns = Math.max(...rows.map(row => row.length));
    
    // Create table cells
    const cells: PDFTableCell[] = [];
    rows.forEach((row, rowIndex) => {
      row.forEach((item, colIndex) => {
        cells.push({
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          row: rowIndex,
          column: colIndex
        });
      });
    });

    return {
      cells,
      rows: rows.length,
      columns: maxColumns,
      boundingBox: this.calculateBoundingBox(items)
    };
  }

  private static calculateBoundingBox(items: PDFTextItem[]) {
    if (items.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...items.map(item => item.x));
    const maxX = Math.max(...items.map(item => item.x + item.width));
    const minY = Math.min(...items.map(item => item.y));
    const maxY = Math.max(...items.map(item => item.y + item.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private static async loadPDFJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load PDF.js script
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Set worker
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}