import { PDFAnalyzer } from "@/components/PDFAnalyzer";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background" />
        <div className="relative z-10 container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              PDF to SSRS
            </h1>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground">
              Blueprint Converter
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your PDF report designs into complete SSRS blueprints. 
              Extract layouts, tables, and components automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-10">
        <PDFAnalyzer />
      </div>
    </div>
  );
};

export default Index;
