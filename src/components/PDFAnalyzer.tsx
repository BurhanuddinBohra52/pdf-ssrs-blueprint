import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Table, Type, Download, Layers, MapPin, Grid3X3, Database, Edit3 } from "lucide-react";
import { PDFParser, PDFAnalysisResult as PDFParserResult } from "@/utils/PDFParser";
import { EnhancedPDFParser } from "@/utils/EnhancedPDFParser";
import { RDLGenerator, PDFAnalysisResult } from "@/utils/RDLGenerator";
import { RDLHeaderGenerator, HeaderTextbox } from "@/utils/RDLHeaderGenerator";
import { PDFFieldEditor } from "@/components/PDFFieldEditor";

interface PDFComponent {
  id: string;
  type: 'textbox' | 'table' | 'image' | 'line';
  section: 'header' | 'body' | 'footer';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  originalContent?: string;
  expression?: string;
  isExpression?: boolean;
  classification?: 'static-label' | 'dynamic-data' | 'standalone-text';
  confidence?: number;
  styles?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    alignment?: string;
  };
  tableData?: {
    rows: number;
    columns: number;
    cells: string[][];
  };
}

interface AnalysisResult {
  pages: number;
  sections: {
    header: PDFComponent[];
    body: PDFComponent[];
    footer: PDFComponent[];
  };
  components: PDFComponent[];
  ssrsBlueprint: string;
}

export const PDFAnalyzer = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [baseRDLFile, setBaseRDLFile] = useState<File | null>(null);
  const [baseRDLContent, setBaseRDLContent] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<any | null>(null);
  const [editableFields, setEditableFields] = useState<PDFComponent[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input triggered", event.target.files);
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      console.log("Valid PDF selected:", file.name);
      setSelectedFile(file);
      setAnalysisResult(null);
      toast({
        title: "PDF Selected",
        description: `Ready to analyze: ${file.name}`,
      });
    } else {
      console.log("Invalid file selected:", file?.type);
      toast({
        title: "Invalid File",
        description: "Please select a valid PDF file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleBaseRDLSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.rdl') || file.type === 'text/xml' || file.type === 'application/xml')) {
      try {
        const content = await file.text();
        setBaseRDLFile(file);
        setBaseRDLContent(content);
        toast({
          title: "Base RDL Loaded",
          description: `Ready to use: ${file.name}`,
        });
      } catch (error) {
        toast({
          title: "Error Reading RDL",
          description: "Failed to read the RDL file content",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid RDL file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const analyzePDF = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setProgress(0);
    setActiveTab("analysis");

    try {
      // Step 1: Enhanced PDF analysis with smart header detection
      setProgress(20);
      console.log('Starting enhanced PDF analysis for:', selectedFile.name);
      
      const enhancedResult = await EnhancedPDFParser.parsePDF(selectedFile);
      setProgress(40);
      
      console.log('Enhanced Analysis Result:', enhancedResult);
      console.log('Header analysis:', enhancedResult.headerAnalysis);
      console.log('Static labels:', enhancedResult.headerAnalysis.staticLabels.length);
      console.log('Dynamic data:', enhancedResult.headerAnalysis.dynamicData.length);
      console.log('Label-data pairs:', enhancedResult.headerAnalysis.labelDataPairs.length);
      
      // Step 2: Legacy analysis for compatibility
      const pdfAnalysis = await PDFParser.parsePDF(selectedFile);
      setProgress(70);
      
      // Step 3: Convert to component format
      const analysisResult = convertPDFAnalysisToComponents(pdfAnalysis);
      setProgress(90);
      
      setAnalysisResult(analysisResult);
      setEnhancedAnalysis(enhancedResult);
      
      // Convert to editable fields with enhanced data
      const editableFieldsData = convertToEditableFields(analysisResult.components, enhancedResult);
      setEditableFields(editableFieldsData);
      
      setProgress(100);
      setActiveTab("results");
      
      const headerComponentsCount = enhancedResult.headerAnalysis.staticLabels.length + 
                                   enhancedResult.headerAnalysis.dynamicData.length + 
                                   enhancedResult.headerAnalysis.standaloneText.length;
      const pairsCount = enhancedResult.headerAnalysis.labelDataPairs.length;
      const staticCount = enhancedResult.headerAnalysis.staticLabels.length;
      const dynamicCount = enhancedResult.headerAnalysis.dynamicData.length;
      const isAIEnhanced = enhancedResult.headerAnalysis.aiEnhanced;
      const confidence = Math.round(enhancedResult.headerAnalysis.confidence * 100);
      
      toast({
        title: `${isAIEnhanced ? 'AI-Enhanced' : 'Smart'} Analysis Complete`,
        description: `Found ${staticCount} labels, ${dynamicCount} data fields, ${pairsCount} pairs (${confidence}% confidence)`,
      });
    } catch (error) {
      console.error('PDF Analysis Error:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const convertToEditableFields = (components: PDFComponent[], enhancedResult: any): PDFComponent[] => {
    const editableFields: PDFComponent[] = [];
    
    // Add components from enhanced analysis
    if (enhancedResult?.headerAnalysis) {
      const headerAnalysis = enhancedResult.headerAnalysis;
      
      // Determine proper section for each component based on Y position
      const determineSection = (y: number, pageHeight: number): 'header' | 'body' | 'footer' => {
        const headerThreshold = pageHeight * 0.2; // Top 20%
        const footerThreshold = pageHeight * 0.8;  // Bottom 20%
        
        if (y < headerThreshold) return 'header';
        if (y > footerThreshold) return 'footer';
        return 'body';
      };

      // Find the page dimensions from all components
      const allComponents = [
        ...headerAnalysis.staticLabels,
        ...headerAnalysis.dynamicData,
        ...headerAnalysis.standaloneText
      ];
      const maxY = Math.max(...allComponents.map((comp: any) => comp.y + (comp.height || 20)));
      const minY = Math.min(...allComponents.map((comp: any) => comp.y));
      const pageHeight = maxY - minY;

      // Process static labels
      headerAnalysis.staticLabels.forEach((label: any, index: number) => {
        const section = determineSection(label.y || 0, pageHeight);
        editableFields.push({
          id: `${section}-static-${index}`,
          type: 'textbox',
          section,
          x: label.x || 0,
          y: label.y || 0,
          width: label.width || 100,
          height: label.height || 20,
          content: label.text,
          originalContent: label.text,
          classification: 'static-label',
          confidence: label.confidence,
          styles: {
            fontSize: label.fontSize,
            fontFamily: label.fontFamily
          }
        });
      });
      
      // Process dynamic data
      headerAnalysis.dynamicData.forEach((data: any, index: number) => {
        const section = determineSection(data.y || 0, pageHeight);
        editableFields.push({
          id: `${section}-dynamic-${index}`,
          type: 'textbox',
          section,
          x: data.x || 0,
          y: data.y || 0,
          width: data.width || 100,
          height: data.height || 20,
          content: data.text,
          originalContent: data.text,
          classification: 'dynamic-data',
          confidence: data.confidence,
          isExpression: true,
          expression: `=Fields!${data.text.replace(/[^a-zA-Z0-9]/g, '')}.Value`,
          styles: {
            fontSize: data.fontSize,
            fontFamily: data.fontFamily
          }
        });
      });
      
      // Process standalone text
      headerAnalysis.standaloneText.forEach((text: any, index: number) => {
        const section = determineSection(text.y || 0, pageHeight);
        editableFields.push({
          id: `${section}-standalone-${index}`,
          type: 'textbox',
          section,
          x: text.x || 0,
          y: text.y || 0,
          width: text.width || 100,
          height: text.height || 20,
          content: text.text,
          originalContent: text.text,
          classification: 'standalone-text',
          confidence: text.confidence,
          styles: {
            fontSize: text.fontSize,
            fontFamily: text.fontFamily
          }
        });
      });
    }
    
    // Add remaining components that weren't in enhanced analysis
    components.forEach((component, index) => {
      const exists = editableFields.some(field => 
        Math.abs(field.x - component.x) < 10 && 
        Math.abs(field.y - component.y) < 10 &&
        field.content === component.content
      );
      
      if (!exists) {
        editableFields.push({
          ...component,
          originalContent: component.content,
          classification: component.section === 'header' ? 'static-label' : 'standalone-text'
        });
      }
    });
    
    return editableFields;
  };

  const convertPDFAnalysisToComponents = (pdfAnalysis: PDFParserResult): AnalysisResult => {
    const components: PDFComponent[] = [];
    const sections = {
      header: [] as PDFComponent[],
      body: [] as PDFComponent[],
      footer: [] as PDFComponent[]
    };

    // Better section classification based on Y position
    const allItems = pdfAnalysis.sections.flatMap(section => 
      section.items.map(item => ({...item, originalSection: section.type}))
    );
    
    // Calculate page dimensions for better section classification
    const maxY = Math.max(...allItems.map(item => item.y + (item.height || 20)));
    const minY = Math.min(...allItems.map(item => item.y));
    const pageHeight = maxY - minY;
    
    // Define section thresholds
    const headerThreshold = minY + (pageHeight * 0.25); // Top 25%
    const footerThreshold = maxY - (pageHeight * 0.15);  // Bottom 15%

    // Convert each item to component with proper section classification
    allItems.forEach((item, itemIndex) => {
      // Determine proper section based on Y position
      let section: 'header' | 'body' | 'footer' = 'body';
      if (item.y < headerThreshold) {
        section = 'header';
      } else if (item.y + (item.height || 20) > footerThreshold) {
        section = 'footer';
      }

      const component: PDFComponent = {
        id: `${section}-${itemIndex}`,
        type: 'textbox',
        section: section,
        x: Math.round(item.x),
        y: Math.round(item.y),
        width: Math.round(item.width || 100),
        height: Math.round(item.height || 20),
        content: item.text,
        styles: {
          fontSize: Math.round(item.fontSize),
          fontFamily: item.fontFamily,
          alignment: 'left'
        }
      };
      
      components.push(component);
      sections[section].push(component);
    });

    // Convert detected tables to table components
    pdfAnalysis.tables.forEach((table, tableIndex) => {
      const tableComponent: PDFComponent = {
        id: `table-${tableIndex}`,
        type: 'table',
        section: 'body',
        x: Math.round(table.boundingBox.x),
        y: Math.round(table.boundingBox.y),
        width: Math.round(table.boundingBox.width),
        height: Math.round(table.boundingBox.height),
        tableData: {
          rows: table.rows,
          columns: table.columns,
          cells: generateTableCellsFromPDF(table)
        }
      };
      
      components.push(tableComponent);
      sections.body.push(tableComponent);
    });

    return {
      pages: 1,
      sections,
      components,
      ssrsBlueprint: generateSSRSBlueprint()
    };
  };

  const generateTableCellsFromPDF = (table: any): string[][] => {
    // Create a 2D array for the table cells
    const cells: string[][] = Array(table.rows).fill(null).map(() => Array(table.columns).fill(''));
    
    // Fill the cells with actual data from PDF
    table.cells.forEach((cell: any) => {
      if (cell.row < table.rows && cell.column < table.columns) {
        cells[cell.row][cell.column] = cell.text;
      }
    });
    
    return cells;
  };

  const generateSSRSBlueprint = () => {
    return `<?xml version="1.0" encoding="utf-8"?>
<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition">
  <Body>
    <ReportItems>
      <!-- Header Section -->
      <Rectangle Name="HeaderSection">
        <Top>0in</Top>
        <Left>0in</Left>
        <Width>8.5in</Width>
        <Height>1.5in</Height>
        <ReportItems>
          <Textbox Name="InvoiceTitle">
            <CanGrow>true</CanGrow>
            <Value>INVOICE</Value>
            <Style>
              <FontSize>24pt</FontSize>
              <FontWeight>Bold</FontWeight>
              <TextAlign>Center</TextAlign>
            </Style>
            <Top>0.2in</Top>
            <Left>0.5in</Left>
            <Width>5in</Width>
            <Height>0.3in</Height>
          </Textbox>
        </ReportItems>
      </Rectangle>
      
      <!-- Body Table -->
      <Tablix Name="InvoiceTable">
        <TablixBody>
          <TablixRows>
            <TablixRow>
              <Height>0.25in</Height>
              <TablixCells>
                <TablixCell>
                  <CellContents>
                    <Textbox Name="ItemHeader">
                      <Value>Item</Value>
                      <Style>
                        <FontWeight>Bold</FontWeight>
                      </Style>
                    </Textbox>
                  </CellContents>
                </TablixCell>
                <!-- Additional columns... -->
              </TablixCells>
            </TablixRow>
          </TablixRows>
        </TablixBody>
        <Top>2in</Top>
        <Left>0.5in</Left>
        <Width>7.5in</Width>
        <Height>3in</Height>
      </Tablix>
    </ReportItems>
    <Height>6in</Height>
  </Body>
  <Width>8.5in</Width>
  <Page>
    <PageHeight>11in</PageHeight>
    <PageWidth>8.5in</PageWidth>
  </Page>
</Report>`;
  };

  const downloadBlueprint = () => {
    if (!analysisResult) return;
    
    const blob = new Blob([analysisResult.ssrsBlueprint], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile?.name.replace('.pdf', '')}_ssrs_blueprint.rdl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download Complete",
      description: "SSRS blueprint downloaded successfully",
    });
  };

  const generateRDLTemplate = () => {
    if (!analysisResult && !editableFields.length) return '';
    
    // Create proper PDFAnalysisResult structure
    const pdfAnalysisResult: PDFAnalysisResult = {
      tables: analysisResult?.sections.body
        .filter(comp => comp.type === 'table')
        .map(comp => ({
          headers: comp.tableData?.cells[0] || [],
          rows: comp.tableData?.cells.slice(1) || [],
          position: { x: comp.x, y: comp.y, width: comp.width, height: comp.height },
          merged_cells: []
        })) || [],
      textElements: (editableFields.length > 0 ? editableFields : analysisResult?.components || [])
        .filter(comp => comp.type === 'textbox')
        .map(comp => ({
          content: comp.content || '',
          position: { x: comp.x, y: comp.y, width: comp.width, height: comp.height },
          classification: comp.section as 'header' | 'footer' | 'label' | 'data',
          styles: comp.styles
        }))
    };
    
    return RDLGenerator.generateRDLTemplate([], [], pdfAnalysisResult);
  };

  const handleFieldsChange = (updatedFields: PDFComponent[]) => {
    setEditableFields(updatedFields);
  };

  const handleGenerateRDLFromEditor = () => {
    downloadRDLTemplate();
  };

  const downloadRDLTemplate = () => {
    if (!analysisResult) return;
    
    const rdlContent = generateRDLTemplate();
    const blob = new Blob([rdlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile?.name.replace('.pdf', '')}_rdl_template.rdl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "RDL Template Downloaded",
      description: "RDL template with data source and dataset fields ready for editing",
    });
  };

  const generateExecutableRDL = () => {
    if ((!analysisResult && !enhancedAnalysis) || !baseRDLContent) {
      toast({
        title: "Missing Requirements",
        description: "Please upload both PDF and base RDL files",
        variant: "destructive",
      });
      return;
    }

    try {
      let headerTextboxes;
      
      // Use enhanced analysis if available for better results
      if (enhancedAnalysis) {
        headerTextboxes = RDLHeaderGenerator.convertEnhancedHeaderAnalysis(enhancedAnalysis.headerAnalysis);
        console.log('Using enhanced header analysis:', headerTextboxes);
      } else {
        headerTextboxes = RDLHeaderGenerator.convertPDFComponentsToHeaderTextboxes(analysisResult.components);
      }
      
      // Generate executable RDL with updated header
      const executableRDL = RDLHeaderGenerator.generateExecutableRDL(baseRDLContent, headerTextboxes);
      
      return executableRDL;
    } catch (error) {
      console.error('Error generating executable RDL:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate executable RDL. Please check your base RDL file.",
        variant: "destructive",
      });
      return '';
    }
  };

  const downloadExecutableRDL = () => {
    const rdlContent = generateExecutableRDL();
    if (!rdlContent) return;
    
    const blob = new Blob([rdlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile?.name.replace('.pdf', '')}_executable.rdl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Executable RDL Downloaded",
      description: "Executable RDL with updated header ready for deployment",
    });
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'textbox': return <Type className="w-4 h-4" />;
      case 'table': return <Table className="w-4 h-4" />;
      case 'image': return <Grid3X3 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'header': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'body': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'footer': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-gradient-primary rounded-lg shadow-glow">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              PDF to SSRS Converter
            </h1>
            <p className="text-muted-foreground mt-2">
              Analyze PDF layouts and generate SSRS report blueprints
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gradient-card shadow-card">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload PDF
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" disabled={!analysisResult}>
            <Grid3X3 className="w-4 h-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex items-center gap-2" disabled={!editableFields.length}>
            <Edit3 className="w-4 h-4" />
            Field Editor
          </TabsTrigger>
          <TabsTrigger value="rdl" className="flex items-center gap-2" disabled={!analysisResult}>
            <Database className="w-4 h-4" />
            RDL Template
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-gradient-card shadow-card border border-primary/20">
              <div className="text-center space-y-4">
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Upload PDF Report Design</h3>
                      <p className="text-muted-foreground text-sm">
                        Select a PDF file containing your report layout
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <Button variant="hero" asChild>
                        <span>Choose PDF File</span>
                      </Button>
                    </label>
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        {selectedFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card shadow-card border border-secondary/20">
              <div className="text-center space-y-4">
                <div className="border-2 border-dashed border-secondary/30 rounded-lg p-6 hover:border-secondary/50 transition-colors">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-secondary/10 rounded-full">
                      <Database className="w-6 h-6 text-secondary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Upload Base RDL File (Optional)</h3>
                      <p className="text-muted-foreground text-sm">
                        Upload an existing RDL file to preserve data sources (optional)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".rdl,.xml"
                      onChange={handleBaseRDLSelect}
                      className="hidden"
                      id="rdl-upload"
                    />
                    <label htmlFor="rdl-upload" className="cursor-pointer">
                      <Button variant="secondary" asChild>
                        <span>Choose RDL File</span>
                      </Button>
                    </label>
                    {baseRDLFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Database className="w-4 h-4" />
                        {baseRDLFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
          
          {selectedFile && (
            <Card className="p-6 bg-gradient-card shadow-card">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Ready to Analyze PDF</h3>
                    <p className="text-muted-foreground">
                      PDF file uploaded. Click analyze to generate RDL.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={analyzePDF} 
                  disabled={isAnalyzing}
                  variant="default"
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze PDF"}
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card className="p-6 bg-gradient-card shadow-card">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">PDF Analysis in Progress</h3>
              </div>
              <Progress value={progress} className="w-full" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress > 20 ? 'bg-primary' : 'bg-muted'}`} />
                  Document Parsing
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress > 40 ? 'bg-primary' : 'bg-muted'}`} />
                  Layout Detection
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress > 70 ? 'bg-primary' : 'bg-muted'}`} />
                  Component Analysis
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress > 90 ? 'bg-primary' : 'bg-muted'}`} />
                  SSRS Generation
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {(analysisResult || enhancedAnalysis) && (
            <>
              {enhancedAnalysis && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="p-6 bg-gradient-card shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Type className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Static Labels</h3>
                          <p className="text-2xl font-bold text-primary">
                            {enhancedAnalysis.headerAnalysis.staticLabels.length}
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6 bg-gradient-card shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Database className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Dynamic Data</h3>
                          <p className="text-2xl font-bold text-primary">
                            {enhancedAnalysis.headerAnalysis.dynamicData.length}
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6 bg-gradient-card shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <MapPin className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Label-Data Pairs</h3>
                          <p className="text-2xl font-bold text-primary">
                            {enhancedAnalysis.headerAnalysis.labelDataPairs.length}
                          </p>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-6 bg-gradient-card shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <FileText className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Standalone Text</h3>
                          <p className="text-2xl font-bold text-primary">
                            {enhancedAnalysis.headerAnalysis.standaloneText.length}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6 bg-gradient-card shadow-card">
                    <h3 className="text-lg font-semibold mb-4">Smart Header Analysis</h3>
                    
                    <div className="space-y-6">
                      {/* Label-Data Pairs */}
                      {enhancedAnalysis.headerAnalysis.labelDataPairs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-blue-600 mb-3">Label-Data Pairs Detected</h4>
                          <div className="space-y-2">
                            {enhancedAnalysis.headerAnalysis.labelDataPairs.map((pair: any, index: number) => (
                              <div key={index} className="flex items-center gap-4 p-3 bg-blue-500/5 rounded-lg border border-blue-200/30">
                                <div className="bg-blue-500/10 px-3 py-1 rounded text-sm font-medium text-blue-700">
                                  {pair.label.text}
                                </div>
                                <div className="text-muted-foreground">→</div>
                                <div className="bg-green-500/10 px-3 py-1 rounded text-sm text-green-700">
                                  {pair.data.text}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {pair.label.fontSize}pt, {pair.label.fontFamily}
                                  {pair.label.fontWeight !== 'normal' && `, ${pair.label.fontWeight}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Static Labels */}
                      {enhancedAnalysis.headerAnalysis.staticLabels.length > 0 && (
                        <div>
                          <h4 className="font-medium text-purple-600 mb-3">Static Labels</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {enhancedAnalysis.headerAnalysis.staticLabels
                              .filter((label: any) => !label.pairedWith)
                              .map((label: any, index: number) => (
                                <div key={index} className="bg-purple-500/10 px-3 py-2 rounded text-sm text-purple-700">
                                  <div className="font-medium">{label.text}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {label.fontSize}pt, {label.fontFamily}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Dynamic Data */}
                      {enhancedAnalysis.headerAnalysis.dynamicData.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-600 mb-3">Dynamic Data</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {enhancedAnalysis.headerAnalysis.dynamicData
                              .filter((data: any) => !data.pairedWith)
                              .map((data: any, index: number) => (
                                <div key={index} className="bg-green-500/10 px-3 py-2 rounded text-sm text-green-700">
                                  <div className="font-medium">{data.text}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {data.fontSize}pt, {data.fontFamily}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {analysisResult && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-gradient-card shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Layers className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Header Components</h3>
                        <p className="text-2xl font-bold text-primary">
                          {analysisResult.sections.header.length}
                        </p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-6 bg-gradient-card shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Grid3X3 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Body Components</h3>
                        <p className="text-2xl font-bold text-primary">
                          {analysisResult.sections.body.length}
                        </p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-6 bg-gradient-card shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <MapPin className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Footer Components</h3>
                        <p className="text-2xl font-bold text-primary">
                          {analysisResult.sections.footer.length}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              <Card className="p-6 bg-gradient-card shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Detected Components</h3>
                  <Button onClick={downloadBlueprint} variant="hero">
                    <Download className="w-4 h-4" />
                    Download SSRS Blueprint
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {analysisResult.components.map((component) => (
                    <div
                      key={component.id}
                      className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/50"
                    >
                      <div className="flex items-center gap-2">
                        {getComponentIcon(component.type)}
                        <span className="font-medium capitalize">{component.type}</span>
                      </div>
                      
                      <Badge variant="outline" className={getSectionColor(component.section)}>
                        {component.section}
                      </Badge>
                      
                      <div className="text-sm text-muted-foreground">
                        Position: ({component.x}, {component.y}) | 
                        Size: {component.width}×{component.height}
                      </div>
                      
                      {component.content && (
                        <div className="text-sm bg-muted/50 px-2 py-1 rounded">
                          {component.content.length > 30 
                            ? `${component.content.substring(0, 30)}...` 
                            : component.content}
                        </div>
                      )}
                      
                      {component.tableData && (
                        <div className="text-sm bg-muted/50 px-2 py-1 rounded">
                          Table: {component.tableData.rows}×{component.tableData.columns}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 bg-gradient-card shadow-card">
                <h3 className="text-lg font-semibold mb-4">SSRS Blueprint Preview</h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                    {analysisResult.ssrsBlueprint.substring(0, 1000)}...
                  </pre>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-6">
          {editableFields.length > 0 && (
            <PDFFieldEditor 
              fields={editableFields}
              onFieldsChange={handleFieldsChange}
              onGenerateRDL={handleGenerateRDLFromEditor}
            />
          )}
        </TabsContent>

        <TabsContent value="rdl" className="space-y-6">
          {analysisResult && (
            <>
              <Card className="p-6 bg-gradient-card shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Database className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Download RDL</h3>
                      <p className="text-muted-foreground">
                        Download complete RDL with enhanced PDF layout analysis
                      </p>
                    </div>
                  </div>
                  <Button onClick={downloadRDLTemplate} variant="default" size="lg">
                    <Download className="w-4 h-4" />
                    Download RDL
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">RDL Features:</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Complete data source configuration
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Enhanced PDF table structure analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Proper header and body section separation
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Dataset with customizable fields
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Ready for SSRS deployment
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Components Found:</h4>
                    <div className="space-y-2">
                      <div className="text-sm bg-blue-500/10 p-2 rounded border border-blue-200">
                        <span className="font-medium text-blue-700">Header:</span> {analysisResult.sections.header.length} components
                      </div>
                      <div className="text-sm bg-green-500/10 p-2 rounded border border-green-200">
                        <span className="font-medium text-green-700">Body:</span> {analysisResult.sections.body.length} components
                      </div>
                      <div className="text-sm bg-purple-500/10 p-2 rounded border border-purple-200">
                        <span className="font-medium text-purple-700">Tables:</span> {analysisResult.sections.body.filter(c => c.type === 'table').length} detected
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-card shadow-card">
                <h3 className="text-lg font-semibold mb-4">RDL Preview</h3>
                <div className="bg-muted/30 p-4 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap">
                    {generateRDLTemplate().substring(0, 2000)}...
                  </pre>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This is a preview of the RDL file with proper component placement and table structures.
                </p>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};