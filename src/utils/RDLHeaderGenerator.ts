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

export class RDLHeaderGenerator {
  static updateHeaderInRDL(baseRDLContent: string, headerComponents: HeaderTextbox[]): string {
    // Generate complete PageHeader structure based on analyzed PDF components
    const newHeaderContent = this.generateCompletePageHeader(headerComponents);
    
    // Replace the entire PageHeader section in the RDL
    return baseRDLContent.replace(
      /<ns0:PageHeader>([\s\S]*?)<\/ns0:PageHeader>/,
      newHeaderContent
    );
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
                         <ns0:FontWeight>${component.fontWeight || 'Normal'}</ns0:FontWeight>
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
    // Enhanced conversion supporting smart header analysis results
    return pdfComponents
      .filter(component => 
        component.text && // Must have text content
        component.text.trim() !== '' && // Content must not be empty
        component.text.trim().toLowerCase() !== 'header text' && // Exclude generic "Header Text"
        !component.text.trim().match(/^header\s*text$/i) // Case-insensitive match for variations
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
        fontWeight: component.fontWeight || 'normal',
        color: component.color || '#000000',
        isItalic: component.isItalic || false,
        type: component.type || 'standalone-text',
        confidence: component.confidence || 0.5
      }));
  }

  static convertEnhancedHeaderAnalysis(headerAnalysis: any): HeaderTextbox[] {
    // Convert enhanced header analysis to textboxes
    const allComponents = [
      ...headerAnalysis.staticLabels,
      ...headerAnalysis.dynamicData,
      ...headerAnalysis.standaloneText
    ];
    
    return this.convertPDFComponentsToHeaderTextboxes(allComponents);
  }

  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static generateExecutableRDL(baseRDLContent: string, headerComponents: HeaderTextbox[]): string {
    // Step 1: Update header with new components
    let updatedRDL = this.updateHeaderInRDL(baseRDLContent, headerComponents);
    
    // Step 2: Ensure proper XML formatting and namespaces
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
