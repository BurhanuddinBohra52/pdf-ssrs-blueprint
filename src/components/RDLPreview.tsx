import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Type, Table, FileText } from "lucide-react";

interface PDFField {
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

interface RDLPreviewProps {
  fields: PDFField[];
}

export const RDLPreview: React.FC<RDLPreviewProps> = ({ fields }) => {
  const fieldsBySection = useMemo(() => {
    const sections = {
      header: fields.filter(field => field.section === 'header'),
      body: fields.filter(field => field.section === 'body'),
      footer: fields.filter(field => field.section === 'footer'),
    };
    return sections;
  }, [fields]);

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'header': return 'bg-blue-500/10 border-blue-200';
      case 'body': return 'bg-green-500/10 border-green-200';
      case 'footer': return 'bg-purple-500/10 border-purple-200';
      default: return 'bg-gray-500/10 border-gray-200';
    }
  };

  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'static-label': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'dynamic-data': return 'bg-cyan-500/10 text-cyan-700 border-cyan-200';
      case 'standalone-text': return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const FieldPreview: React.FC<{ field: PDFField }> = ({ field }) => (
    <div 
      className="absolute border border-border/30 bg-background/90 backdrop-blur-sm rounded-sm p-1 text-xs hover:z-10 hover:shadow-lg transition-all cursor-pointer"
      style={{
        left: `${(field.x / 10)}px`,
        top: `${(field.y / 10)}px`,
        width: `${Math.max(60, field.width / 10)}px`,
        height: `${Math.max(20, field.height / 10)}px`,
      }}
      title={`${field.id} - ${field.content}`}
    >
      <div className="flex items-center gap-1 mb-1">
        {field.type === 'textbox' ? <Type className="w-2 h-2" /> : <Table className="w-2 h-2" />}
        <span className="font-medium truncate text-xs">{field.id}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className={`${getClassificationColor(field.classification)} text-xs px-1 py-0 h-4`}>
          {field.classification?.charAt(0).toUpperCase()}
        </Badge>
        {field.isExpression && (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200 text-xs px-1 py-0 h-4">
            Expr
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate mt-1">
        {field.isExpression ? field.expression : field.content}
      </div>
    </div>
  );

  const SectionPreview: React.FC<{ 
    title: string; 
    fields: PDFField[]; 
    section: 'header' | 'body' | 'footer' 
  }> = ({ title, fields, section }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="outline" className={getSectionColor(section)}>
          {fields.length} fields
        </Badge>
      </div>
      <Card className={`p-4 min-h-32 relative overflow-hidden ${getSectionColor(section)}`}>
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative">
          {fields.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              No fields in {section}
            </div>
          ) : (
            <div className="relative h-32 overflow-hidden">
              {fields.map(field => (
                <FieldPreview key={field.id} field={field} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const RDLStructureTree = () => (
    <div className="space-y-2 text-sm font-mono">
      <div className="font-semibold text-primary">RDL Structure:</div>
      <div className="ml-2">
        <div>📄 Report</div>
        <div className="ml-4">
          <div>📊 DataSources</div>
          <div>📋 DataSets</div>
          <div>⚙️ ReportParameters</div>
          <div>📑 ReportSections</div>
          <div className="ml-4">
            <div>📄 ReportSection</div>
            <div className="ml-4">
              {fieldsBySection.header.length > 0 && (
                <div className="text-blue-600">
                  📝 PageHeader ({fieldsBySection.header.length} items)
                </div>
              )}
              <div className="text-green-600">
                📄 Body ({fieldsBySection.body.length} items)
              </div>
              {fieldsBySection.footer.length > 0 && (
                <div className="text-purple-600">
                  📝 PageFooter ({fieldsBySection.footer.length} items)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ScrollArea className="h-[60vh] w-full">
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">RDL Visual Preview</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Report Layout</h3>
            
            {fieldsBySection.header.length > 0 && (
              <SectionPreview 
                title="Header Section" 
                fields={fieldsBySection.header} 
                section="header" 
              />
            )}
            
            <SectionPreview 
              title="Body Section" 
              fields={fieldsBySection.body} 
              section="body" 
            />
            
            {fieldsBySection.footer.length > 0 && (
              <SectionPreview 
                title="Footer Section" 
                fields={fieldsBySection.footer} 
                section="footer" 
              />
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Structure Overview</h3>
            <Card className="p-4">
              <RDLStructureTree />
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-3">Field Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Fields:</span>
                  <Badge variant="outline">{fields.length}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>Static Labels:</span>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">
                    {fields.filter(f => f.classification === 'static-label').length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Dynamic Data:</span>
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-200">
                    {fields.filter(f => f.classification === 'dynamic-data').length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Standalone Text:</span>
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-200">
                    {fields.filter(f => f.classification === 'standalone-text').length}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span>With Expressions:</span>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                    {fields.filter(f => f.isExpression).length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tables:</span>
                  <Badge variant="outline">
                    {fields.filter(f => f.type === 'table').length}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card className="p-4">
          <h4 className="font-medium mb-3">Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">S</Badge>
              <span>Static Label</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 border-cyan-200">D</Badge>
              <span>Dynamic Data</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-gray-500/10 text-gray-700 border-gray-200">T</Badge>
              <span>Standalone Text</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">Expr</Badge>
              <span>Has Expression</span>
            </div>
          </div>
        </Card>
      </div>
    </ScrollArea>
  );
};