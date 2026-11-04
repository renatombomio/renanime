import { useEffect, useState } from "react";

interface Props {
  src?: string | null;
  title: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  className?: string;
}

export default function AnimePosterDisplay({
  src,
  title,
  loading = "lazy",
  fetchPriority = "auto",
  className = "",
}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={title}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = title.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase();
  return (
    <div className={`anime-poster-placeholder ${className}`} role="img" aria-label={`Portada no disponible: ${title}`}>
      <span className="anime-poster-placeholder__mark" aria-hidden="true">{initials || "R"}</span>
      <span className="anime-poster-placeholder__title">{title}</span>
      <span className="anime-poster-placeholder__brand" aria-hidden="true">RENANIME</span>
    </div>
  );
}
