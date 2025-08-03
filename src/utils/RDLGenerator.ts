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

export class RDLGenerator {
  static generateRDLTemplate(
    dataSources: RDLDataSource[] = [],
    dataSets: RDLDataSet[] = [],
    analysisComponents: any[] = []
  ): string {
    const defaultDataSource: RDLDataSource = {
      name: "DefaultDataSource",
      connectionString: "Data Source=YourServer;Initial Catalog=YourDatabase;Integrated Security=True",
      dataSourceReference: "/YourSharedDataSource"
    };

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

    const defaultDataSet: RDLDataSet = {
      name: "MainDataSet",
      dataSourceName: defaultDataSource.name,
      commandText: `SELECT 
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
      WHERE YourConditions = @Parameter1`,
      fields: defaultFields
    };

    const sources = dataSources.length > 0 ? dataSources : [defaultDataSource];
    const sets = dataSets.length > 0 ? dataSets : [defaultDataSet];

    return this.buildRDLXML(sources, sets, analysisComponents);
  }

  private static buildRDLXML(
    dataSources: RDLDataSource[],
    dataSets: RDLDataSet[],
    components: any[]
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

    const reportItemsXML = this.generateReportItems(components);

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
  <Body>
    <ReportItems>
      ${reportItemsXML}
    </ReportItems>
    <Height>11in</Height>
    <Style />
  </Body>
  <Width>8.5in</Width>
  <Page>
    <PageHeight>11in</PageHeight>
    <PageWidth>8.5in</PageWidth>
    <LeftMargin>1in</LeftMargin>
    <RightMargin>1in</RightMargin>
    <TopMargin>1in</TopMargin>
    <BottomMargin>1in</BottomMargin>
    <Style />
  </Page>
  <AutoRefresh>0</AutoRefresh>
  <DataSources />
  <DataSets />
  <rd:ReportUnitType>Inch</rd:ReportUnitType>
  <rd:ReportID>${this.generateGUID()}</rd:ReportID>
</Report>`;
  }

  private static generateReportItems(components: any[]): string {
    if (components.length === 0) {
      return `
      <!-- Header Section -->
      <Rectangle Name="HeaderRectangle">
        <Top>0in</Top>
        <Left>0in</Left>
        <Width>6.5in</Width>
        <Height>1.5in</Height>
        <Style>
          <Border>
            <Style>Solid</Style>
            <Width>1pt</Width>
          </Border>
        </Style>
        <ReportItems>
          <Textbox Name="HeaderTitle">
            <CanGrow>true</CanGrow>
            <Value>Report Title</Value>
            <Style>
              <FontSize>18pt</FontSize>
              <FontWeight>Bold</FontWeight>
              <TextAlign>Center</TextAlign>
            </Style>
            <Top>0.25in</Top>
            <Left>0.25in</Left>
            <Width>6in</Width>
            <Height>0.5in</Height>
          </Textbox>
        </ReportItems>
      </Rectangle>
      
      <!-- Data Table -->
      <Tablix Name="MainTable">
        <TablixBody>
          <TablixRows>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="DescriptionHeader">
                      <Value>Description</Value>
                      <Style>
                        <FontWeight>Bold</FontWeight>
                        <BackgroundColor>LightGray</BackgroundColor>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="QuantityHeader">
                      <Value>Quantity</Value>
                      <Style>
                        <FontWeight>Bold</FontWeight>
                        <BackgroundColor>LightGray</BackgroundColor>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="AmountHeader">
                      <Value>Amount</Value>
                      <Style>
                        <FontWeight>Bold</FontWeight>
                        <BackgroundColor>LightGray</BackgroundColor>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
              </TablixCells>
            </TablixRow>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="Description">
                      <Value>=Fields!Description.Value</Value>
                    </Textbox>
                  </CellContents>
                </TablixCell>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="Quantity">
                      <Value>=Fields!Quantity.Value</Value>
                      <Style>
                        <TextAlign>Right</TextAlign>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="LineTotal">
                      <Value>=Fields!LineTotal.Value</Value>
                      <Style>
                        <TextAlign>Right</TextAlign>
                        <Format>C</Format>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
              </TablixCells>
            </TablixRow>
          </TablixRows>
        </TablixBody>
        <TablixColumnHierarchy>
          <TablixMembers>
            <TablixMember />
            <TablixMember />
            <TablixMember />
          </TablixMembers>
        </TablixColumnHierarchy>
        <TablixRowHierarchy>
          <TablixMembers>
            <TablixMember>
              <KeepWithGroup>After</KeepWithGroup>
            </TablixMember>
            <TablixMember>
              <Group Name="Details" />
            </TablixMember>
          </TablixMembers>
        </TablixRowHierarchy>
        <DataSetName>MainDataSet</DataSetName>
        <Top>2in</Top>
        <Left>0in</Left>
        <Width>6.5in</Width>
        <Height>0.5in</Height>
      </Tablix>`;
    }

    // Generate report items based on analyzed components
    return components.map((component, index) => {
      if (component.type === 'table') {
        return this.generateTableXML(component, index);
      } else {
        return this.generateTextboxXML(component, index);
      }
    }).join('\n');
  }

  private static generateTextboxXML(component: any, index: number): string {
    const topInches = (component.y / 72).toFixed(2); // Convert points to inches
    const leftInches = (component.x / 72).toFixed(2);
    const widthInches = (component.width / 72).toFixed(2);
    const heightInches = (component.height / 72).toFixed(2);

    // Determine the value - use expression if it's an expression field, otherwise use content
    let value = component.content || `=[Field${index}]`;
    if (component.isExpression && component.expression) {
      value = component.expression;
    } else if (component.classification === 'dynamic-data' && !component.expression) {
      // Auto-generate expression for dynamic data without explicit expression
      const fieldName = (component.originalContent || component.content || '').replace(/[^a-zA-Z0-9]/g, '');
      value = fieldName ? `=Fields!${fieldName}.Value` : component.content || `=[Field${index}]`;
    }

    // Escape XML special characters
    value = value.replace(/&/g, '&amp;')
                 .replace(/</g, '&lt;')
                 .replace(/>/g, '&gt;')
                 .replace(/"/g, '&quot;')
                 .replace(/'/g, '&apos;');

    // Generate textbox name based on classification
    let textboxName = `Textbox${index}`;
    if (component.classification === 'static-label') {
      textboxName = `Label${index}`;
    } else if (component.classification === 'dynamic-data') {
      const fieldName = (component.originalContent || component.content || '').replace(/[^a-zA-Z0-9]/g, '');
      textboxName = fieldName ? `Data_${fieldName}` : `DataField${index}`;
    }

    return `
      <Textbox Name="${textboxName}">
        <CanGrow>true</CanGrow>
        <KeepTogether>true</KeepTogether>
        <Paragraphs>
          <Paragraph>
            <TextRuns>
              <TextRun>
                <Value>${value}</Value>
                <Style>
                  <FontStyle>Normal</FontStyle>
                  <FontFamily>${component.styles?.fontFamily || 'Tahoma'}</FontFamily>
                  <FontSize>${component.styles?.fontSize || 11}pt</FontSize>
                  <FontWeight>Normal</FontWeight>
                  <Color>Black</Color>
                </Style>
              </TextRun>
            </TextRuns>
            <Style>
              <TextAlign>${component.styles?.alignment || 'Left'}</TextAlign>
            </Style>
          </Paragraph>
        </Paragraphs>
        <rd:DefaultName>${textboxName}</rd:DefaultName>
        <Top>${topInches}in</Top>
        <Left>${leftInches}in</Left>
        <Width>${widthInches}in</Width>
        <Height>${heightInches}in</Height>
        <ZIndex>${index}</ZIndex>
        <Style>
          <Border>
            <Style>None</Style>
          </Border>
          <PaddingLeft>2pt</PaddingLeft>
          <PaddingRight>2pt</PaddingRight>
          <PaddingTop>2pt</PaddingTop>
          <PaddingBottom>2pt</PaddingBottom>
        </Style>
      </Textbox>`;
  }

  private static generateTableXML(component: any, index: number): string {
    const topInches = (component.y / 72).toFixed(2);
    const leftInches = (component.x / 72).toFixed(2);
    const widthInches = (component.width / 72).toFixed(2);
    const heightInches = (component.height / 72).toFixed(2);

    return `
      <Tablix Name="Table${index}">
        <TablixBody>
          <TablixRows>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                ${Array(component.tableData?.columns || 3).fill(0).map((_, colIndex) => `
                <TablixCell>
                  <CellContents>
                    <Textbox Name="Table${index}_Cell${colIndex}">
                      <Value>=Fields!Column${colIndex}.Value</Value>
                    </Textbox>
                  </CellContents>
                </TablixCell>`).join('')}
              </TablixCells>
            </TablixRow>
          </TablixRows>
        </TablixBody>
        <TablixColumnHierarchy>
          <TablixMembers>
            ${Array(component.tableData?.columns || 3).fill(0).map(() => '<TablixMember />').join('')}
          </TablixMembers>
        </TablixColumnHierarchy>
        <TablixRowHierarchy>
          <TablixMembers>
            <TablixMember>
              <Group Name="Details${index}" />
            </TablixMember>
          </TablixMembers>
        </TablixRowHierarchy>
        <DataSetName>MainDataSet</DataSetName>
        <Top>${topInches}in</Top>
        <Left>${leftInches}in</Left>
        <Width>${widthInches}in</Width>
        <Height>${heightInches}in</Height>
      </Tablix>`;
  }

  private static generateGUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}