import { useEffect, useState } from "react";

type AmbientVideoProps = {
  src: string;
  posterSrc: string;
  overlayClassName?: string;
  className?: string;
};

type NavWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

export function AmbientVideo({ src, posterSrc, overlayClassName, className }: AmbientVideoProps) {
  const [failed, setFailed] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const connection = (navigator as NavWithConnection).connection;
      setShouldPlay(!media.matches && !connection?.saveData);
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <>
      {shouldPlay && !failed ? (
        <video
          className={className ?? "cinematic-video"}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          aria-hidden="true"
        />
      ) : (
        <img
          className={className ?? "cinematic-video image-pan"}
          src={posterSrc}
          alt=""
          loading="lazy"
          aria-hidden="true"
        />
      )}
      <div className={overlayClassName ?? "cinematic-overlay"} />
    </>
  );
}
