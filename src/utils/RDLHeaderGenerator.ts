export interface HeaderTextbox {
  name: string;
  value: string;
  top: string;
  left: string;
  width: string;
  height: string;
  fontSize?: string;
  fontFamily?: string;
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
            <ns0:Border />
          </ns0:Style>
        </ns0:PageHeader>`;
  }

  private static generateHeaderReportItems(headerComponents: HeaderTextbox[]): string {
    return headerComponents.map((component, index) => `
            <ns0:Textbox Name="${component.name || `Textbox${index + 1}`}">
              <ns0:CanGrow>true</ns0:CanGrow>
              <ns0:KeepTogether>true</ns0:KeepTogether>
              <ns0:Paragraphs>
                <ns0:Paragraph>
                  <ns0:TextRuns>
                    <ns0:TextRun>
                      <ns0:Value>${this.escapeXML(component.value)}</ns0:Value>
                      <ns0:Style />
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

  static commentOutBodySection(rdlContent: string): string {
    // Find and comment out the Body section
    const bodyMatch = rdlContent.match(/(<ns0:Body>[\s\S]*?<\/ns0:Body>)/);
    
    if (bodyMatch) {
      const commentedBody = `<!-- Body section commented out for further R&D
${bodyMatch[1]}
-->`;
      
      return rdlContent.replace(bodyMatch[1], commentedBody);
    }
    
    return rdlContent;
  }

  static convertPDFComponentsToHeaderTextboxes(pdfComponents: any[]): HeaderTextbox[] {
    // Filter only header components and convert them to textboxes
    return pdfComponents
      .filter(component => component.section === 'header' && component.type === 'textbox')
      .map((component, index) => ({
        name: `HeaderTextbox${index + 1}`,
        value: component.content || 'Header Text',
        top: `${(component.y / 72).toFixed(2)}in`, // Convert points to inches
        left: `${(component.x / 72).toFixed(2)}in`,
        width: `${(component.width / 72).toFixed(2)}in`,
        height: `${(component.height / 72).toFixed(2)}in`,
        fontSize: component.styles?.fontSize ? `${component.styles.fontSize}pt` : '10pt',
        fontFamily: component.styles?.fontFamily || 'Arial'
      }));
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
    
    // Step 2: Comment out body section for now
    updatedRDL = this.commentOutBodySection(updatedRDL);
    
    // Step 3: Ensure proper XML formatting and namespaces
    updatedRDL = this.ensureProperNamespaces(updatedRDL);
    
    return updatedRDL;
  }

  private static ensureProperNamespaces(rdlContent: string): string {
    // Ensure the RDL has proper namespace declarations
    if (!rdlContent.includes('xmlns:ns0=')) {
      rdlContent = rdlContent.replace(
        /<Report/,
        '<Report xmlns:ns0="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:ns1="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner"'
      );
    }
    
    return rdlContent;
  }
}