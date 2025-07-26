import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Table, Type, Download, Layers, MapPin, Grid3X3 } from "lucide-react";

interface PDFComponent {
  id: string;
  type: 'textbox' | 'table' | 'image' | 'line';
  section: 'header' | 'body' | 'footer';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setAnalysisResult(null);
      toast({
        title: "PDF Selected",
        description: `Ready to analyze: ${file.name}`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid PDF file",
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
      // Simulate PDF analysis process
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Mock analysis result
      const mockResult: AnalysisResult = {
        pages: 1,
        sections: {
          header: [
            {
              id: 'header-1',
              type: 'textbox',
              section: 'header',
              x: 50, y: 20, width: 500, height: 30,
              content: 'INVOICE',
              styles: { fontSize: 24, fontFamily: 'Arial', alignment: 'center' }
            },
            {
              id: 'header-2',
              type: 'textbox',
              section: 'header',
              x: 400, y: 60, width: 150, height: 20,
              content: 'Invoice #: [InvoiceNumber]',
              styles: { fontSize: 12, fontFamily: 'Arial' }
            }
          ],
          body: [
            {
              id: 'body-table-1',
              type: 'table',
              section: 'body',
              x: 50, y: 150, width: 500, height: 200,
              tableData: {
                rows: 5,
                columns: 4,
                cells: [
                  ['Item', 'Description', 'Qty', 'Amount'],
                  ['[Item1]', '[Description1]', '[Qty1]', '[Amount1]'],
                  ['[Item2]', '[Description2]', '[Qty2]', '[Amount2]'],
                  ['[Item3]', '[Description3]', '[Qty3]', '[Amount3]'],
                  ['', 'Total:', '', '[TotalAmount]']
                ]
              }
            }
          ],
          footer: [
            {
              id: 'footer-1',
              type: 'textbox',
              section: 'footer',
              x: 50, y: 400, width: 500, height: 15,
              content: 'Thank you for your business!',
              styles: { fontSize: 10, fontFamily: 'Arial', alignment: 'center' }
            }
          ]
        },
        components: [],
        ssrsBlueprint: generateSSRSBlueprint()
      };

      // Flatten components
      mockResult.components = [
        ...mockResult.sections.header,
        ...mockResult.sections.body,
        ...mockResult.sections.footer
      ];

      setAnalysisResult(mockResult);
      setActiveTab("results");
      
      toast({
        title: "Analysis Complete",
        description: `Found ${mockResult.components.length} components across ${mockResult.pages} page(s)`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
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
        <TabsList className="grid w-full grid-cols-3 bg-gradient-card shadow-card">
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
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card className="p-8 bg-gradient-card shadow-card border border-primary/20">
            <div className="text-center space-y-4">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 hover:border-primary/50 transition-colors">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload PDF Report Design</h3>
                    <p className="text-muted-foreground">
                      Select a PDF file containing your invoice or report layout
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload">
                    <Button variant="hero" className="cursor-pointer">
                      Choose PDF File
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
              
              {selectedFile && (
                <Button 
                  onClick={analyzePDF} 
                  disabled={isAnalyzing}
                  variant="default"
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze PDF"}
                </Button>
              )}
            </div>
          </Card>
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
          {analysisResult && (
            <>
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
      </Tabs>
    </div>
  );
};