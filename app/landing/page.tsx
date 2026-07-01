import HeroSection from "./components/HeroSection";
import ServicesSection from "./components/ServicesSection";
import GallerySection from "./components/GallerySection";
import TestimonialsSection from "./components/TestimonialsSection";
import CTASection from "./components/CTASection";
import MapSection from "./components/MapSection";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f1014] to-[#181a20] text-white flex flex-col items-center">
      <HeroSection />
      <ServicesSection />
      <GallerySection />
      <TestimonialsSection />
      <CTASection />
      <MapSection />
    </main>
  );
}
