export default function MapSection() {
  return (
    <section className="w-full max-w-4xl mx-auto py-12 px-4">
      <h2 className="text-2xl md:text-4xl font-bold mb-8 text-cyan-400 text-center drop-shadow-[0_2px_24px_rgba(0,255,255,0.10)]">
        Onde estamos
      </h2>
      <div className="rounded-2xl overflow-hidden shadow-lg border border-cyan-400/10">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.123456789!2d-46.6561234!3d-23.5641234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59a123456789%3A0x123456789abcdef!2sBarbearia%20Premium!5e0!3m2!1spt-BR!2sbr!4v1681234567890!5m2!1spt-BR!2sbr"
          width="100%"
          height="350"
          style={{ border: 0 }}
          allowFullScreen={true}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Barbearia Premium Localização"
        ></iframe>
      </div>
    </section>
  );
}
