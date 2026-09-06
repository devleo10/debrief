type HelmetHeroProps = {
  alt?: string;
};

export default function HelmetHero({ alt = "Debrief AI agent" }: HelmetHeroProps) {
  return (
    <div className="dx-plate">
      <div className="dx-art">
        <video
          className="dx-helmet"
          src="/demo/helmet-loop.mp4?v=2"
          poster="/demo/helmet.jpg"
          aria-label={alt}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="dx-helmet-fade" aria-hidden />
      </div>
    </div>
  );
}
