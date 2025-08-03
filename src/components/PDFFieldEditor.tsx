import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  Move, 
  Type, 
  Table, 
  ArrowUp, 
  ArrowDown, 
  Code, 
  Database,
  Save,
  Undo
} from "lucide-react";

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

interface PDFFieldEditorProps {
  fields: PDFField[];
  onFieldsChange: (fields: PDFField[]) => void;
  onGenerateRDL: () => void;
}

export const PDFFieldEditor: React.FC<PDFFieldEditorProps> = ({
  fields,
  onFieldsChange,
  onGenerateRDL
}) => {
  const { toast } = useToast();
  const [selectedField, setSelectedField] = useState<PDFField | null>(null);
  const [editingField, setEditingField] = useState<PDFField | null>(null);
  const [history, setHistory] = useState<PDFField[][]>([fields]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Save current state to history
  const saveToHistory = useCallback((newFields: PDFField[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newFields]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo last change
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousFields = history[historyIndex - 1];
      onFieldsChange([...previousFields]);
      setHistoryIndex(historyIndex - 1);
      toast({
        title: "Undo Successful",
        description: "Reverted to previous state",
      });
    }
  }, [history, historyIndex, onFieldsChange, toast]);

  // Move field between sections
  const moveFieldToSection = useCallback((fieldId: string, newSection: 'header' | 'body' | 'footer') => {
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, section: newSection } : field
    );
    
    saveToHistory(updatedFields);
    onFieldsChange(updatedFields);
    
    toast({
      title: "Field Moved",
      description: `Field moved to ${newSection} section`,
    });
  }, [fields, onFieldsChange, saveToHistory, toast]);

  // Update field content or expression
  const updateField = useCallback((updatedField: PDFField) => {
    const updatedFields = fields.map(field =>
      field.id === updatedField.id ? updatedField : field
    );
    
    saveToHistory(updatedFields);
    onFieldsChange(updatedFields);
    setEditingField(null);
    
    toast({
      title: "Field Updated",
      description: "Field content and properties updated successfully",
    });
  }, [fields, onFieldsChange, saveToHistory, toast]);

  // Update field classification
  const updateFieldClassification = useCallback((fieldId: string, classification: 'static-label' | 'dynamic-data' | 'standalone-text') => {
    const updatedFields = fields.map(field =>
      field.id === fieldId ? { ...field, classification } : field
    );
    
    saveToHistory(updatedFields);
    onFieldsChange(updatedFields);
    
    toast({
      title: "Classification Updated",
      description: `Field classified as ${classification.replace('-', ' ')}`,
    });
  }, [fields, onFieldsChange, saveToHistory, toast]);

  // Get fields by section
  const getFieldsBySection = useCallback((section: 'header' | 'body' | 'footer') => {
    return fields.filter(field => field.section === section);
  }, [fields]);

  // Get section color
  const getSectionColor = (section: string) => {
    switch (section) {
      case 'header': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'body': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'footer': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  // Get classification color
  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'static-label': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'dynamic-data': return 'bg-cyan-500/10 text-cyan-700 border-cyan-200';
      case 'standalone-text': return 'bg-gray-500/10 text-gray-700 border-gray-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const FieldCard: React.FC<{ field: PDFField }> = ({ field }) => (
    <Card className="p-4 hover:shadow-lg transition-all duration-200 border border-border/50">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {field.type === 'textbox' ? <Type className="w-4 h-4" /> : <Table className="w-4 h-4" />}
            <span className="font-medium text-sm">{field.id}</span>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className={getSectionColor(field.section)}>
              {field.section}
            </Badge>
            {field.classification && (
              <Badge variant="outline" className={getClassificationColor(field.classification)}>
                {field.classification.replace('-', ' ')}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Position: ({field.x}, {field.y}) | Size: {field.width}×{field.height}
          </div>
          
          {field.content && (
            <div className="text-sm bg-muted/50 p-2 rounded border border-border/30">
              <span className="font-medium">Content: </span>
              {field.isExpression ? (
                <code className="text-primary">{field.expression || field.content}</code>
              ) : (
                <span>{field.content.length > 50 ? `${field.content.substring(0, 50)}...` : field.content}</span>
              )}
            </div>
          )}
          
          {field.confidence && (
            <div className="text-xs text-muted-foreground">
              Confidence: {Math.round(field.confidence * 100)}%
            </div>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setEditingField(field)}>
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Field: {field.id}</DialogTitle>
              </DialogHeader>
              <EditFieldForm field={field} onSave={updateField} onCancel={() => setEditingField(null)} />
            </DialogContent>
          </Dialog>
          
          <Select
            value={field.section}
            onValueChange={(value: 'header' | 'body' | 'footer') => moveFieldToSection(field.id, value)}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="body">Body</SelectItem>
              <SelectItem value="footer">Footer</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={field.classification || 'standalone-text'}
            onValueChange={(value: 'static-label' | 'dynamic-data' | 'standalone-text') => 
              updateFieldClassification(field.id, value)
            }
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static-label">Static Label</SelectItem>
              <SelectItem value="dynamic-data">Dynamic Data</SelectItem>
              <SelectItem value="standalone-text">Standalone Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );

  const EditFieldForm: React.FC<{
    field: PDFField;
    onSave: (field: PDFField) => void;
    onCancel: () => void;
  }> = ({ field, onSave, onCancel }) => {
    const [formData, setFormData] = useState<PDFField>({
      ...field,
      originalContent: field.originalContent || field.content
    });

    const handleSave = () => {
      onSave(formData);
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="section">Section</Label>
            <Select
              value={formData.section}
              onValueChange={(value: 'header' | 'body' | 'footer') => 
                setFormData(prev => ({ ...prev, section: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="body">Body</SelectItem>
                <SelectItem value="footer">Footer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="classification">Classification</Label>
            <Select
              value={formData.classification || 'standalone-text'}
              onValueChange={(value: 'static-label' | 'dynamic-data' | 'standalone-text') => 
                setFormData(prev => ({ ...prev, classification: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static-label">Static Label</SelectItem>
                <SelectItem value="dynamic-data">Dynamic Data</SelectItem>
                <SelectItem value="standalone-text">Standalone Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isExpression"
              checked={formData.isExpression || false}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                isExpression: e.target.checked,
                content: e.target.checked ? prev.expression || prev.content : prev.originalContent || prev.content
              }))}
            />
            <Label htmlFor="isExpression">Use as Expression/Formula</Label>
          </div>
          
          {formData.isExpression ? (
            <div>
              <Label htmlFor="expression">Expression/Formula</Label>
              <Textarea
                id="expression"
                value={formData.expression || formData.content || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  expression: e.target.value,
                  content: e.target.value 
                }))}
                placeholder="Enter SSRS expression (e.g., =Fields!CustomerName.Value, =Today(), etc.)"
                className="font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Examples: =Fields!FieldName.Value, =Parameters!ParamName.Value, =Today(), =User!UserID
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter static text content"
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          <div>
            <Label htmlFor="x">X Position</Label>
            <Input
              id="x"
              type="number"
              value={formData.x}
              onChange={(e) => setFormData(prev => ({ ...prev, x: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="y">Y Position</Label>
            <Input
              id="y"
              type="number"
              value={formData.y}
              onChange={(e) => setFormData(prev => ({ ...prev, y: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="width">Width</Label>
            <Input
              id="width"
              type="number"
              value={formData.width}
              onChange={(e) => setFormData(prev => ({ ...prev, width: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="height">Height</Label>
            <Input
              id="height"
              type="number"
              value={formData.height}
              onChange={(e) => setFormData(prev => ({ ...prev, height: Number(e.target.value) }))}
            />
          </div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">PDF Field Editor</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={undo} 
            disabled={historyIndex <= 0}
          >
            <Undo className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button onClick={onGenerateRDL} className="bg-gradient-primary">
            <Database className="w-4 h-4 mr-2" />
            Generate RDL
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Total Fields: {fields.length} | 
        Header: {getFieldsBySection('header').length} | 
        Body: {getFieldsBySection('body').length} | 
        Footer: {getFieldsBySection('footer').length}
      </div>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Fields ({fields.length})</TabsTrigger>
          <TabsTrigger value="header">Header ({getFieldsBySection('header').length})</TabsTrigger>
          <TabsTrigger value="body">Body ({getFieldsBySection('body').length})</TabsTrigger>
          <TabsTrigger value="footer">Footer ({getFieldsBySection('footer').length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {fields.map(field => (
              <FieldCard key={field.id} field={field} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="header" className="space-y-4">
          <div className="grid gap-4">
            {getFieldsBySection('header').map(field => (
              <FieldCard key={field.id} field={field} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="body" className="space-y-4">
          <div className="grid gap-4">
            {getFieldsBySection('body').map(field => (
              <FieldCard key={field.id} field={field} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="footer" className="space-y-4">
          <div className="grid gap-4">
            {getFieldsBySection('footer').map(field => (
              <FieldCard key={field.id} field={field} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};