const images = [
  "/gallery/barber1.jpg",
  "/gallery/barber2.jpg",
  "/gallery/barber3.jpg",
  "/gallery/barber4.jpg",
  "/gallery/barber5.jpg",
  "/gallery/barber6.jpg",
];

export default function GallerySection() {
  return (
    <section className="w-full max-w-5xl mx-auto py-12 px-4">
      <h2 className="text-2xl md:text-4xl font-bold mb-8 text-cyan-400 text-center drop-shadow-[0_2px_24px_rgba(0,255,255,0.10)]">
        Galeria Premium
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((src, i) => (
          <div
            key={src}
            className="overflow-hidden rounded-xl shadow-lg border border-cyan-400/10 hover:scale-105 hover:shadow-cyan-400/20 transition-transform duration-200 bg-[#181a20]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Barbearia Premium ${i + 1}`}
              className="w-full h-40 md:h-56 object-cover object-center hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
