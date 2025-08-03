export interface HeaderTextbox {
  name: string;
  value: string;
  top: string;
  left: string;
  width: string;
  height: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  isItalic?: boolean;
  type?: 'static-label' | 'dynamic-data' | 'standalone-text';
  confidence?: number;
}

export interface TableBodyData {
  tables: Array<{
    name: string;
    headers: string[];
    rows: Array<string[]>;
    position: { x: number; y: number; width: number; height: number };
    merged_cells?: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
    styling?: {
      headerBackgroundColor?: string;
      headerFontWeight?: string;
      cellPadding?: string;
      borderStyle?: string;
    };
  }>;
  fields: Array<{
    name: string;
    dataField: string;
    typeName: string;
    description?: string;
  }>;
}

export class RDLHeaderGenerator {
  static updateCompleteRDL(
    baseRDLContent: string, 
    headerComponents: HeaderTextbox[], 
    tableBodyData?: TableBodyData
  ): string {
    let updatedRDL = baseRDLContent;
    
    // Step 1: Update header without affecting body
    if (headerComponents && headerComponents.length > 0) {
      updatedRDL = this.updateHeaderInRDL(updatedRDL, headerComponents);
    }
    
    // Step 2: Update body table data without affecting header
    if (tableBodyData && tableBodyData.tables.length > 0) {
      updatedRDL = this.updateBodyTablesInRDL(updatedRDL, tableBodyData);
    }
    
    // Step 3: Ensure proper XML formatting and namespaces
    updatedRDL = this.ensureProperNamespaces(updatedRDL);
    
    return updatedRDL;
  }

  static updateHeaderInRDL(baseRDLContent: string, headerComponents: HeaderTextbox[]): string {
    // Generate complete PageHeader structure based on analyzed PDF components
    const newHeaderContent = this.generateCompletePageHeader(headerComponents);
    
    // Replace the entire PageHeader section in the RDL without affecting other sections
    const headerRegex = /<(?:ns0:)?PageHeader>([\s\S]*?)<\/(?:ns0:)?PageHeader>/;
    
    if (headerRegex.test(baseRDLContent)) {
      return baseRDLContent.replace(headerRegex, newHeaderContent);
    } else {
      // If no PageHeader exists, add it after Page element opening
      return baseRDLContent.replace(
        /(<(?:ns0:)?Page[^>]*>)/,
        `$1\n        ${newHeaderContent}`
      );
    }
  }

  static updateBodyTablesInRDL(baseRDLContent: string, tableBodyData: TableBodyData): string {
    // Update DataSets first
    let updatedRDL = this.updateDataSets(baseRDLContent, tableBodyData.fields);
    
    // Update ReportItems in Body
    updatedRDL = this.updateReportItemsInBody(updatedRDL, tableBodyData.tables);
    
    return updatedRDL;
  }

  private static updateDataSets(rdlContent: string, fields: any[]): string {
    const fieldsXML = fields.map(field => `
            <ns0:Field Name="${field.name}">
              <ns0:DataField>${field.dataField}</ns0:DataField>
              <ns1:TypeName>${field.typeName}</ns1:TypeName>
            </ns0:Field>`).join('');

    const dataSetPattern = /(<ns0:DataSet Name="[^"]*">[\s\S]*?<ns0:Fields>)([\s\S]*?)(<\/ns0:Fields>[\s\S]*?<\/ns0:DataSet>)/;
    
    if (dataSetPattern.test(rdlContent)) {
      return rdlContent.replace(dataSetPattern, `$1${fieldsXML}$3`);
    }
    
    return rdlContent;
  }

  private static updateReportItemsInBody(rdlContent: string, tables: any[]): string {
    const tablesXML = tables.map((table, index) => 
      this.generateAdvancedTableXML(table, index)
    ).join('');

    // Pattern to match ReportItems in Body (not in PageHeader)
    const bodyReportItemsPattern = /((?:ns0:)?Body>[\s\S]*?<(?:ns0:)?ReportItems>)([\s\S]*?)(<\/(?:ns0:)?ReportItems>[\s\S]*?<\/(?:ns0:)?Body>)/;
    
    if (bodyReportItemsPattern.test(rdlContent)) {
      return rdlContent.replace(bodyReportItemsPattern, `$1${tablesXML}$3`);
    } else {
      // If no ReportItems in Body, add them
      const bodyPattern = /(<(?:ns0:)?Body[^>]*>)([\s\S]*?)(<\/(?:ns0:)?Body>)/;
      return rdlContent.replace(bodyPattern, 
        `$1
        <ns0:ReportItems>${tablesXML}
        </ns0:ReportItems>$2$3`
      );
    }
  }

  private static generateAdvancedTableXML(tableData: any, index: number): string {
    const headers = tableData.headers || [];
    const mergedCells = tableData.merged_cells || [];
    const styling = tableData.styling || {};
    
    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(headers);
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

    // Generate TablixColumns
    const tablixColumns = columnWidths.map(width => 
      `<ns0:TablixColumn><ns0:Width>${width.toFixed(2)}in</ns0:Width></ns0:TablixColumn>`
    ).join('');

    // Generate header row
    const headerRow = this.generateTableHeaderRow(headers, mergedCells, styling);
    
    // Generate detail row
    const detailRow = this.generateTableDetailRow(headers, styling);

    // Generate column hierarchy
    const columnMembers = headers.map(() => '<ns0:TablixMember />').join('');

    const topInches = Math.max(0.5, (tableData.position?.y || 0) / 72);

    return `
          <ns0:Tablix Name="${tableData.name || `MainTable${index}`}">
            <ns0:TablixBody>
              <ns0:TablixColumns>
                ${tablixColumns}
              </ns0:TablixColumns>
              <ns0:TablixRows>
                ${headerRow}
                ${detailRow}
              </ns0:TablixRows>
            </ns0:TablixBody>
            <ns0:TablixColumnHierarchy>
              <ns0:TablixMembers>
                ${columnMembers}
              </ns0:TablixMembers>
            </ns0:TablixColumnHierarchy>
            <ns0:TablixRowHierarchy>
              <ns0:TablixMembers>
                <ns0:TablixMember>
                  <ns0:KeepWithGroup>After</ns0:KeepWithGroup>
                  <ns0:RepeatOnNewPage>true</ns0:RepeatOnNewPage>
                </ns0:TablixMember>
                <ns0:TablixMember>
                  <ns0:Group Name="Details_Table${index}" />
                </ns0:TablixMember>
              </ns0:TablixMembers>
            </ns0:TablixRowHierarchy>
            <ns0:DataSetName>MainDataSet</ns0:DataSetName>
            <ns0:Top>${topInches.toFixed(2)}in</ns0:Top>
            <ns0:Left>0in</ns0:Left>
            <ns0:Width>${totalWidth.toFixed(2)}in</ns0:Width>
            <ns0:Height>1in</ns0:Height>
            <ns0:ZIndex>${index}</ns0:ZIndex>
            <ns0:Style>
              <ns0:Border>
                <ns0:Style>${styling.borderStyle || 'Solid'}</ns0:Style>
                <ns0:Width>1pt</ns0:Width>
              </ns0:Border>
            </ns0:Style>
          </ns0:Tablix>`;
  }

  private static generateTableHeaderRow(headers: string[], mergedCells: any[], styling: any): string {
    const headerCells = headers.map((header, colIndex) => {
      const mergedCell = mergedCells.find(mc => mc.row === 0 && mc.col === colIndex);
      const colspan = mergedCell?.colspan || 1;
      const rowspan = mergedCell?.rowspan || 1;
      
      return `
                <ns0:TablixCell>
                  ${colspan > 1 ? `<ns0:ColSpan>${colspan}</ns0:ColSpan>` : ''}
                  ${rowspan > 1 ? `<ns0:RowSpan>${rowspan}</ns0:RowSpan>` : ''}
                  <ns0:CellContents>
                    <ns0:Rectangle Name="HeaderRect_${colIndex}">
                      <ns0:ReportItems>
                        <ns0:Textbox Name="HeaderText_${colIndex}">
                          <ns0:Value>${this.escapeXML(header)}</ns0:Value>
                          <ns0:Style>
                            <ns0:FontWeight>${styling.headerFontWeight || 'Bold'}</ns0:FontWeight>
                            <ns0:BackgroundColor>${styling.headerBackgroundColor || '#E6E6E6'}</ns0:BackgroundColor>
                            <ns0:TextAlign>Center</ns0:TextAlign>
                            <ns0:VerticalAlign>Middle</ns0:VerticalAlign>
                            <ns0:PaddingLeft>${styling.cellPadding || '2pt'}</ns0:PaddingLeft>
                            <ns0:PaddingRight>${styling.cellPadding || '2pt'}</ns0:PaddingRight>
                            <ns0:PaddingTop>${styling.cellPadding || '2pt'}</ns0:PaddingTop>
                            <ns0:PaddingBottom>${styling.cellPadding || '2pt'}</ns0:PaddingBottom>
                          </ns0:Style>
                          <ns0:Top>0in</ns0:Top>
                          <ns0:Left>0in</ns0:Left>
                          <ns0:Width>100%</ns0:Width>
                          <ns0:Height>100%</ns0:Height>
                        </ns0:Textbox>
                      </ns0:ReportItems>
                      <ns0:Style>
                        <ns0:Border>
                          <ns0:Style>${styling.borderStyle || 'Solid'}</ns0:Style>
                          <ns0:Width>1pt</ns0:Width>
                        </ns0:Border>
                      </ns0:Style>
                      <ns0:Top>0in</ns0:Top>
                      <ns0:Left>0in</ns0:Left>
                      <ns0:Width>100%</ns0:Width>
                      <ns0:Height>100%</ns0:Height>
                    </ns0:Rectangle>
                  </ns0:CellContents>
                </ns0:TablixCell>`;
    });

    return `
              <ns0:TablixRow>
                <ns0:Height>0.3in</ns0:Height>
                <ns0:TablixCells>
                  ${headerCells.join('')}
                </ns0:TablixCells>
              </ns0:TablixRow>`;
  }

  private static generateTableDetailRow(headers: string[], styling: any): string {
    const detailCells = headers.map((header, colIndex) => {
      const fieldName = this.sanitizeFieldName(header);
      const dataType = this.inferDataType(header);
      const isNumeric = dataType.includes('Decimal') || dataType.includes('Int');
      
      return `
                <ns0:TablixCell>
                  <ns0:CellContents>
                    <ns0:Rectangle Name="DataRect_${colIndex}">
                      <ns0:ReportItems>
                        <ns0:Textbox Name="DataText_${colIndex}">
                          <ns0:Value>=Fields!${fieldName}.Value</ns0:Value>
                          <ns0:Style>
                            <ns0:TextAlign>${isNumeric ? 'Right' : 'Left'}</ns0:TextAlign>
                            <ns0:VerticalAlign>Middle</ns0:VerticalAlign>
                            <ns0:PaddingLeft>${styling.cellPadding || '4pt'}</ns0:PaddingLeft>
                            <ns0:PaddingRight>${styling.cellPadding || '4pt'}</ns0:PaddingRight>
                            <ns0:PaddingTop>2pt</ns0:PaddingTop>
                            <ns0:PaddingBottom>2pt</ns0:PaddingBottom>
                            ${isNumeric && header.toLowerCase().includes('amount') ? '<ns0:Format>C</ns0:Format>' : ''}
                            ${isNumeric && !header.toLowerCase().includes('amount') ? '<ns0:Format>N0</ns0:Format>' : ''}
                          </ns0:Style>
                          <ns0:Top>0in</ns0:Top>
                          <ns0:Left>0in</ns0:Left>
                          <ns0:Width>100%</ns0:Width>
                          <ns0:Height>100%</ns0:Height>
                        </ns0:Textbox>
                      </ns0:ReportItems>
                      <ns0:Style>
                        <ns0:Border>
                          <ns0:Style>${styling.borderStyle || 'Solid'}</ns0:Style>
                          <ns0:Width>0.5pt</ns0:Width>
                        </ns0:Border>
                      </ns0:Style>
                      <ns0:Top>0in</ns0:Top>
                      <ns0:Left>0in</ns0:Left>
                      <ns0:Width>100%</ns0:Width>
                      <ns0:Height>100%</ns0:Height>
                    </ns0:Rectangle>
                  </ns0:CellContents>
                </ns0:TablixCell>`;
    });

    return `
              <ns0:TablixRow>
                <ns0:Height>0.25in</ns0:Height>
                <ns0:TablixCells>
                  ${detailCells.join('')}
                </ns0:TablixCells>
              </ns0:TablixRow>`;
  }

  private static calculateColumnWidths(headers: string[]): number[] {
    const minWidth = 0.8;
    const maxWidth = 2.5;
    const availableWidth = 6.5;
    
    if (!headers.length) return [availableWidth];

    const baseWidths = headers.map(header => {
      const textLength = header.length;
      let width = Math.max(minWidth, textLength * 0.08);
      return Math.min(maxWidth, width);
    });

    const totalBaseWidth = baseWidths.reduce((sum, w) => sum + w, 0);
    if (totalBaseWidth > availableWidth) {
      const scaleFactor = availableWidth / totalBaseWidth;
      return baseWidths.map(w => Math.max(minWidth, w * scaleFactor));
    }

    return baseWidths;
  }

  private static sanitizeFieldName(name: string): string {
    if (!name) return 'Field1';
    return name.replace(/[^a-zA-Z0-9_]/g, '').replace(/^[^a-zA-Z]/, 'Field_') || 'Field1';
  }

  private static inferDataType(header: string): string {
    const headerLower = header.toLowerCase();
    
    if (headerLower.includes('date') || headerLower.includes('time')) {
      return 'System.DateTime';
    }
    if (headerLower.includes('amount') || headerLower.includes('price') || 
        headerLower.includes('total') || headerLower.includes('cost')) {
      return 'System.Decimal';
    }
    if (headerLower.includes('quantity') || headerLower.includes('count') || 
        headerLower.includes('number') || headerLower.includes('id')) {
      return 'System.Int32';
    }
    
    return 'System.String';
  }

  private static generateCompletePageHeader(headerComponents: HeaderTextbox[]): string {
    const reportItems = this.generateHeaderReportItems(headerComponents);
    return `<ns0:PageHeader>
          <ns0:Height>0.70417in</ns0:Height>
          <ns0:PrintOnFirstPage>true</ns0:PrintOnFirstPage>
          <ns0:PrintOnLastPage>true</ns0:PrintOnLastPage>
          <ns0:ReportItems>${reportItems}
          </ns0:ReportItems>
          <ns0:Style>
            <ns0:Border>
              <ns0:Style>None</ns0:Style>
            </ns0:Border>
          </ns0:Style>
        </ns0:PageHeader>`;
  }

  private static generateHeaderReportItems(headerComponents: HeaderTextbox[]): string {
    if (headerComponents.length === 0) {
      return '';
    }
    
    return headerComponents.map((component, index) => `
            <ns0:Textbox Name="${component.name || `Textbox${index + 1}`}">
              <ns0:CanGrow>true</ns0:CanGrow>
              <ns0:KeepTogether>true</ns0:KeepTogether>
              <ns0:Paragraphs>
                <ns0:Paragraph>
                  <ns0:TextRuns>
                    <ns0:TextRun>
                       <ns0:Value>${this.escapeXML(component.value)}</ns0:Value>
                       <ns0:Style>
                         <ns0:FontFamily>${component.fontFamily || 'Arial'}</ns0:FontFamily>
                         <ns0:FontSize>${component.fontSize || '10pt'}</ns0:FontSize>
                         <ns0:FontWeight>${this.normalizeFontWeight(component.fontWeight || 'Normal')}</ns0:FontWeight>
                         ${component.isItalic ? '<ns0:FontStyle>Italic</ns0:FontStyle>' : ''}
                         <ns0:Color>${component.color || '#000000'}</ns0:Color>
                       </ns0:Style>
                     </ns0:TextRun>
                  </ns0:TextRuns>
                  <ns0:Style />
                </ns0:Paragraph>
              </ns0:Paragraphs>
              <ns1:DefaultName>${component.name || `Textbox${index + 1}`}</ns1:DefaultName>
              <ns0:Top>${component.top}</ns0:Top>
              <ns0:Left>${component.left}</ns0:Left>
              <ns0:Height>${component.height}</ns0:Height>
              <ns0:Width>${component.width}</ns0:Width>
              <ns0:Style>
                <ns0:Border>
                  <ns0:Style>None</ns0:Style>
                </ns0:Border>
                <ns0:PaddingLeft>2pt</ns0:PaddingLeft>
                <ns0:PaddingRight>2pt</ns0:PaddingRight>
                <ns0:PaddingTop>2pt</ns0:PaddingTop>
                <ns0:PaddingBottom>2pt</ns0:PaddingBottom>
              </ns0:Style>
            </ns0:Textbox>`).join('');
  }

  static convertPDFComponentsToHeaderTextboxes(pdfComponents: any[]): HeaderTextbox[] {
    return pdfComponents
      .filter(component => 
        component.text && 
        component.text.trim() !== '' && 
        component.text.trim().toLowerCase() !== 'header text' && 
        !component.text.trim().match(/^header\s*text$/i)
      )
      .map((component, index) => ({
        name: component.type === 'static-label' 
          ? `Label_${component.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}_${index + 1}`
          : component.type === 'dynamic-data'
          ? `Data_${index + 1}`
          : `Text_${index + 1}`,
        value: component.text || component.content || 'Header Text',
        top: `${Math.max(0, (component.y / 72)).toFixed(4)}in`,
        left: `${Math.max(0, (component.x / 72)).toFixed(4)}in`,
        width: `${Math.max(0.5, (component.width / 72)).toFixed(4)}in`,
        height: `${Math.max(0.25, (component.height || component.fontSize || 12) / 72).toFixed(4)}in`,
        fontSize: `${component.fontSize || 10}pt`,
        fontFamily: component.fontFamily || 'Arial',
        fontWeight: this.normalizeFontWeight(component.fontWeight || 'Normal'),
        color: component.color || '#000000',
        isItalic: component.isItalic || false,
        type: component.type || 'standalone-text',
        confidence: component.confidence || 0.5
      }));
  }

  static convertEnhancedHeaderAnalysis(headerAnalysis: any): HeaderTextbox[] {
    const allComponents = [
      ...headerAnalysis.staticLabels,
      ...headerAnalysis.dynamicData,
      ...headerAnalysis.standaloneText
    ];
    
    return this.convertPDFComponentsToHeaderTextboxes(allComponents);
  }

  static convertTableBodyData(pdfAnalysisResult: any): TableBodyData {
    const fields = this.generateFieldsFromTables(pdfAnalysisResult.tables || []);
    
    return {
      tables: (pdfAnalysisResult.tables || []).map((table: any, index: number) => ({
        name: `Table${index + 1}`,
        headers: table.headers || [],
        rows: table.rows || [],
        position: table.position || { x: 0, y: 100, width: 500, height: 300 },
        merged_cells: table.merged_cells || [],
        styling: {
          headerBackgroundColor: '#E6E6E6',
          headerFontWeight: 'Bold',
          cellPadding: '4pt',
          borderStyle: 'Solid'
        }
      })),
      fields
    };
  }

  private static generateFieldsFromTables(tables: any[]): any[] {
    const fields: any[] = [];
    const fieldNames = new Set<string>();

    tables.forEach(table => {
      (table.headers || []).forEach((header: string) => {
        const fieldName = this.sanitizeFieldName(header);
        if (fieldName && !fieldNames.has(fieldName)) {
          fieldNames.add(fieldName);
          fields.push({
            name: fieldName,
            dataField: fieldName,
            typeName: this.inferDataType(header),
            description: header
          });
        }
      });
    });

    return fields.length > 0 ? fields : [
      { name: "ID", dataField: "ID", typeName: "System.Int32", description: "Primary identifier" },
      { name: "Description", dataField: "Description", typeName: "System.String", description: "Description" },
      { name: "Amount", dataField: "Amount", typeName: "System.Decimal", description: "Amount" }
    ];
  }

  private static normalizeFontWeight(fontWeight: string): string {
    const normalized = fontWeight.toLowerCase();
    switch (normalized) {
      case 'normal': return 'Normal';
      case 'bold': return 'Bold';
      case 'thin': return 'Thin';
      case 'extralight': return 'ExtraLight';
      case 'light': return 'Light';
      case 'medium': return 'Medium';
      case 'semibold': return 'SemiBold';
      case 'extrabold': return 'ExtraBold';
      case 'heavy': return 'Heavy';
      default: return 'Normal';
    }
  }

  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static generateExecutableRDL(
    baseRDLContent: string, 
    headerComponents: HeaderTextbox[], 
    tableBodyData?: TableBodyData
  ): string {
    // Update both header and body without conflicts
    let updatedRDL = this.updateCompleteRDL(baseRDLContent, headerComponents, tableBodyData);
    
    // Ensure proper XML formatting and namespaces
    updatedRDL = this.ensureProperNamespaces(updatedRDL);
    
    return updatedRDL;
  }

  private static ensureProperNamespaces(rdlContent: string): string {
    // Ensure the RDL has proper namespace declarations
    if (!rdlContent.includes('xmlns:ns0=')) {
      rdlContent = rdlContent.replace(
        /<Report[^>]*>/,
        '<Report xmlns:ns0="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:ns1="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner">'
      );
    }
    
    // Ensure proper XML declaration
    if (!rdlContent.startsWith('<?xml')) {
      rdlContent = '<?xml version="1.0" encoding="utf-8"?>\n' + rdlContent;
    }
    
    return rdlContent;
  }
}
