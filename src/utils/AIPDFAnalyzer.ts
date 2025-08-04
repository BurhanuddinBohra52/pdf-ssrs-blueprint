// Enhanced AI-powered PDF analyzer for better RDL integration
import { pipeline } from '@huggingface/transformers';

export interface AIClassificationResult {
  label: 'static-label' | 'dynamic-data' | 'standalone-text' | 'table-header' | 'table-data' | 'form-label';
  score: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EnhancedPDFComponent {
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
  aiClassification?: AIClassificationResult;
  context?: {
    nearbyText: string[];
    position: 'left' | 'right' | 'above' | 'below' | 'isolated';
    isInTable?: boolean;
    tableColumn?: number;
    tableRow?: number;
  };
  rdlType?: 'header' | 'body' | 'footer';
  fieldMapping?: string; // For RDL field mapping
}

export interface TableStructure {
  headers: EnhancedPDFComponent[];
  rows: EnhancedPDFComponent[][];
  bounds: { x: number; y: number; width: number; height: number };
  columnCount: number;
  rowCount: number;
}

export interface PDFAnalysisResult {
  headerComponents: EnhancedPDFComponent[];
  bodyComponents: EnhancedPDFComponent[];
  footerComponents: EnhancedPDFComponent[];
  tables: TableStructure[];
  labelDataPairs: Array<{
    label: EnhancedPDFComponent;
    data: EnhancedPDFComponent;
    confidence: number;
  }>;
  fieldMappings: { [key: string]: string };
}

export class AIPDFAnalyzer {
  private static textClassifier: any = null;
  private static isLoading = false;

  static async initializeModel(): Promise<void> {
    if (this.textClassifier || this.isLoading) return;
    
    this.isLoading = true;
    try {
      // Use a more suitable model for document classification
      this.textClassifier = await pipeline(
        'zero-shot-classification',
        'facebook/bart-large-mnli',
        {
          device: 'webgpu'
        }
      );
      console.log('AI model initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize WebGPU, falling back to CPU');
      try {
        this.textClassifier = await pipeline(
          'zero-shot-classification',
          'microsoft/DialoGPT-medium'
        );
      } catch (fallbackError) {
        console.error('Failed to initialize AI model:', fallbackError);
        this.textClassifier = null;
      }
    } finally {
      this.isLoading = false;
    }
  }

  static async analyzeDocument(components: EnhancedPDFComponent[]): Promise<PDFAnalysisResult> {
    // Initialize model if needed
    await this.initializeModel();

    // Step 1: Classify all components
    const classifiedComponents = await this.analyzeComponents(components);

    // Step 2: Detect document structure (header, body, footer)
    const structuredComponents = this.analyzeDocumentStructure(classifiedComponents);

    // Step 3: Detect and analyze tables
    const tables = await this.detectTables(structuredComponents);

    // Step 4: Find label-data pairs for form fields
    const labelDataPairs = this.findLabelDataPairs(structuredComponents);

    // Step 5: Generate field mappings for RDL
    const fieldMappings = this.generateFieldMappings(structuredComponents, tables);

    // Step 6: Separate components by document region
    const headerComponents = structuredComponents.filter(c => c.rdlType === 'header');
    const bodyComponents = structuredComponents.filter(c => c.rdlType === 'body');
    const footerComponents = structuredComponents.filter(c => c.rdlType === 'footer');

    return {
      headerComponents,
      bodyComponents,
      footerComponents,
      tables,
      labelDataPairs,
      fieldMappings
    };
  }

  static async analyzeComponents(components: EnhancedPDFComponent[]): Promise<EnhancedPDFComponent[]> {
    const enhancedComponents = await Promise.all(
      components.map(async (component) => {
        const aiClassification = await this.classifyTextComponent(component);
        const context = this.analyzeContext(component, components);
        
        return {
          ...component,
          aiClassification,
          context
        };
      })
    );

    return enhancedComponents;
  }

  private static analyzeDocumentStructure(components: EnhancedPDFComponent[]): EnhancedPDFComponent[] {
    if (components.length === 0) return components;

    // Sort by Y position to determine page layout
    const sortedByY = [...components].sort((a, b) => a.y - b.y);
    
    // Determine page dimensions
    const maxY = Math.max(...components.map(c => c.y + c.height));
    const minY = Math.min(...components.map(c => c.y));
    const pageHeight = maxY - minY;
    
    // Define regions (adjust thresholds as needed)
    const headerThreshold = minY + (pageHeight * 0.15); // Top 15%
    const footerThreshold = maxY - (pageHeight * 0.15); // Bottom 15%

    return components.map(component => {
      let rdlType: 'header' | 'body' | 'footer' = 'body';
      
      if (component.y < headerThreshold) {
        rdlType = 'header';
      } else if (component.y + component.height > footerThreshold) {
        rdlType = 'footer';
      }
      
      return {
        ...component,
        rdlType
      };
    });
  }

  private static async detectTables(components: EnhancedPDFComponent[]): Promise<TableStructure[]> {
    const tables: TableStructure[] = [];
    const processedComponents = new Set<EnhancedPDFComponent>();

    // Group components by approximate rows (Y positions)
    const rowGroups = this.groupByRows(components, 10); // 10px tolerance

    for (const rowGroup of rowGroups) {
      if (rowGroup.length < 2) continue; // Need at least 2 components for a table row

      // Sort by X position
      const sortedRow = rowGroup.sort((a, b) => a.x - b.x);
      
      // Check if this could be a table header (bold text, consistent spacing)
      const isTableHeader = this.isLikelyTableHeader(sortedRow);
      
      if (isTableHeader) {
        // Find following rows that align with this header
        const tableRows = this.findAlignedRows(sortedRow, components);
        
        if (tableRows.length > 0) {
          const table = this.createTableStructure(sortedRow, tableRows);
          tables.push(table);
          
          // Mark components as processed
          sortedRow.forEach(comp => processedComponents.add(comp));
          tableRows.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(comp => processedComponents.add(comp));
            } else {
              processedComponents.add(row);
            }
          });
        }
      }
    }

    // Update components with table context
    components.forEach(component => {
      const table = tables.find(t => 
        t.headers.includes(component) || 
        t.rows.some(row => row.includes(component))
      );
      
      if (table) {
        const headerIndex = table.headers.indexOf(component);
        if (headerIndex !== -1) {
          component.context = {
            ...component.context,
            isInTable: true,
            tableColumn: headerIndex,
            tableRow: 0
          };
        } else {
          // Find row and column for data cells
          for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
            const colIndex = table.rows[rowIndex].indexOf(component);
            if (colIndex !== -1) {
              component.context = {
                ...component.context,
                isInTable: true,
                tableColumn: colIndex,
                tableRow: rowIndex + 1
              };
              break;
            }
          }
        }
      }
    });

    return tables;
  }

  private static groupByRows(components: EnhancedPDFComponent[], tolerance: number): EnhancedPDFComponent[][] {
    const sorted = [...components].sort((a, b) => a.y - b.y);
    const groups: EnhancedPDFComponent[][] = [];
    let currentGroup: EnhancedPDFComponent[] = [];
    let currentY = -1;

    for (const component of sorted) {
      if (currentY === -1 || Math.abs(component.y - currentY) <= tolerance) {
        currentGroup.push(component);
        currentY = currentY === -1 ? component.y : (currentY + component.y) / 2;
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [component];
        currentY = component.y;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private static isLikelyTableHeader(components: EnhancedPDFComponent[]): boolean {
    if (components.length < 2) return false;

    // Check for characteristics of table headers
    const boldCount = components.filter(c => c.fontWeight === 'bold').length;
    const hasTypicalHeaders = components.some(c => 
      /^(description|qty|quantity|price|amount|total|date|item|product|name)/i.test(c.text.trim())
    );

    // Check for consistent spacing
    const xPositions = components.map(c => c.x).sort((a, b) => a - b);
    const spacings = [];
    for (let i = 1; i < xPositions.length; i++) {
      spacings.push(xPositions[i] - xPositions[i-1]);
    }
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const consistentSpacing = spacings.every(s => Math.abs(s - avgSpacing) < avgSpacing * 0.3);

    return (boldCount > components.length * 0.5) || hasTypicalHeaders || consistentSpacing;
  }

  private static findAlignedRows(headerRow: EnhancedPDFComponent[], allComponents: EnhancedPDFComponent[]): EnhancedPDFComponent[][] {
    const tolerance = 20; // pixels
    const headerY = headerRow[0].y;
    const headerXPositions = headerRow.map(h => h.x).sort((a, b) => a - b);
    
    // Find components below the header
    const belowComponents = allComponents.filter(c => c.y > headerY + 20);
    
    // Group by rows
    const rowGroups = this.groupByRows(belowComponents, 10);
    
    const alignedRows: EnhancedPDFComponent[][] = [];
    
    for (const rowGroup of rowGroups) {
      // Check if this row aligns with header columns
      const sortedRow = rowGroup.sort((a, b) => a.x - b.x);
      
      if (sortedRow.length >= Math.max(2, headerRow.length * 0.5)) {
        // Check alignment with header positions
        let alignmentScore = 0;
        
        for (const comp of sortedRow) {
          const closestHeaderX = headerXPositions.reduce((prev, curr) => 
            Math.abs(curr - comp.x) < Math.abs(prev - comp.x) ? curr : prev
          );
          
          if (Math.abs(comp.x - closestHeaderX) < tolerance) {
            alignmentScore++;
          }
        }
        
        if (alignmentScore >= sortedRow.length * 0.6) {
          alignedRows.push(sortedRow);
        }
      }
    }
    
    return alignedRows;
  }

  private static createTableStructure(headers: EnhancedPDFComponent[], rows: EnhancedPDFComponent[][]): TableStructure {
    const allComponents: EnhancedPDFComponent[] = [...headers];
    rows.forEach(row => {
      if (Array.isArray(row)) {
        allComponents.push(...row);
      } else {
        allComponents.push(row);
      }
    });
    
    const minX = Math.min(...allComponents.map(c => c.x));
    const minY = Math.min(...allComponents.map(c => c.y));
    const maxX = Math.max(...allComponents.map(c => c.x + c.width));
    const maxY = Math.max(...allComponents.map(c => c.y + c.height));

    return {
      headers,
      rows,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      columnCount: headers.length,
      rowCount: rows.length
    };
  }

  private static async classifyTextComponent(component: EnhancedPDFComponent): Promise<AIClassificationResult> {
    const text = component.text.trim();
    
    // Enhanced rule-based classification
    const ruleBasedResult = this.enhancedRuleBasedClassification(text, component);
    
    // If rule-based is confident, use it
    if (ruleBasedResult.score > 0.8) {
      return ruleBasedResult;
    }

    // Use AI model for uncertain cases
    if (this.textClassifier) {
      try {
        const aiResult = await this.aiClassificationZeroShot(text, component);
        return this.combineClassifications(ruleBasedResult, aiResult);
      } catch (error) {
        console.warn('AI classification failed, using rule-based:', error);
      }
    }

    return ruleBasedResult;
  }

  private static enhancedRuleBasedClassification(text: string, component: EnhancedPDFComponent): AIClassificationResult {
    const upperText = text.toUpperCase().trim();
    
    // Enhanced patterns for better detection
    const staticLabelPatterns = [
      /^(SHIP\s?TO|BILL\s?TO|SOLD\s?TO|FROM|TO|DATE|ORDER|PO|INVOICE|CUSTOMER|CLIENT):?$/i,
      /^[A-Z\s]{2,25}:$/,
      /^(TOTAL|SUBTOTAL|TAX|AMOUNT|QTY|QUANTITY|DESCRIPTION|PRICE|UNIT\s?PRICE|ITEM|PRODUCT):?$/i,
      /^(NAME|COMPANY|ADDRESS|PHONE|EMAIL|FAX|ACCOUNT|ID|NUMBER):?$/i,
      /^(DUE\s?DATE|PAYMENT\s?TERMS|REFERENCE|ORDER\s?DATE):?$/i
    ];

    const tableHeaderPatterns = [
      /^(ITEM|DESCRIPTION|QTY|QUANTITY|PRICE|AMOUNT|TOTAL|UNIT|RATE|TAX)$/i,
      /^(PRODUCT|SERVICE|HOURS|COST|SUBTOTAL|DISCOUNT)$/i
    ];

    const dynamicDataPatterns = [
      /^\d+([.,]\d+)*$/, // Numbers
      /^\$[\d,]+(\.\d{2})?$/, // Currency
      /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/, // Dates
      /@[\w.-]+\.\w+/, // Emails
      /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/, // Phone numbers
      /^[a-z]/, // Starts with lowercase (often data)
      /.{30,}/, // Long text (likely data)
      /^\d+$/, // Pure numbers
      /^[A-Z0-9]+[-_][A-Z0-9]+/, // Codes/IDs
    ];

    // Check for table headers first
    if (tableHeaderPatterns.some(pattern => pattern.test(text))) {
      return {
        label: 'table-header',
        score: 0.95,
        reasoning: 'Matches table header patterns',
        confidence: 'high'
      };
    }

    // Check for static label patterns
    if (staticLabelPatterns.some(pattern => pattern.test(text))) {
      return {
        label: 'static-label',
        score: 0.9,
        reasoning: 'Matches known static label patterns',
        confidence: 'high'
      };
    }

    // Check for dynamic data patterns
    if (dynamicDataPatterns.some(pattern => pattern.test(text))) {
      return {
        label: 'dynamic-data',
        score: 0.85,
        reasoning: 'Matches known dynamic data patterns',
        confidence: 'high'
      };
    }

    // Enhanced font-based hints
    if (component.fontWeight === 'bold') {
      if (text.length < 20 && text.includes(':')) {
        return {
          label: 'static-label',
          score: 0.8,
          reasoning: 'Bold text with colon suggests form label',
          confidence: 'medium'
        };
      } else if (text.length < 15) {
        return {
          label: 'table-header',
          score: 0.75,
          reasoning: 'Bold and short text suggests table header',
          confidence: 'medium'
        };
      }
    }

    // Size-based hints
    if (component.fontSize && component.fontSize > 14) {
      return {
        label: 'static-label',
        score: 0.7,
        reasoning: 'Large font size suggests header/label',
        confidence: 'medium'
      };
    }

    // Position-based hints
    if (component.context?.position === 'left' && text.endsWith(':')) {
      return {
        label: 'static-label',
        score: 0.75,
        reasoning: 'Left-positioned text with colon suggests label',
        confidence: 'medium'
      };
    }

    // Default classification
    return {
      label: 'standalone-text',
      score: 0.5,
      reasoning: 'Could not determine specific type',
      confidence: 'low'
    };
  }

  private static async aiClassificationZeroShot(text: string, component: EnhancedPDFComponent): Promise<AIClassificationResult> {
    if (!this.textClassifier) {
      throw new Error('AI model not initialized');
    }

    const candidateLabels = [
      'form label',
      'table header',
      'data value',
      'title or heading',
      'address information',
      'monetary amount',
      'date or time',
      'contact information'
    ];

    try {
      const result = await this.textClassifier(text, candidateLabels);
      const topResult = result.labels[0];
      const score = result.scores[0];

      let mappedLabel: 'static-label' | 'dynamic-data' | 'standalone-text' | 'table-header' | 'table-data' | 'form-label';
      
      switch (topResult) {
        case 'form label':
        case 'title or heading':
          mappedLabel = 'static-label';
          break;
        case 'table header':
          mappedLabel = 'table-header';
          break;
        case 'data value':
        case 'monetary amount':
        case 'date or time':
        case 'contact information':
        case 'address information':
          mappedLabel = 'dynamic-data';
          break;
        default:
          mappedLabel = 'standalone-text';
      }

      return {
        label: mappedLabel,
        score: score,
        reasoning: `AI classified as: ${topResult}`,
        confidence: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low'
      };
    } catch (error) {
      throw new Error(`AI classification failed: ${error}`);
    }
  }

  private static combineClassifications(
    ruleBased: AIClassificationResult, 
    aiResult: AIClassificationResult
  ): AIClassificationResult {
    const ruleWeight = 0.7;
    const aiWeight = 0.3;
    
    if (ruleBased.label === aiResult.label) {
      const combinedScore = (ruleBased.score * ruleWeight) + (aiResult.score * aiWeight);
      return {
        label: ruleBased.label,
        score: combinedScore,
        reasoning: `Combined: ${ruleBased.reasoning} + ${aiResult.reasoning}`,
        confidence: combinedScore > 0.8 ? 'high' : combinedScore > 0.6 ? 'medium' : 'low'
      };
    }
    
    // If they disagree, use the higher confidence one
    return ruleBased.score > aiResult.score ? ruleBased : aiResult;
  }

  private static analyzeContext(
    component: EnhancedPDFComponent, 
    allComponents: EnhancedPDFComponent[]
  ): { nearbyText: string[]; position: 'left' | 'right' | 'above' | 'below' | 'isolated' } {
    const proximityThreshold = 150; // Increased for better context detection
    const nearbyComponents = allComponents.filter(other => 
      other !== component && 
      this.calculateDistance(component, other) < proximityThreshold
    );

    const nearbyText = nearbyComponents.map(c => c.text);
    
    let position: 'left' | 'right' | 'above' | 'below' | 'isolated' = 'isolated';
    
    if (nearbyComponents.length > 0) {
      const tolerance = 20; // pixels
      
      // Find components in same row (similar Y position)
      const sameRow = nearbyComponents.filter(c => Math.abs(c.y - component.y) < tolerance);
      
      if (sameRow.length > 0) {
        const rightComponents = sameRow.filter(c => c.x > component.x + component.width);
        const leftComponents = sameRow.filter(c => c.x + c.width < component.x);
        
        if (rightComponents.length > 0) position = 'right';
        else if (leftComponents.length > 0) position = 'left';
      } else {
        // Check vertical relationships
        const belowComponents = nearbyComponents.filter(c => c.y > component.y + component.height);
        const aboveComponents = nearbyComponents.filter(c => c.y + c.height < component.y);
        
        if (belowComponents.length > 0) position = 'below';
        else if (aboveComponents.length > 0) position = 'above';
      }
    }

    return { nearbyText, position };
  }

  private static calculateDistance(comp1: EnhancedPDFComponent, comp2: EnhancedPDFComponent): number {
    const centerX1 = comp1.x + comp1.width / 2;
    const centerY1 = comp1.y + comp1.height / 2;
    const centerX2 = comp2.x + comp2.width / 2;
    const centerY2 = comp2.y + comp2.height / 2;
    
    const dx = centerX1 - centerX2;
    const dy = centerY1 - centerY2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static findLabelDataPairs(components: EnhancedPDFComponent[]): Array<{
    label: EnhancedPDFComponent;
    data: EnhancedPDFComponent;
    confidence: number;
  }> {
    const labels = components.filter(c => 
      c.aiClassification?.label === 'static-label' || 
      c.aiClassification?.label === 'form-label'
    );
    const dataComponents = components.filter(c => 
      c.aiClassification?.label === 'dynamic-data' ||
      c.aiClassification?.label === 'table-data'
    );
    
    const pairs: Array<{ label: EnhancedPDFComponent; data: EnhancedPDFComponent; confidence: number }> = [];
    const usedDataComponents = new Set<EnhancedPDFComponent>();
    
    for (const label of labels) {
      const candidates = dataComponents.filter(data => 
        !usedDataComponents.has(data) && (
          // To the right in same row
          (data.x > label.x + label.width && Math.abs(data.y - label.y) < 30) ||
          // Below with similar X alignment
          (data.y > label.y + label.height && Math.abs(data.x - label.x) < 50) ||
          // Direct horizontal alignment (form fields)
          (Math.abs(data.y - label.y) < 10 && data.x > label.x + label.width && data.x < label.x + label.width + 200)
        )
      );
      
      if (candidates.length > 0) {
        const closest = candidates.reduce((prev, curr) => 
          this.calculateDistance(label, curr) < this.calculateDistance(label, prev) ? curr : prev
        );
        
        const distance = this.calculateDistance(label, closest);
        const confidence = Math.max(0, 1 - distance / 300);
        
        if (confidence > 0.4) {
          pairs.push({ label, data: closest, confidence });
          usedDataComponents.add(closest);
          
          // Set field mapping for RDL generation
          closest.fieldMapping = this.generateFieldName(label.text);
        }
      }
    }
    
    return pairs;
  }

  private static generateFieldMappings(components: EnhancedPDFComponent[], tables: TableStructure[]): { [key: string]: string } {
    const fieldMappings: { [key: string]: string } = {};
    
    // Generate mappings for table headers
    tables.forEach((table, tableIndex) => {
      table.headers.forEach((header, colIndex) => {
        const fieldName = this.generateFieldName(header.text);
        fieldMappings[`Table${tableIndex}_${fieldName}`] = fieldName;
        header.fieldMapping = fieldName;
      });
    });
    
    // Generate mappings for form fields
    components.forEach(component => {
      if (component.fieldMapping) {
        fieldMappings[component.text] = component.fieldMapping;
      }
    });
    
    return fieldMappings;
  }

  private static generateFieldName(text: string): string {
    return text
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .trim()
      .split(/\s+/)
      .map((word, index) => 
        index === 0 
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('')
      .replace(/\s/g, '');
  }

  // Utility method to convert analysis results to RDL-compatible formats
  static convertToRDLFormats(analysisResult: PDFAnalysisResult): {
    headerTextboxes: any[];
    tableBodyData: any;
  } {
    // Convert header components to HeaderTextbox format
    const headerTextboxes = analysisResult.headerComponents.map((component, index) => ({
      name: component.fieldMapping || `Header_${index + 1}`,
      value: component.text,
      top: `${(component.y / 72).toFixed(4)}in`,
      left: `${(component.x / 72).toFixed(4)}in`,
      width: `${(component.width / 72).toFixed(4)}in`,
      height: `${(component.height / 72).toFixed(4)}in`,
      fontSize: `${component.fontSize || 10}pt`,
      fontFamily: component.fontFamily || 'Arial',
      fontWeight: component.fontWeight || 'Normal',
      color: component.color || '#000000',
      isItalic: component.isItalic || false,
      type: component.aiClassification?.label || 'standalone-text',
      confidence: component.aiClassification?.score || 0.5
    }));

    // Convert tables to TableBodyData format
    const tableBodyData = {
      tables: analysisResult.tables.map((table, index) => ({
        name: `Table${index + 1}`,
        headers: table.headers.map(h => h.text),
        rows: table.rows.map(row => row.map(cell => cell.text)),
        position: {
          x: table.bounds.x,
          y: table.bounds.y,
          width: table.bounds.width,
          height: table.bounds.height
        },
        styling: {
          headerBackgroundColor: '#E6E6E6',
          headerFontWeight: 'Bold',
          cellPadding: '4pt',
          borderStyle: 'Solid'
        }
      })),
      fields: Object.entries(analysisResult.fieldMappings).map(([key, value]) => ({
        name: value,
        dataField: value,
        typeName: this.inferDataType(key),
        description: key
      }))
    };

    return { headerTextboxes, tableBodyData };
  }

  private static inferDataType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('date') || lowerText.includes('time')) {
      return 'System.DateTime';
    }
    if (lowerText.includes('amount') || lowerText.includes('price') || 
        lowerText.includes('total') || lowerText.includes('cost')) {
      return 'System.Decimal';
    }
    if (lowerText.includes('quantity') || lowerText.includes('count') || 
        lowerText.includes('number') || lowerText.includes('id')) {
      return 'System.Int32';
    }
    
    return 'System.String';
  }
}
