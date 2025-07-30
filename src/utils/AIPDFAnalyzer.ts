// AI-powered PDF analyzer using Hugging Face transformers for better element classification
import { pipeline } from '@huggingface/transformers';

export interface AIClassificationResult {
  label: 'static-label' | 'dynamic-data' | 'standalone-text';
  score: number;
  reasoning: string;
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
  };
}

export class AIPDFAnalyzer {
  private static textClassifier: any = null;
  private static isLoading = false;

  static async initializeModel(): Promise<void> {
    if (this.textClassifier || this.isLoading) return;
    
    this.isLoading = true;
    try {
      // Use a lightweight text classification model for web
      this.textClassifier = await pipeline(
        'text-classification',
        'distilbert-base-uncased-finetuned-sst-2-english',
        {
          device: 'webgpu' // Use WebGPU if available, fallback to CPU
        }
      );
      console.log('AI model initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize WebGPU, falling back to CPU');
      try {
        this.textClassifier = await pipeline(
          'text-classification',
          'distilbert-base-uncased-finetuned-sst-2-english'
        );
      } catch (fallbackError) {
        console.error('Failed to initialize AI model:', fallbackError);
        this.textClassifier = null;
      }
    } finally {
      this.isLoading = false;
    }
  }

  static async analyzeComponents(components: EnhancedPDFComponent[]): Promise<EnhancedPDFComponent[]> {
    // Initialize model if needed
    await this.initializeModel();

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

  private static async classifyTextComponent(component: EnhancedPDFComponent): Promise<AIClassificationResult> {
    const text = component.text.trim();
    
    // Rule-based classification first (fast and reliable)
    const ruleBasedResult = this.ruleBasedClassification(text, component);
    
    // If rule-based is confident, use it
    if (ruleBasedResult.score > 0.8) {
      return ruleBasedResult;
    }

    // Use AI model for uncertain cases
    if (this.textClassifier) {
      try {
        const aiResult = await this.aiClassification(text, component);
        // Combine rule-based and AI results with weighted average
        return this.combineClassifications(ruleBasedResult, aiResult);
      } catch (error) {
        console.warn('AI classification failed, using rule-based:', error);
      }
    }

    return ruleBasedResult;
  }

  private static ruleBasedClassification(text: string, component: EnhancedPDFComponent): AIClassificationResult {
    const upperText = text.toUpperCase();
    
    // Strong indicators for static labels
    const staticPatterns = [
      /^(SHIP TO|BILL TO|SOLD TO|FROM|TO|DATE|ORDER|PO|INVOICE|CUSTOMER):?$/i,
      /^[A-Z\s]{3,20}:$/,
      /^(TOTAL|SUBTOTAL|TAX|AMOUNT|QTY|QUANTITY|DESCRIPTION|PRICE):?$/i,
      /^(NAME|COMPANY|ADDRESS|PHONE|EMAIL|FAX|ACCOUNT):?$/i
    ];

    const dynamicPatterns = [
      /^\d+([.,]\d+)*$/, // Numbers
      /^\$\d+([.,]\d{2})?$/, // Currency
      /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/, // Dates
      /@\w+\.\w+/, // Emails
      /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/, // Phone numbers
      /^[a-z]/, // Starts with lowercase (often data)
      /.{30,}/ // Long text (likely data)
    ];

    // Check for static label patterns
    if (staticPatterns.some(pattern => pattern.test(text))) {
      return {
        label: 'static-label',
        score: 0.9,
        reasoning: 'Matches known static label patterns'
      };
    }

    // Check for dynamic data patterns
    if (dynamicPatterns.some(pattern => pattern.test(text))) {
      return {
        label: 'dynamic-data',
        score: 0.85,
        reasoning: 'Matches known dynamic data patterns'
      };
    }

    // Font-based hints
    if (component.fontWeight === 'bold' && text.length < 20) {
      return {
        label: 'static-label',
        score: 0.7,
        reasoning: 'Bold and short text suggests label'
      };
    }

    if (component.fontSize && component.fontSize > 14) {
      return {
        label: 'static-label',
        score: 0.6,
        reasoning: 'Large font size suggests header/label'
      };
    }

    // Default to standalone text with low confidence
    return {
      label: 'standalone-text',
      score: 0.5,
      reasoning: 'Could not determine specific type'
    };
  }

  private static async aiClassification(text: string, component: EnhancedPDFComponent): Promise<AIClassificationResult> {
    if (!this.textClassifier) {
      throw new Error('AI model not initialized');
    }

    // Create context-aware prompt for better classification
    const contextPrompt = this.createContextPrompt(text, component);
    
    try {
      const result = await this.textClassifier(contextPrompt);
      
      // Map sentiment analysis to our classification
      // This is a simplification - in production, you'd use a custom trained model
      const sentiment = result[0];
      
      if (sentiment.label === 'POSITIVE' && sentiment.score > 0.7) {
        return {
          label: 'static-label',
          score: sentiment.score,
          reasoning: 'AI detected structured label characteristics'
        };
      } else if (sentiment.label === 'NEGATIVE' && sentiment.score > 0.7) {
        return {
          label: 'dynamic-data',
          score: sentiment.score,
          reasoning: 'AI detected variable data characteristics'
        };
      }
      
      return {
        label: 'standalone-text',
        score: 0.6,
        reasoning: 'AI classification uncertain'
      };
    } catch (error) {
      throw new Error(`AI classification failed: ${error}`);
    }
  }

  private static createContextPrompt(text: string, component: EnhancedPDFComponent): string {
    // Create a context-aware prompt for better classification
    const features = [];
    
    if (component.fontWeight === 'bold') features.push('bold');
    if (component.isItalic) features.push('italic');
    if (component.fontSize && component.fontSize > 12) features.push('large font');
    
    return `Text: "${text}" ${features.length > 0 ? `Features: ${features.join(', ')}` : ''}`;
  }

  private static combineClassifications(
    ruleBased: AIClassificationResult, 
    aiResult: AIClassificationResult
  ): AIClassificationResult {
    // Weight rule-based more heavily for reliability
    const ruleWeight = 0.7;
    const aiWeight = 0.3;
    
    if (ruleBased.label === aiResult.label) {
      return {
        label: ruleBased.label,
        score: (ruleBased.score * ruleWeight) + (aiResult.score * aiWeight),
        reasoning: `Combined: ${ruleBased.reasoning} + ${aiResult.reasoning}`
      };
    }
    
    // If they disagree, use the higher confidence one
    if (ruleBased.score > aiResult.score) {
      return ruleBased;
    } else {
      return aiResult;
    }
  }

  private static analyzeContext(
    component: EnhancedPDFComponent, 
    allComponents: EnhancedPDFComponent[]
  ): { nearbyText: string[]; position: 'left' | 'right' | 'above' | 'below' | 'isolated' } {
    const proximityThreshold = 100; // pixels
    const nearbyComponents = allComponents.filter(other => 
      other !== component && 
      this.calculateDistance(component, other) < proximityThreshold
    );

    const nearbyText = nearbyComponents.map(c => c.text);
    
    // Determine relative position of nearby components
    let position: 'left' | 'right' | 'above' | 'below' | 'isolated' = 'isolated';
    
    if (nearbyComponents.length > 0) {
      const rightComponents = nearbyComponents.filter(c => c.x > component.x);
      const leftComponents = nearbyComponents.filter(c => c.x < component.x);
      const belowComponents = nearbyComponents.filter(c => c.y > component.y);
      const aboveComponents = nearbyComponents.filter(c => c.y < component.y);
      
      if (rightComponents.length > 0) position = 'right';
      else if (leftComponents.length > 0) position = 'left';
      else if (belowComponents.length > 0) position = 'below';
      else if (aboveComponents.length > 0) position = 'above';
    }

    return { nearbyText, position };
  }

  private static calculateDistance(comp1: EnhancedPDFComponent, comp2: EnhancedPDFComponent): number {
    const dx = comp1.x - comp2.x;
    const dy = comp1.y - comp2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper method to analyze label-data pairs using AI insights
  static findLabelDataPairs(components: EnhancedPDFComponent[]): Array<{
    label: EnhancedPDFComponent;
    data: EnhancedPDFComponent;
    confidence: number;
  }> {
    const labels = components.filter(c => c.aiClassification?.label === 'static-label');
    const dataComponents = components.filter(c => c.aiClassification?.label === 'dynamic-data');
    
    const pairs: Array<{ label: EnhancedPDFComponent; data: EnhancedPDFComponent; confidence: number }> = [];
    
    for (const label of labels) {
      // Find the closest data component to the right or below
      const candidates = dataComponents.filter(data => 
        (data.x > label.x && Math.abs(data.y - label.y) < 20) || // To the right
        (data.y > label.y && Math.abs(data.x - label.x) < 20)    // Below
      );
      
      if (candidates.length > 0) {
        const closest = candidates.reduce((prev, curr) => 
          this.calculateDistance(label, curr) < this.calculateDistance(label, prev) ? curr : prev
        );
        
        const distance = this.calculateDistance(label, closest);
        const confidence = Math.max(0, 1 - distance / 200); // Normalize distance to confidence
        
        if (confidence > 0.5) {
          pairs.push({ label, data: closest, confidence });
        }
      }
    }
    
    return pairs;
  }
}