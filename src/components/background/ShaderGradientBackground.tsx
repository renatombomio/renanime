import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

export default function ShaderGradientBackground() {
  return (
    <div className="shader-gradient" aria-hidden="true">
      <ShaderGradientCanvas
        style={{ position: "absolute", inset: 0 }}
        pixelDensity={1}
        fov={45}
        lazyLoad
      >
        <ShaderGradient
          animate="on"
          type="plane"
          shader="defaults"
          color1="#7A0A0F"
          color2="#E50914"
          color3="#FF5A1F"
          uDensity={1.3}
          uFrequency={2.5}
          uSpeed={0.28}
          uStrength={3.2}
          cDistance={3.6}
          cPolarAngle={90}
          lightType="3d"
          brightness={0.9}
          grain="off"
          reflection={0.05}
          zoomOut={false}
          enableTransition
        />
      </ShaderGradientCanvas>
    </div>
  );
}
