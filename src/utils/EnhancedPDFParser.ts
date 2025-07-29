// Enhanced PDF Parser with smart header detection and label/data recognition
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
}

export interface HeaderComponent {
  type: 'static-label' | 'dynamic-data' | 'standalone-text';
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
  // For label-data pairs
  pairedWith?: HeaderComponent;
  confidence: number; // 0-1 confidence score for detection accuracy
}

export interface SmartHeaderAnalysis {
  staticLabels: HeaderComponent[];
  dynamicData: HeaderComponent[];
  standaloneText: HeaderComponent[];
  labelDataPairs: Array<{
    label: HeaderComponent;
    data: HeaderComponent;
    proximity: number;
  }>;
}

export interface EnhancedPDFAnalysisResult {
  headerAnalysis: SmartHeaderAnalysis;
  allTextItems: EnhancedPDFTextItem[];
  pageWidth: number;
  pageHeight: number;
  tables: any[]; // Keep existing table detection
}

export class EnhancedPDFParser {
  // Common static labels that are likely to have dynamic data next to them
  private static readonly COMMON_LABELS = [
    'SHIP TO', 'BILL TO', 'SOLD TO', 'FROM', 'TO',
    'DATE', 'ORDER', 'PO', 'INVOICE', 'CUSTOMER',
    'ADDRESS', 'PHONE', 'EMAIL', 'FAX', 'ACCOUNT',
    'REFERENCE', 'TERMS', 'DUE DATE', 'TOTAL',
    'SUBTOTAL', 'TAX', 'AMOUNT', 'QTY', 'QUANTITY',
    'DESCRIPTION', 'PRICE', 'UNIT PRICE', 'NAME',
    'COMPANY', 'ATTENTION', 'ATTN', 'REF', 'ORDER #',
    'INVOICE #', 'CUSTOMER #', 'PAGE', 'PROJECT'
  ];

  static async parsePDF(file: File): Promise<EnhancedPDFAnalysisResult> {
    // Load PDF.js dynamically if not already loaded
    if (!window.pdfjsLib) {
      await this.loadPDFJS();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Process first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    
    // Get text content with enhanced styling information
    const textContent = await page.getTextContent();
    
    const enhancedTextItems = this.extractEnhancedTextItems(textContent, viewport);
    const headerItems = this.identifyHeaderItems(enhancedTextItems, viewport.height);
    const headerAnalysis = this.performSmartHeaderAnalysis(headerItems);
    
    return {
      headerAnalysis,
      allTextItems: enhancedTextItems,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      tables: [] // Keep existing table detection if needed
    };
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
        color: this.extractColor(item) // Extract color if available
      };
    }).filter(item => item.text.length > 0); // Remove empty text items
  }

  private static identifyHeaderItems(textItems: EnhancedPDFTextItem[], pageHeight: number): EnhancedPDFTextItem[] {
    // Enhanced header detection - top 25% of page or items with larger font sizes
    const headerThreshold = pageHeight * 0.25;
    const averageFontSize = textItems.reduce((sum, item) => sum + item.fontSize, 0) / textItems.length;
    const largeFontThreshold = averageFontSize * 1.2;
    
    return textItems.filter(item => 
      item.y <= headerThreshold || 
      item.fontSize >= largeFontThreshold ||
      this.isLikelyHeaderText(item.text)
    );
  }

  private static performSmartHeaderAnalysis(headerItems: EnhancedPDFTextItem[]): SmartHeaderAnalysis {
    const components: HeaderComponent[] = headerItems.map(item => 
      this.createHeaderComponent(item)
    );

    const staticLabels: HeaderComponent[] = [];
    const dynamicData: HeaderComponent[] = [];
    const standaloneText: HeaderComponent[] = [];
    const labelDataPairs: Array<{ label: HeaderComponent; data: HeaderComponent; proximity: number }> = [];

    // Classify each component
    for (const component of components) {
      const classification = this.classifyHeaderComponent(component);
      component.type = classification.type;
      component.confidence = classification.confidence;

      if (classification.type === 'static-label') {
        staticLabels.push(component);
      } else if (classification.type === 'dynamic-data') {
        dynamicData.push(component);
      } else {
        standaloneText.push(component);
      }
    }

    // Find label-data pairs
    for (const label of staticLabels) {
      const nearbyData = this.findNearbyDataForLabel(label, dynamicData.concat(standaloneText));
      if (nearbyData) {
        const proximity = this.calculateProximity(label, nearbyData.component);
        labelDataPairs.push({
          label,
          data: nearbyData.component,
          proximity
        });
        
        // Mark components as paired
        label.pairedWith = nearbyData.component;
        nearbyData.component.pairedWith = label;
      }
    }

    return {
      staticLabels,
      dynamicData,
      standaloneText,
      labelDataPairs
    };
  }

  private static createHeaderComponent(item: EnhancedPDFTextItem): HeaderComponent {
    return {
      type: 'standalone-text', // Will be classified later
      text: item.text,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      color: item.color,
      fontWeight: item.fontWeight,
      isItalic: item.isItalic,
      confidence: 0.5 // Default confidence
    };
  }

  private static classifyHeaderComponent(component: HeaderComponent): { type: HeaderComponent['type']; confidence: number } {
    const text = component.text.toUpperCase().trim();
    
    // Check if it's a known static label
    const isKnownLabel = this.COMMON_LABELS.some(label => 
      text === label || text.includes(label) || text.endsWith(':')
    );
    
    if (isKnownLabel) {
      return { type: 'static-label', confidence: 0.9 };
    }

    // Check patterns that suggest static labels
    if (this.isLikelyStaticLabel(text)) {
      return { type: 'static-label', confidence: 0.7 };
    }

    // Check patterns that suggest dynamic data
    if (this.isLikelyDynamicData(text)) {
      return { type: 'dynamic-data', confidence: 0.8 };
    }

    // Default to standalone text
    return { type: 'standalone-text', confidence: 0.5 };
  }

  private static isLikelyStaticLabel(text: string): boolean {
    return (
      text.endsWith(':') ||
      text.endsWith('#') ||
      /^[A-Z\s]{2,}$/.test(text) && text.length <= 20 ||
      text.includes(' TO ') ||
      text.includes(' NUMBER') ||
      text.includes(' DATE') ||
      text.includes(' CODE')
    );
  }

  private static isLikelyDynamicData(text: string): boolean {
    return (
      /^\d+/.test(text) || // Starts with number
      /\d{2,}/.test(text) || // Contains 2+ digits
      /@/.test(text) || // Email
      /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) || // Date
      /^\$\d/.test(text) || // Price
      text.length > 30 || // Long text likely to be data
      /^[a-z]/.test(text) // Starts with lowercase (likely data, not label)
    );
  }

  private static isLikelyHeaderText(text: string): boolean {
    const upperText = text.toUpperCase();
    return (
      this.COMMON_LABELS.some(label => upperText.includes(label)) ||
      upperText.includes('INVOICE') ||
      upperText.includes('ORDER') ||
      upperText.includes('COMPANY') ||
      /^\d+$/.test(text) // Invoice/order numbers
    );
  }

  private static findNearbyDataForLabel(label: HeaderComponent, candidates: HeaderComponent[]): { component: HeaderComponent; distance: number } | null {
    const maxDistance = 200; // Maximum pixel distance to consider
    let bestCandidate: HeaderComponent | null = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      // Skip if already paired
      if (candidate.pairedWith) continue;

      const distance = this.calculateDistance(label, candidate);
      const isNearby = this.isNearbyComponent(label, candidate, maxDistance);

      if (isNearby && distance < bestDistance) {
        bestCandidate = candidate;
        bestDistance = distance;
      }
    }

    return bestCandidate ? { component: bestCandidate, distance: bestDistance } : null;
  }

  private static isNearbyComponent(comp1: HeaderComponent, comp2: HeaderComponent, maxDistance: number): boolean {
    const distance = this.calculateDistance(comp1, comp2);
    const isRightAdjacent = comp2.x > comp1.x && comp2.x <= comp1.x + comp1.width + maxDistance;
    const isSameRow = Math.abs(comp1.y - comp2.y) <= Math.max(comp1.height, comp2.height);
    
    return distance <= maxDistance && (isRightAdjacent || isSameRow);
  }

  private static calculateDistance(comp1: HeaderComponent, comp2: HeaderComponent): number {
    const dx = Math.abs(comp1.x - comp2.x);
    const dy = Math.abs(comp1.y - comp2.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static calculateProximity(comp1: HeaderComponent, comp2: HeaderComponent): number {
    const distance = this.calculateDistance(comp1, comp2);
    return Math.max(0, 1 - distance / 200); // Normalize to 0-1 scale
  }

  // Font and styling extraction helpers
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
    return 'normal';
  }

  private static extractItalicStyle(fontName: string): boolean {
    const name = fontName.toLowerCase();
    return name.includes('italic') || name.includes('oblique');
  }

  private static extractColor(item: any): string | undefined {
    // PDF.js might provide color information in the item
    // This is a placeholder for color extraction logic
    return undefined; // Default to undefined if no color info available
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
}