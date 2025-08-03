// Enhanced PDF Parser with smart header detection, body analysis, and table creation
import { AIPDFAnalyzer, EnhancedPDFComponent, PDFAnalysisResult, TableStructure } from './AIPDFAnalyzer';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface EnhancedPDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color?: string;
  fontWeight?: string;
  isItalic?: boolean;
  transform: number[];
  rdlRegion?: 'header' | 'body' | 'footer';
}

export interface HeaderComponent {
  type: 'static-label' | 'dynamic-data' | 'standalone-text' | 'table-header' | 'form-label';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color?: string;
  fontWeight?: string;
  isItalic?: boolean;
  pairedWith?: HeaderComponent;
  confidence: number;
  rdlRegion?: 'header' | 'body' | 'footer';
  fieldMapping?: string;
}

export interface SmartHeaderAnalysis {
  staticLabels: HeaderComponent[];
  dynamicData: HeaderComponent[];
  standaloneText: HeaderComponent[];
  tableHeaders: HeaderComponent[];
  labelDataPairs: Array<{
    label: HeaderComponent;
    data: HeaderComponent;
    proximity: number;
  }>;
  aiEnhanced: boolean;
  confidence: number;
}

export interface CompleteDocumentAnalysis {
  headerAnalysis: SmartHeaderAnalysis;
  bodyAnalysis: {
    tables: TableStructure[];
    formFields: Array<{
      label: HeaderComponent;
      data: HeaderComponent;
      confidence: number;
    }>;
    textBlocks: HeaderComponent[];
  };
  footerAnalysis: {
    components: HeaderComponent[];
    pageNumbers: HeaderComponent[];
  };
  allTextItems: EnhancedPDFTextItem[];
  pageWidth: number;
  pageHeight: number;
  rdlCompatible: {
    headerTextboxes: any[];
    tableBodyData: any;
    footerComponents: any[];
  };
}

export class EnhancedPDFParser {
  // Enhanced common labels including table headers and form fields
  private static readonly COMMON_LABELS = [
    'SHIP TO', 'BILL TO', 'SOLD TO', 'FROM', 'TO', 'DATE', 'ORDER', 'PO', 
    'INVOICE', 'CUSTOMER', 'ADDRESS', 'PHONE', 'EMAIL', 'FAX', 'ACCOUNT',
    'REFERENCE', 'TERMS', 'DUE DATE', 'TOTAL', 'SUBTOTAL', 'TAX', 'AMOUNT',
    'QTY', 'QUANTITY', 'DESCRIPTION', 'PRICE', 'UNIT PRICE', 'NAME',
    'COMPANY', 'ATTENTION', 'ATTN', 'REF', 'ORDER #', 'INVOICE #', 
    'CUSTOMER #', 'PAGE', 'PROJECT', 'CONTACT', 'DEPARTMENT'
  ];

  private static readonly TABLE_HEADERS = [
    'ITEM', 'DESCRIPTION', 'QTY', 'QUANTITY', 'PRICE', 'AMOUNT', 'TOTAL',
    'UNIT PRICE', 'LINE TOTAL', 'PRODUCT', 'SERVICE', 'HOURS', 'RATE',
    'COST', 'DISCOUNT', 'TAX', 'SUBTOTAL', 'CODE', 'PART', 'MODEL'
  ];

  static async parsePDF(file: File): Promise<CompleteDocumentAnalysis> {
    // Load PDF.js dynamically if not already loaded
    if (!window.pdfjsLib) {
      await this.loadPDFJS();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Process first page (can be extended for multi-page)
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    
    // Get text content with enhanced styling information
    const textContent = await page.getTextContent();
    const enhancedTextItems = this.extractEnhancedTextItems(textContent, viewport);
    
    // Perform comprehensive document analysis
    const documentAnalysis = await this.performCompleteDocumentAnalysis(
      enhancedTextItems, 
      viewport.width, 
      viewport.height
    );
    
    return documentAnalysis;
  }

  private static extractEnhancedTextItems(textContent: any, viewport: any): EnhancedPDFTextItem[] {
    return textContent.items.map((item: any) => {
      const transform = item.transform;
      const fontSize = Math.abs(transform[0] || 12);
      
      // Extract styling information from PDF.js item
      const fontName = item.fontName || 'Arial';
      const fontFamily = this.normalizeFontFamily(fontName);
      const fontWeight = this.extractFontWeight(fontName);
      const isItalic = this.extractItalicStyle(fontName);
      
      return {
        text: item.str?.trim() || '',
        x: transform[4],
        y: viewport.height - transform[5], // Convert PDF coordinate system
        width: item.width || 0,
        height: fontSize,
        fontSize,
        fontFamily,
        fontWeight,
        isItalic,
        transform,
        color: this.extractColor(item)
      };
    }).filter(item => item.text.length > 0);
  }

  private static async performCompleteDocumentAnalysis(
    textItems: EnhancedPDFTextItem[], 
    pageWidth: number, 
    pageHeight: number
  ): Promise<CompleteDocumentAnalysis> {
    
    // Step 1: Convert to enhanced components for AI analysis
    const enhancedComponents: EnhancedPDFComponent[] = textItems.map(item => ({
      text: item.text,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      color: item.color,
      fontWeight: item.fontWeight,
      isItalic: item.isItalic
    }));

    // Step 2: Perform AI-powered complete document analysis
    const aiAnalysisResult = await AIPDFAnalyzer.analyzeDocument(enhancedComponents);
    
    // Step 3: Process AI results and create comprehensive analysis
    const completeAnalysis = this.processAIAnalysisResults(
      aiAnalysisResult, 
      textItems, 
      pageWidth, 
      pageHeight
    );
    
    return completeAnalysis;
  }

  private static processAIAnalysisResults(
    aiResult: PDFAnalysisResult,
    originalTextItems: EnhancedPDFTextItem[],
    pageWidth: number,
    pageHeight: number
  ): CompleteDocumentAnalysis {
    
    // Assign RDL regions to original text items based on AI analysis
    const textItemsWithRegions = this.assignRDLRegions(originalTextItems, aiResult);
    
    // Process header analysis
    const headerAnalysis = this.createSmartHeaderAnalysis(aiResult.headerComponents);
    
    // Process body analysis (tables and form fields)
    const bodyAnalysis = this.createBodyAnalysis(aiResult);
    
    // Process footer analysis
    const footerAnalysis = this.createFooterAnalysis(aiResult.footerComponents);
    
    // Create RDL-compatible data structures
    const rdlCompatible = this.createRDLCompatibleStructures(aiResult);
    
    return {
      headerAnalysis,
      bodyAnalysis,
      footerAnalysis,
      allTextItems: textItemsWithRegions,
      pageWidth,
      pageHeight,
      rdlCompatible
    };
  }

  private static assignRDLRegions(
    textItems: EnhancedPDFTextItem[], 
    aiResult: PDFAnalysisResult
  ): EnhancedPDFTextItem[] {
    
    return textItems.map(item => {
      // Find corresponding component in AI analysis
      const headerComponent = aiResult.headerComponents.find(h => 
        h.text === item.text && Math.abs(h.x - item.x) < 5 && Math.abs(h.y - item.y) < 5
      );
      const bodyComponent = aiResult.bodyComponents.find(b => 
        b.text === item.text && Math.abs(b.x - item.x) < 5 && Math.abs(b.y - item.y) < 5
      );
      const footerComponent = aiResult.footerComponents.find(f => 
        f.text === item.text && Math.abs(f.x - item.x) < 5 && Math.abs(f.y - item.y) < 5
      );
      
      let rdlRegion: 'header' | 'body' | 'footer' = 'body'; // default
      if (headerComponent) rdlRegion = 'header';
      else if (footerComponent) rdlRegion = 'footer';
      
      return {
        ...item,
        rdlRegion
      };
    });
  }

  private static createSmartHeaderAnalysis(headerComponents: EnhancedPDFComponent[]): SmartHeaderAnalysis {
    const staticLabels: HeaderComponent[] = [];
    const dynamicData: HeaderComponent[] = [];
    const standaloneText: HeaderComponent[] = [];
    const tableHeaders: HeaderComponent[] = [];
    
    // Convert enhanced components to header components with classification
    for (const component of headerComponents) {
      const headerComponent: HeaderComponent = {
        type: (component.aiClassification?.label as HeaderComponent['type']) || 'standalone-text',
        text: component.text,
        x: component.x,
        y: component.y,
        width: component.width,
        height: component.height,
        fontSize: component.fontSize,
        fontFamily: component.fontFamily,
        color: component.color,
        fontWeight: component.fontWeight,
        isItalic: component.isItalic,
        confidence: component.aiClassification?.score || 0.5,
        rdlRegion: 'header',
        fieldMapping: component.fieldMapping
      };
      
      switch (headerComponent.type) {
        case 'static-label':
        case 'form-label':
          staticLabels.push(headerComponent);
          break;
        case 'dynamic-data':
          dynamicData.push(headerComponent);
          break;
        case 'table-header':
          tableHeaders.push(headerComponent);
          break;
        default:
          standaloneText.push(headerComponent);
      }
    }
    
    // Find label-data pairs using AI insights
    const labelDataPairs = this.findEnhancedLabelDataPairs(staticLabels, [...dynamicData, ...standaloneText]);
    
    const allComponents = [...staticLabels, ...dynamicData, ...standaloneText, ...tableHeaders];
    const confidence = this.calculateAverageConfidence(allComponents);
    
    return {
      staticLabels,
      dynamicData,
      standaloneText,
      tableHeaders,
      labelDataPairs,
      aiEnhanced: true,
      confidence
    };
  }

  private static createBodyAnalysis(aiResult: PDFAnalysisResult): {
    tables: TableStructure[];
    formFields: Array<{ label: HeaderComponent; data: HeaderComponent; confidence: number }>;
    textBlocks: HeaderComponent[];
  } {
    
    // Convert AI table structures to our format
    const tables = aiResult.tables;
    
    // Extract form fields from label-data pairs in body region
    const formFields = aiResult.labelDataPairs
      .filter(pair => {
        const labelInBody = aiResult.bodyComponents.some(b => 
          b.text === pair.label.text && Math.abs(b.x - pair.label.x) < 5
        );
        return labelInBody;
      })
      .map(pair => ({
        label: this.convertEnhancedToHeader(pair.label, 'body'),
        data: this.convertEnhancedToHeader(pair.data, 'body'),
        confidence: pair.confidence
      }));
    
    // Convert body components that aren't in tables or form fields to text blocks
    const textBlocks = aiResult.bodyComponents
      .filter(component => {
        const inTable = tables.some(table => 
          table.headers.some(h => h.text === component.text) ||
          table.rows.some(row => row.some(cell => cell.text === component.text))
        );
        const inFormField = formFields.some(field => 
          field.label.text === component.text || field.data.text === component.text
        );
        return !inTable && !inFormField;
      })
      .map(component => this.convertEnhancedToHeader(component, 'body'));
    
    return {
      tables,
      formFields,
      textBlocks
    };
  }

  private static createFooterAnalysis(footerComponents: EnhancedPDFComponent[]): {
    components: HeaderComponent[];
    pageNumbers: HeaderComponent[];
  } {
    
    const components = footerComponents.map(component => 
      this.convertEnhancedToHeader(component, 'footer')
    );
    
    // Identify page numbers
    const pageNumbers = components.filter(component => 
      /^page\s+\d+|^\d+\s+of\s+\d+|\d+$/.test(component.text.toLowerCase())
    );
    
    return {
      components,
      pageNumbers
    };
  }

  private static createRDLCompatibleStructures(aiResult: PDFAnalysisResult): {
    headerTextboxes: any[];
    tableBodyData: any;
    footerComponents: any[];
  } {
    
    // Convert using AI analyzer's conversion methods
    const { headerTextboxes, tableBodyData } = AIPDFAnalyzer.convertToRDLFormats(aiResult);
    
    // Convert footer components
    const footerComponents = aiResult.footerComponents.map((component, index) => ({
      name: `Footer_${index + 1}`,
      value: component.text,
      top: `${(component.y / 72).toFixed(4)}in`,
      left: `${(component.x / 72).toFixed(4)}in`,
      width: `${(component.width / 72).toFixed(4)}in`,
      height: `${(component.height / 72).toFixed(4)}in`,
      fontSize: `${component.fontSize || 10}pt`,
      fontFamily: component.fontFamily || 'Arial',
      fontWeight: component.fontWeight || 'Normal',
      type: component.aiClassification?.label || 'standalone-text'
    }));
    
    return {
      headerTextboxes,
      tableBodyData,
      footerComponents
    };
  }

  private static findEnhancedLabelDataPairs(
    labels: HeaderComponent[], 
    dataComponents: HeaderComponent[]
  ): Array<{ label: HeaderComponent; data: HeaderComponent; proximity: number }> {
    
    const pairs: Array<{ label: HeaderComponent; data: HeaderComponent; proximity: number }> = [];
    const usedDataComponents = new Set<HeaderComponent>();
    
    for (const label of labels) {
      const candidates = dataComponents.filter(data => 
        !usedDataComponents.has(data) && this.isValidLabelDataPair(label, data)
      );
      
      if (candidates.length > 0) {
        const closest = candidates.reduce((prev, curr) => 
          this.calculateDistance(label, curr) < this.calculateDistance(label, prev) ? curr : prev
        );
        
        const proximity = this.calculateProximity(label, closest);
        
        if (proximity > 0.3) { // Minimum proximity threshold
          pairs.push({ label, data: closest, proximity });
          usedDataComponents.add(closest);
          
          // Mark as paired
          label.pairedWith = closest;
          closest.pairedWith = label;
        }
      }
    }
    
    return pairs;
  }

  private static isValidLabelDataPair(label: HeaderComponent, data: HeaderComponent): boolean {
    const distance = this.calculateDistance(label, data);
    const maxDistance = 300; // pixels
    
    // Check spatial relationship (right or below)
    const isToRight = data.x > label.x + label.width && Math.abs(data.y - label.y) < 30;
    const isBelow = data.y > label.y + label.height && Math.abs(data.x - label.x) < 100;
    
    return distance <= maxDistance && (isToRight || isBelow);
  }

  private static convertEnhancedToHeader(
    enhanced: EnhancedPDFComponent, 
    region: 'header' | 'body' | 'footer'
  ): HeaderComponent {
    return {
      type: (enhanced.aiClassification?.label as HeaderComponent['type']) || 'standalone-text',
      text: enhanced.text,
      x: enhanced.x,
      y: enhanced.y,
      width: enhanced.width,
      height: enhanced.height,
      fontSize: enhanced.fontSize,
      fontFamily: enhanced.fontFamily,
      color: enhanced.color,
      fontWeight: enhanced.fontWeight,
      isItalic: enhanced.isItalic,
      confidence: enhanced.aiClassification?.score || 0.5,
      rdlRegion: region,
      fieldMapping: enhanced.fieldMapping
    };
  }

  private static calculateDistance(comp1: HeaderComponent, comp2: HeaderComponent): number {
    const dx = Math.abs(comp1.x - comp2.x);
    const dy = Math.abs(comp1.y - comp2.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static calculateProximity(comp1: HeaderComponent, comp2: HeaderComponent): number {
    const distance = this.calculateDistance(comp1, comp2);
    return Math.max(0, 1 - distance / 300); // Normalize to 0-1 scale
  }

  private static calculateAverageConfidence(components: HeaderComponent[]): number {
    if (components.length === 0) return 0;
    const totalConfidence = components.reduce((sum, comp) => sum + comp.confidence, 0);
    return totalConfidence / components.length;
  }

  // Font and styling extraction helpers (unchanged)
  private static normalizeFontFamily(fontName: string): string {
    const cleanName = fontName.replace(/[+-]/g, '').toLowerCase();
    if (cleanName.includes('arial')) return 'Arial';
    if (cleanName.includes('helvetica')) return 'Helvetica';
    if (cleanName.includes('times')) return 'Times New Roman';
    if (cleanName.includes('courier')) return 'Courier New';
    return fontName.split(/[+-]/)[0] || 'Arial';
  }

  private static extractFontWeight(fontName: string): string {
    const name = fontName.toLowerCase();
    if (name.includes('bold')) return 'bold';
    if (name.includes('light')) return 'light';
    if (name.includes('medium')) return 'medium';
    return 'Normal';
  }

  private static extractItalicStyle(fontName: string): boolean {
    const name = fontName.toLowerCase();
    return name.includes('italic') || name.includes('oblique');
  }

  private static extractColor(item: any): string | undefined {
    // Extract color information if available in PDF.js
    return item.color || undefined;
  }

  private static async loadPDFJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Utility method for easy integration with RDL generators
  static async parseAndConvertForRDL(file: File): Promise<{
    headerTextboxes: any[];
    tableBodyData: any;
    footerComponents: any[];
    fullAnalysis: CompleteDocumentAnalysis;
  }> {
    const analysis = await this.parsePDF(file);
    
    return {
      headerTextboxes: analysis.rdlCompatible.headerTextboxes,
      tableBodyData: analysis.rdlCompatible.tableBodyData,
      footerComponents: analysis.rdlCompatible.footerComponents,
      fullAnalysis: analysis
    };
  }
}

// Export utility function for easy usage
export const parseAndGenerateRDL = async (
  pdfFile: File, 
  baseRDL: string
): Promise<{ rdl: string; analysis: CompleteDocumentAnalysis }> => {
  
  // Parse PDF with complete analysis
  const { headerTextboxes, tableBodyData, footerComponents, fullAnalysis } = 
    await EnhancedPDFParser.parseAndConvertForRDL(pdfFile);
  
  // Import RDLHeaderGenerator dynamically to avoid circular imports
  const { RDLHeaderGenerator } = await import('./RDLHeaderGenerator');
  
  // Generate complete RDL
  const finalRDL = RDLHeaderGenerator.generateExecutableRDL(
    baseRDL,
    headerTextboxes,
    tableBodyData
  );
  
  return {
    rdl: finalRDL,
    analysis: fullAnalysis
  };
};
