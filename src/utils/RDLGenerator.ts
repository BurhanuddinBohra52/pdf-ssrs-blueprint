export interface RDLField {
  name: string;
  dataField: string;
  typeName: string;
  description?: string;
}

export interface RDLDataSet {
  name: string;
  dataSourceName: string;
  commandText: string;
  fields: RDLField[];
}

export interface RDLDataSource {
  name: string;
  connectionString: string;
  dataSourceReference?: string;
}

export interface PDFAnalysisResult {
  tables: Array<{
    headers: string[];
    rows: Array<string[]>;
    position: { x: number; y: number; width: number; height: number };
    merged_cells?: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
  }>;
  textElements: Array<{
    content: string;
    position: { x: number; y: number; width: number; height: number };
    classification: 'header' | 'footer' | 'label' | 'data';
    styles?: any;
  }>;
}

export class RDLGenerator {
  static generateRDLTemplate(
    dataSources: RDLDataSource[] = [],
    dataSets: RDLDataSet[] = [],
    pdfAnalysisResult?: PDFAnalysisResult | any
  ): string {
    const defaultDataSource: RDLDataSource = {
      name: "DefaultDataSource",
      connectionString: "Data Source=YourServer;Initial Catalog=YourDatabase;Integrated Security=True",
      dataSourceReference: "/YourSharedDataSource"
    };

    // Generate fields based on PDF analysis or use defaults
    const fields = this.generateFieldsFromAnalysis(pdfAnalysisResult);

    const defaultDataSet: RDLDataSet = {
      name: "MainDataSet",
      dataSourceName: defaultDataSource.name,
      commandText: this.generateQueryFromAnalysis(pdfAnalysisResult),
      fields: fields
    };

    const sources = dataSources.length > 0 ? dataSources : [defaultDataSource];
    const sets = dataSets.length > 0 ? dataSets : [defaultDataSet];

    return this.buildRDLXML(sources, sets, pdfAnalysisResult);
  }

  private static generateFieldsFromAnalysis(analysisResult?: PDFAnalysisResult): RDLField[] {
    const defaultFields: RDLField[] = [
      { name: "ID", dataField: "ID", typeName: "System.Int32", description: "Primary identifier" },
      { name: "InvoiceNumber", dataField: "InvoiceNumber", typeName: "System.String", description: "Invoice number" },
      { name: "InvoiceDate", dataField: "InvoiceDate", typeName: "System.DateTime", description: "Invoice date" },
      { name: "CustomerName", dataField: "CustomerName", typeName: "System.String", description: "Customer name" },
      { name: "Amount", dataField: "Amount", typeName: "System.Decimal", description: "Invoice amount" },
      { name: "Description", dataField: "Description", typeName: "System.String", description: "Item description" },
      { name: "Quantity", dataField: "Quantity", typeName: "System.Int32", description: "Item quantity" },
      { name: "UnitPrice", dataField: "UnitPrice", typeName: "System.Decimal", description: "Unit price" },
      { name: "LineTotal", dataField: "LineTotal", typeName: "System.Decimal", description: "Line total amount" }
    ];

    if (!analysisResult?.tables?.length) return defaultFields;

    const fields: RDLField[] = [];
    const fieldNames = new Set<string>();

    // Extract unique field names from all table headers
    analysisResult.tables.forEach(table => {
      table.headers.forEach(header => {
        const fieldName = this.sanitizeFieldName(header);
        if (fieldName && !fieldNames.has(fieldName)) {
          fieldNames.add(fieldName);
          fields.push({
            name: fieldName,
            dataField: fieldName,
            typeName: this.inferDataType(header, table.rows),
            description: header
          });
        }
      });
    });

    return fields.length > 0 ? fields : defaultFields;
  }

  private static generateQueryFromAnalysis(analysisResult?: PDFAnalysisResult): string {
    if (!analysisResult?.tables?.length) {
      return `SELECT 
        ID,
        InvoiceNumber,
        InvoiceDate,
        CustomerName,
        Amount,
        Description,
        Quantity,
        UnitPrice,
        LineTotal
      FROM YourTableName
      WHERE YourConditions = @Parameter1`;
    }

    const fields = this.generateFieldsFromAnalysis(analysisResult);
    const fieldList = fields.map(f => f.dataField).join(',\n        ');
    
    return `SELECT 
        ${fieldList}
      FROM YourTableName
      WHERE YourConditions = @Parameter1`;
  }

  private static buildRDLXML(
    dataSources: RDLDataSource[],
    dataSets: RDLDataSet[],
    analysisResult?: PDFAnalysisResult
  ): string {
    const dataSourcesXML = dataSources.map(ds => `
    <DataSource Name="${ds.name}">
      ${ds.dataSourceReference ? 
        `<DataSourceReference>${ds.dataSourceReference}</DataSourceReference>` :
        `<ConnectionProperties>
          <DataProvider>SQL</DataProvider>
          <ConnectString>${ds.connectionString}</ConnectString>
        </ConnectionProperties>`
      }
      <rd:SecurityType>None</rd:SecurityType>
      <rd:DataSourceID>${this.generateGUID()}</rd:DataSourceID>
    </DataSource>`).join('');

    const dataSetsXML = dataSets.map(ds => `
    <DataSet Name="${ds.name}">
      <Query>
        <DataSourceName>${ds.dataSourceName}</DataSourceName>
        <CommandText>${ds.commandText}</CommandText>
        <rd:UseGenericDesigner>true</rd:UseGenericDesigner>
      </Query>
      <Fields>
        ${ds.fields.map(field => `
        <Field Name="${field.name}">
          <DataField>${field.dataField}</DataField>
          <rd:TypeName>${field.typeName}</rd:TypeName>
        </Field>`).join('')}
      </Fields>
    </DataSet>`).join('');

    const reportItemsXML = this.generateReportItemsFromPDF(analysisResult);

    return `<?xml version="1.0" encoding="utf-8"?>
<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner">
  <AutoRefresh>0</AutoRefresh>
  <DataSources>
    ${dataSourcesXML}
  </DataSources>
  <DataSets>
    ${dataSetsXML}
  </DataSets>
  <ReportParameters>
    <ReportParameter Name="Parameter1">
      <DataType>String</DataType>
      <DefaultValue>
        <Values>
          <Value>DefaultValue</Value>
        </Values>
      </DefaultValue>
      <Prompt>Enter Parameter Value</Prompt>
    </ReportParameter>
  </ReportParameters>
  <ReportSections>
    <ReportSection>
      <Body>
        <ReportItems>
          ${reportItemsXML}
        </ReportItems>
        <Height>11in</Height>
        <Style />
      </Body>
      <Width>8.5in</Width>
      <Page>
        <PageHeader>
          <Height>0.5in</Height>
          <PrintOnFirstPage>true</PrintOnFirstPage>
          <PrintOnLastPage>true</PrintOnLastPage>
          <ReportItems>
            ${this.generateCorrectTextbox('PageHeaderText', '"Page " &amp; Globals!PageNumber &amp; " of " &amp; Globals!TotalPages', {
              top: '0.1in',
              left: '5in',
              width: '2in',
              height: '0.25in',
              textAlign: 'Right',
              fontSize: '10pt'
            })}
          </ReportItems>
        </PageHeader>
        <PageHeight>11in</PageHeight>
        <PageWidth>8.5in</PageWidth>
        <LeftMargin>1in</LeftMargin>
        <RightMargin>1in</RightMargin>
        <TopMargin>1in</TopMargin>
        <BottomMargin>1in</BottomMargin>
        <Style />
      </Page>
    </ReportSection>
  </ReportSections>
  <rd:ReportUnitType>Inch</rd:ReportUnitType>
  <rd:ReportID>${this.generateGUID()}</rd:ReportID>
</Report>`;
  }

  // Corrected method to generate SSRS 2016+ compliant textboxes with absolute units
  private static generateCorrectTextbox(
    name: string,
    value: string,
    options: {
      top: string;
      left: string;
      width: string;
      height: string;
      textAlign?: string;
      fontSize?: string;
      fontWeight?: string;
      backgroundColor?: string;
      format?: string;
      paddingLeft?: string;
      paddingRight?: string;
      paddingTop?: string;
      paddingBottom?: string;
      parentWidth?: number; // in inches, for calculating relative sizes
      parentHeight?: number; // in inches, for calculating relative sizes
    }
  ): string {
    const {
      top, left, width, height,
      textAlign = 'Left',
      fontSize = '10pt',
      fontWeight = 'Normal',
      backgroundColor,
      format,
      paddingLeft = '2pt',
      paddingRight = '2pt',
      paddingTop = '2pt',
      paddingBottom = '2pt',
      parentWidth,
      parentHeight
    } = options;

    // Convert percentage widths/heights to absolute measurements
    const finalWidth = this.convertToAbsoluteUnit(width, parentWidth);
    const finalHeight = this.convertToAbsoluteUnit(height, parentHeight);

    return `
      <Textbox Name="${name}">
        <CanGrow>true</CanGrow>
        <KeepTogether>true</KeepTogether>
        <Paragraphs>
          <Paragraph>
            <TextRuns>
              <TextRun>
                <Value>${value}</Value>
                <Style>
                  <FontSize>${fontSize}</FontSize>
                  <FontWeight>${fontWeight}</FontWeight>
                  ${format ? `<Format>${format}</Format>` : ''}
                </Style>
              </TextRun>
            </TextRuns>
            <Style>
              <TextAlign>${textAlign}</TextAlign>
            </Style>
          </Paragraph>
        </Paragraphs>
        <rd:DefaultName>${name}</rd:DefaultName>
        <Top>${top}</Top>
        <Left>${left}</Left>
        <Height>${finalHeight}</Height>
        <Width>${finalWidth}</Width>
        <Style>
          ${backgroundColor ? `<BackgroundColor>${backgroundColor}</BackgroundColor>` : ''}
          <Border>
            <Style>None</Style>
          </Border>
          <PaddingLeft>${paddingLeft}</PaddingLeft>
          <PaddingRight>${paddingRight}</PaddingRight>
          <PaddingTop>${paddingTop}</PaddingTop>
          <PaddingBottom>${paddingBottom}</PaddingBottom>
        </Style>
      </Textbox>`;
  }

  // Helper method to convert percentage or relative units to absolute units
  private static convertToAbsoluteUnit(value: string, parentSize?: number): string {
    if (value.endsWith('%')) {
      const percentage = parseFloat(value.replace('%', ''));
      if (parentSize) {
        return `${(parentSize * percentage / 100).toFixed(3)}in`;
      } else {
        // Default fallback if no parent size provided
        return value === '100%' ? '1in' : '0.5in';
      }
    }
    return value;
  }

  private static generateReportItemsFromPDF(analysisResult?: PDFAnalysisResult): string {
    if (!analysisResult) {
      return this.generateDefaultTable();
    }

    let reportItems = '';
    let currentTop = 0.5; // Start after some margin

    // First, add header text elements
    const headerTexts = analysisResult.textElements?.filter(el => 
      el.classification === 'header'
    ) || [];

    headerTexts.forEach((textEl, index) => {
      const topInches = Math.max(currentTop, textEl.position.y / 72);
      reportItems += this.generateTextboxFromElement(textEl, index, topInches);
      currentTop = topInches + (textEl.position.height / 72) + 0.1;
    });

    // Then add body labels (non-header labels)
    const bodyLabels = analysisResult.textElements?.filter(el => 
      el.classification === 'label'
    ) || [];

    bodyLabels.forEach((textEl, index) => {
      const topInches = Math.max(currentTop, textEl.position.y / 72);
      reportItems += this.generateTextboxFromElement(textEl, index + headerTexts.length, topInches);
      currentTop = topInches + (textEl.position.height / 72) + 0.1;
    });

    // Generate tables for body content
    if (analysisResult.tables && analysisResult.tables.length > 0) {
      analysisResult.tables.forEach((table, index) => {
        const topInches = Math.max(currentTop, table.position.y / 72);
        reportItems += this.generateAdvancedTableXML(table, index, topInches);
        currentTop = topInches + (table.position.height / 72) + 0.5;
      });
    } else {
      // If no tables detected, create a default data table
      reportItems += this.generateDefaultDataTable(currentTop);
    }

    return reportItems || this.generateDefaultTable();
  }

  private static generateAdvancedTableXML(
    tableData: any, 
    index: number, 
    topInches: number
  ): string {
    const headers = tableData.headers || [];
    const rows = tableData.rows || [];
    const mergedCells = tableData.merged_cells || [];
    
    // Calculate column widths based on content
    const columnWidths = this.calculateColumnWidths(headers, rows);
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

    // Generate TablixColumns
    const tablixColumns = columnWidths.map(width => 
      `<TablixColumn><Width>${width.toFixed(2)}in</Width></TablixColumn>`
    ).join('');

    // Generate header row
    const headerRow = this.generateTableHeaderRow(headers, mergedCells, columnWidths);
    
    // Generate detail row
    const detailRow = this.generateTableDetailRow(headers, mergedCells, columnWidths);

    // Generate column hierarchy (static columns)
    const columnMembers = headers.map(() => '<TablixMember />').join('');

    return `
      <Tablix Name="MainTable${index}">
        <TablixBody>
          <TablixColumns>
            ${tablixColumns}
          </TablixColumns>
          <TablixRows>
            ${headerRow}
            ${detailRow}
          </TablixRows>
        </TablixBody>
        <TablixColumnHierarchy>
          <TablixMembers>
            ${columnMembers}
          </TablixMembers>
        </TablixColumnHierarchy>
        <TablixRowHierarchy>
          <TablixMembers>
            <TablixMember>
              <KeepWithGroup>After</KeepWithGroup>
              <RepeatOnNewPage>true</RepeatOnNewPage>
            </TablixMember>
            <TablixMember>
              <Group Name="Details_Table${index}" />
            </TablixMember>
          </TablixMembers>
        </TablixRowHierarchy>
        <DataSetName>MainDataSet</DataSetName>
        <Top>${topInches.toFixed(2)}in</Top>
        <Left>0in</Left>
        <Width>${totalWidth.toFixed(2)}in</Width>
        <Height>1in</Height>
        <ZIndex>${index}</ZIndex>
        <Style>
          <Border>
            <Style>Solid</Style>
            <Width>1pt</Width>
          </Border>
        </Style>
      </Tablix>`;
  }

  private static generateTableHeaderRow(headers: string[], mergedCells: any[], columnWidths: number[]): string {
    const headerCells = headers.map((header, colIndex) => {
      const mergedCell = mergedCells.find(mc => mc.row === 0 && mc.col === colIndex);
      const colspan = mergedCell?.colspan || 1;
      const rowspan = mergedCell?.rowspan || 1;
      const cellWidth = columnWidths[colIndex] || 1.5;
      const textWidth = cellWidth - 0.02; // Padding adjustment
      
      return `
        <TablixCell>
          ${colspan > 1 ? `<ColSpan>${colspan}</ColSpan>` : ''}
          ${rowspan > 1 ? `<RowSpan>${rowspan}</RowSpan>` : ''}
          <CellContents>
            <Rectangle Name="HeaderRect_${colIndex}">
              <ReportItems>
                ${this.generateCorrectTextbox(`HeaderText_${colIndex}`, this.escapeXMLValue(header), {
                  top: '0in',
                  left: '0in',
                  width: `${textWidth.toFixed(3)}in`,
                  height: '0.28in',
                  textAlign: 'Center',
                  fontWeight: 'Bold',
                  backgroundColor: '#E6E6E6'
                })}
              </ReportItems>
              <Style>
                <Border>
                  <Style>Solid</Style>
                  <Width>1pt</Width>
                </Border>
              </Style>
              <Top>0in</Top>
              <Left>0in</Left>
              <Width>${cellWidth.toFixed(3)}in</Width>
              <Height>0.3in</Height>
            </Rectangle>
          </CellContents>
        </TablixCell>`;
    });

    return `
      <TablixRow>
        <Height>0.3in</Height>
        <TablixCells>
          ${headerCells.join('')}
        </TablixCells>
      </TablixRow>`;
  }

  private static generateTableDetailRow(headers: string[], mergedCells: any[], columnWidths: number[]): string {
    const detailCells = headers.map((header, colIndex) => {
      const fieldName = this.sanitizeFieldName(header);
      const dataType = this.inferDataType(header, []);
      const isNumeric = dataType.includes('Decimal') || dataType.includes('Int');
      const cellWidth = columnWidths[colIndex] || 1.5;
      const textWidth = cellWidth - 0.02; // Padding adjustment
      
      let format = '';
      if (isNumeric && header.toLowerCase().includes('amount')) {
        format = 'C';
      } else if (isNumeric && !header.toLowerCase().includes('amount')) {
        format = 'N0';
      }
      
      return `
        <TablixCell>
          <CellContents>
            <Rectangle Name="DataRect_${colIndex}">
              <ReportItems>
                ${this.generateCorrectTextbox(`DataText_${colIndex}`, `=Fields!${fieldName}.Value`, {
                  top: '0in',
                  left: '0in',
                  width: `${textWidth.toFixed(3)}in`,
                  height: '0.23in',
                  textAlign: isNumeric ? 'Right' : 'Left',
                  paddingLeft: '4pt',
                  paddingRight: '4pt',
                  format: format || undefined
                })}
              </ReportItems>
              <Style>
                <Border>
                  <Style>Solid</Style>
                  <Width>0.5pt</Width>
                </Border>
              </Style>
              <Top>0in</Top>
              <Left>0in</Left>
              <Width>${cellWidth.toFixed(3)}in</Width>
              <Height>0.25in</Height>
            </Rectangle>
          </CellContents>
        </TablixCell>`;
    });

    return `
      <TablixRow>
        <Height>0.25in</Height>
        <TablixCells>
          ${detailCells.join('')}
        </TablixCells>
      </TablixRow>`;
  }

  private static generateDefaultDataTable(topInches: number): string {
    const headers = ['Description', 'Quantity', 'Unit Price', 'Total'];
    const fields = ['Description', 'Quantity', 'UnitPrice', 'LineTotal'];
    const formats = ['', 'N0', 'C', 'C'];
    const alignments = ['Left', 'Right', 'Right', 'Right'];
    
    const columnWidths = [2, 1.5, 1.5, 1.5];
    const tablixColumns = columnWidths.map(width => 
      `<TablixColumn><Width>${width}in</Width></TablixColumn>`
    ).join('');

    const headerCells = headers.map((header, index) => {
      const cellWidth = columnWidths[index];
      const textWidth = cellWidth - 0.02;
      
      return `
      <TablixCell>
        <CellContents>
          ${this.generateCorrectTextbox(`${header}Header`, header, {
            top: '0in',
            left: '0in',
            width: `${textWidth.toFixed(3)}in`,
            height: '0.28in',
            textAlign: 'Center',
            fontWeight: 'Bold',
            backgroundColor: '#E6E6E6'
          })}
        </CellContents>
      </TablixCell>`;
    }).join('');

    const dataCells = fields.map((field, index) => {
      const cellWidth = columnWidths[index];
      const textWidth = cellWidth - 0.02;
      
      return `
      <TablixCell>
        <CellContents>
          ${this.generateCorrectTextbox(`${field}Data`, `=Fields!${field}.Value`, {
            top: '0in',
            left: '0in',
            width: `${textWidth.toFixed(3)}in`,
            height: '0.23in',
            textAlign: alignments[index],
            paddingLeft: '4pt',
            paddingRight: '4pt',
            format: formats[index] || undefined
          })}
        </CellContents>
      </TablixCell>`;
    }).join('');

    return `
      <Tablix Name="DefaultDataTable">
        <TablixBody>
          <TablixColumns>
            ${tablixColumns}
          </TablixColumns>
          <TablixRows>
            <TablixRow>
              <Height>0.3in</Height>
              <TablixCells>
                ${headerCells}
              </TablixCells>
            </TablixRow>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                ${dataCells}
              </TablixCells>
            </TablixRow>
          </TablixRows>
        </TablixBody>
        <TablixColumnHierarchy>
          <TablixMembers>
            <TablixMember />
            <TablixMember />
            <TablixMember />
            <TablixMember />
          </TablixMembers>
        </TablixColumnHierarchy>
        <TablixRowHierarchy>
          <TablixMembers>
            <TablixMember>
              <KeepWithGroup>After</KeepWithGroup>
              <RepeatOnNewPage>true</RepeatOnNewPage>
            </TablixMember>
            <TablixMember>
              <Group Name="Details_DefaultData" />
            </TablixMember>
          </TablixMembers>
        </TablixRowHierarchy>
        <DataSetName>MainDataSet</DataSetName>
        <Top>${topInches.toFixed(2)}in</Top>
        <Left>0in</Left>
        <Width>6.5in</Width>
        <Height>1in</Height>
        <Style>
          <Border>
            <Style>Solid</Style>
            <Width>1pt</Width>
          </Border>
        </Style>
      </Tablix>`;
  }

  private static calculateColumnWidths(headers: string[], rows: any[][]): number[] {
    const minWidth = 0.8; // Minimum column width in inches
    const maxWidth = 2.5; // Maximum column width in inches
    const availableWidth = 6.5; // Available width for the table
    
    if (!headers.length) return [availableWidth];

    // Calculate base widths based on header text length
    const baseWidths = headers.map(header => {
      const textLength = header.length;
      let width = Math.max(minWidth, textLength * 0.08);
      return Math.min(maxWidth, width);
    });

    // Adjust if total width exceeds available space
    const totalBaseWidth = baseWidths.reduce((sum, w) => sum + w, 0);
    if (totalBaseWidth > availableWidth) {
      const scaleFactor = availableWidth / totalBaseWidth;
      return baseWidths.map(w => Math.max(minWidth, w * scaleFactor));
    }

    return baseWidths;
  }

  private static generateTextboxFromElement(
    element: any, 
    index: number, 
    topInches: number
  ): string {
    const leftInches = (element.position.x / 72).toFixed(2);
    const widthInches = Math.max(1, element.position.width / 72).toFixed(2);
    const heightInches = Math.max(0.25, element.position.height / 72).toFixed(2);

    const isHeader = element.classification === 'header';
    
    return this.generateCorrectTextbox(`TextElement_${index}`, this.escapeXMLValue(element.content), {
      top: `${topInches.toFixed(2)}in`,
      left: `${leftInches}in`,
      width: `${widthInches}in`,
      height: `${heightInches}in`,
      fontSize: isHeader ? '14pt' : '10pt',
      fontWeight: isHeader ? 'Bold' : 'Normal',
      textAlign: isHeader ? 'Center' : 'Left'
    });
  }

  private static generateDefaultTable(): string {
    const headers = ['Item', 'Qty', 'Price', 'Total'];
    const fields = ['Description', 'Quantity', 'UnitPrice', 'LineTotal'];
    const formats = ['', '', 'C', 'C'];
    const alignments = ['Left', 'Right', 'Right', 'Right'];
    
    const columnWidths = [2, 1, 1.5, 1];
    const tablixColumns = columnWidths.map(width => 
      `<TablixColumn><Width>${width}in</Width></TablixColumn>`
    ).join('');

    const headerCells = headers.map((header, index) => {
      const cellWidth = columnWidths[index];
      const textWidth = cellWidth - 0.02;
      
      return `
      <TablixCell>
        <CellContents>
          ${this.generateCorrectTextbox(`${header}Header`, header, {
            top: '0in',
            left: '0in',
            width: `${textWidth.toFixed(3)}in`,
            height: '0.28in',
            textAlign: 'Center',
            fontWeight: 'Bold',
            backgroundColor: '#E6E6E6'
          })}
        </CellContents>
      </TablixCell>`;
    }).join('');

    const dataCells = fields.map((field, index) => {
      const cellWidth = columnWidths[index];
      const textWidth = cellWidth - 0.02;
      
      return `
      <TablixCell>
        <CellContents>
          ${this.generateCorrectTextbox(`${field}Data`, `=Fields!${field}.Value`, {
            top: '0in',
            left: '0in',
            width: `${textWidth.toFixed(3)}in`,
            height: '0.23in',
            textAlign: alignments[index],
            paddingLeft: '4pt',
            paddingRight: '4pt',
            format: formats[index] || undefined
          })}
        </CellContents>
      </TablixCell>`;
    }).join('');

    return `
      <Tablix Name="MainTable">
        <TablixBody>
          <TablixColumns>
            ${tablixColumns}
          </TablixColumns>
          <TablixRows>
            <TablixRow>
              <Height>0.3in</Height>
              <TablixCells>
                ${headerCells}
              </TablixCells>
            </TablixRow>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                ${dataCells}
              </TablixCells>
            </TablixRow>
          </TablixRows>
        </TablixBody>
        <TablixColumnHierarchy>
          <TablixMembers>
            <TablixMember />
            <TablixMember />
            <TablixMember />
            <TablixMember />
          </TablixMembers>
        </TablixColumnHierarchy>
        <TablixRowHierarchy>
          <TablixMembers>
            <TablixMember>
              <KeepWithGroup>After</KeepWithGroup>
              <RepeatOnNewPage>true</RepeatOnNewPage>
            </TablixMember>
            <TablixMember>
              <Group Name="Details" />
            </TablixMember>
          </TablixMembers>
        </TablixRowHierarchy>
        <DataSetName>MainDataSet</DataSetName>
        <Top>2in</Top>
        <Left>0in</Left>
        <Width>5.5in</Width>
        <Height>1in</Height>
        <Style>
          <Border>
            <Style>Solid</Style>
            <Width>1pt</Width>
          </Border>
        </Style>
      </Tablix>`;
  }

  // Enhanced method to calculate proper absolute dimensions for table cells
  private static calculateCellDimensions(columnWidths: number[], rowHeight: number = 0.25): {
    cellWidths: string[];
    cellHeight: string;
    textWidths: string[];
    textHeight: string;
  } {
    const padding = 0.02; // 2pt padding converted to inches
    
    return {
      cellWidths: columnWidths.map(w => `${w}in`),
      cellHeight: `${rowHeight}in`,
      textWidths: columnWidths.map(w => `${w - padding}in`), // Slightly smaller for text
      textHeight: `${rowHeight - padding}in`
    };
  }

  private static sanitizeFieldName(text: string): string {
    if (!text) return 'Field1';
    return text
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .replace(/\s/g, '') || 'Field1';
  }

  private static inferDataType(header: string, rows: any[][]): string {
    if (!header) return 'System.String';
    
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('date') || lowerHeader.includes('time')) {
      return 'System.DateTime';
    }
    if (lowerHeader.includes('amount') || lowerHeader.includes('price') || 
        lowerHeader.includes('total') || lowerHeader.includes('cost')) {
      return 'System.Decimal';
    }
    if (lowerHeader.includes('quantity') || lowerHeader.includes('qty') || 
        lowerHeader.includes('count') || lowerHeader.includes('number')) {
      return 'System.Int32';
    }
    
    return 'System.String';
  }

  private static escapeXMLValue(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static generateGUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
